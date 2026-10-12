"use client";
/**
 * Minimal client for the local E-IMZO desktop app (CAPIWS WebSocket API).
 *
 *   https  → wss://127.0.0.1:64443/service/cryptapi
 *   http   → ws://127.0.0.1:64646/service/cryptapi
 *
 * Every call opens a short-lived socket, sends `{ plugin?, name, arguments? }` and resolves with the parsed
 * JSON reply. Replies carry `success: boolean` and, on failure, `reason: string`.
 * Before any crypto call the site must register its API key(s) — env `NEXT_PUBLIC_EIMZO_API_KEYS`
 * formatted "domain1:key1,domain2:key2" (keys are issued by e-imzo.uz per domain).
 */

export class EimzoError extends Error {
  constructor(
    public kind: "NOT_RUNNING" | "TIMEOUT" | "API_KEY" | "PASSWORD" | "CANCELLED" | "FAILED",
    message: string,
  ) {
    super(message);
  }
}

type Reply = { success?: boolean; reason?: string; [k: string]: unknown };

export function eimzoUrl(): string {
  const secure = typeof location !== "undefined" && location.protocol === "https:";
  return secure ? "wss://127.0.0.1:64443/service/cryptapi" : "ws://127.0.0.1:64646/service/cryptapi";
}

function classify(reason: string): EimzoError["kind"] {
  const r = reason.toLowerCase();
  if (r.includes("api-key") || r.includes("apikey") || r.includes("api key")) return "API_KEY";
  if (r.includes("password") || r.includes("парол") || r.includes("parol") || r.includes("bad padding") || r.includes("incorrect")) return "PASSWORD";
  if (r.includes("cancel") || r.includes("отмен") || r.includes("bekor")) return "CANCELLED";
  return "FAILED";
}

/** Low-level call. Rejects with EimzoError. */
export function callEimzo<T extends Reply = Reply>(
  def: { plugin?: string; name: string; arguments?: unknown[] },
  { timeoutMs = 120_000, requireSuccess = true }: { timeoutMs?: number; requireSuccess?: boolean } = {},
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let socket: WebSocket;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket?.close();
      } catch {}
      fn();
    };
    const timer = setTimeout(() => finish(() => reject(new EimzoError("TIMEOUT", "E-IMZO did not respond"))), timeoutMs);
    try {
      socket = new WebSocket(eimzoUrl());
    } catch {
      finish(() => reject(new EimzoError("NOT_RUNNING", "Cannot connect to E-IMZO")));
      return;
    }
    socket.onerror = () => finish(() => reject(new EimzoError("NOT_RUNNING", "Cannot connect to E-IMZO")));
    socket.onclose = (e) => {
      if (!settled) finish(() => reject(new EimzoError("NOT_RUNNING", `E-IMZO closed the connection (${e.code})`)));
    };
    socket.onopen = () => socket.send(JSON.stringify(def));
    socket.onmessage = (ev) => {
      let data: T;
      try {
        data = JSON.parse(String(ev.data)) as T;
      } catch {
        finish(() => reject(new EimzoError("FAILED", "Invalid reply from E-IMZO")));
        return;
      }
      if (requireSuccess && data.success === false) {
        const reason = String(data.reason ?? "Unknown error");
        finish(() => reject(new EimzoError(classify(reason), reason)));
        return;
      }
      finish(() => resolve(data));
    };
  });
}

/** E-IMZO version (also a cheap "is it installed and running?" probe). */
export async function version(): Promise<{ major: number; minor: number }> {
  const r = await callEimzo<Reply & { major?: string | number; minor?: string | number }>({ name: "version" }, { timeoutMs: 4000, requireSuccess: false });
  const major = Number(r.major ?? 0);
  const minor = Number(r.minor ?? 0);
  if (!major) throw new EimzoError("NOT_RUNNING", "E-IMZO version unknown");
  return { major, minor };
}

/** Register the API key for one domain. */
export async function apikey(domain: string, key: string): Promise<void> {
  await callEimzo({ name: "apikey", arguments: [domain, key] }, { timeoutMs: 6000 });
}

/** Parses NEXT_PUBLIC_EIMZO_API_KEYS ("domain1:key1,domain2:key2"). */
export function configuredApiKeys(): { domain: string; key: string }[] {
  const raw = process.env.NEXT_PUBLIC_EIMZO_API_KEYS ?? "";
  return raw
    .split(",")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const i = pair.lastIndexOf(":");
      return i > 0 ? { domain: pair.slice(0, i).trim(), key: pair.slice(i + 1).trim() } : null;
    })
    .filter((x): x is { domain: string; key: string } => Boolean(x?.domain && x.key));
}

/** Calls apikey() for every configured pair; succeeds if at least one was accepted (or none configured). */
export async function installApiKeys(): Promise<void> {
  const pairs = configuredApiKeys();
  if (!pairs.length) return;
  const results = await Promise.allSettled(pairs.map((p) => apikey(p.domain, p.key)));
  if (!results.some((r) => r.status === "fulfilled")) {
    const first = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
    const reason = first?.reason instanceof Error ? first.reason.message : "API key rejected";
    throw new EimzoError("API_KEY", reason);
  }
}

export type RawCertificate = { disk: string; path: string; name: string; alias: string };

export type EimzoCertificate = RawCertificate & {
  cn: string;
  serial: string;
  validFrom: Date | null;
  validTo: Date | null;
  tin: string;
  pinfl: string;
  org: string;
  title: string;
  expired: boolean;
};

const parseEimzoDate = (s: string | undefined) => {
  if (!s) return null;
  // "2024.01.31 23:59:59" → ISO-ish
  const d = new Date(s.trim().replace(/\./g, "-").replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
};

/** "cn=…,serialnumber=…,validfrom=…,validto=…,1.2.860.3.16.1.1=<TIN>,1.2.860.3.16.1.2=<PINFL>,o=…,t=…" → map */
export function parseAlias(alias: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /(?:^|,)\s*([a-z][a-z0-9-]*|\d+(?:\.\d+)+)=/gi;
  const marks: { key: string; start: number; valueStart: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(alias))) marks.push({ key: m[1]!.toLowerCase(), start: m.index, valueStart: m.index + m[0].length });
  marks.forEach((mk, i) => {
    const end = i + 1 < marks.length ? marks[i + 1]!.start : alias.length;
    if (!(mk.key in out)) out[mk.key] = alias.slice(mk.valueStart, end).trim();
  });
  return out;
}

export function toCertificate(raw: RawCertificate): EimzoCertificate {
  const a = parseAlias(raw.alias ?? "");
  const validTo = parseEimzoDate(a.validto);
  return {
    ...raw,
    cn: a.cn ?? raw.name,
    serial: a.serialnumber ?? "",
    validFrom: parseEimzoDate(a.validfrom),
    validTo,
    tin: a["1.2.860.3.16.1.1"] ?? a.inn ?? a.uid ?? "",
    pinfl: a["1.2.860.3.16.1.2"] ?? a.pinfl ?? "",
    org: a.o ?? "",
    title: a.t ?? "",
    expired: validTo ? validTo.getTime() < Date.now() : false,
  };
}

/** PFX keys found on the computer (and USB tokens mounted as disks). */
export async function listCertificates(): Promise<EimzoCertificate[]> {
  const r = await callEimzo<Reply & { certificates?: RawCertificate[] }>({ plugin: "pfx", name: "list_all_certificates" }, { timeoutMs: 15_000 });
  return (r.certificates ?? []).map(toCertificate);
}

/** Loads a key — E-IMZO shows its own password prompt. Returns the session keyId. */
export async function loadKey(cert: RawCertificate): Promise<string> {
  const r = await callEimzo<Reply & { keyId?: string }>({ plugin: "pfx", name: "load_key", arguments: [cert.disk, cert.path, cert.name, cert.alias] });
  if (!r.keyId) throw new EimzoError("FAILED", "No keyId returned");
  return r.keyId;
}

/** Attached PKCS#7 signature over base64 data. Returns pkcs7_64. */
export async function createPkcs7(base64Data: string, keyId: string): Promise<string> {
  const r = await callEimzo<Reply & { pkcs7_64?: string }>({ plugin: "pkcs7", name: "create_pkcs7", arguments: [base64Data, keyId, "no"] });
  if (!r.pkcs7_64) throw new EimzoError("FAILED", "No signature returned");
  return r.pkcs7_64;
}

/** Releases a loaded key (best-effort). */
export async function unloadKey(keyId: string): Promise<void> {
  try {
    await callEimzo({ plugin: "pfx", name: "unload_key", arguments: [keyId] }, { timeoutMs: 4000, requireSuccess: false });
  } catch {}
}
