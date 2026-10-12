import { env } from "../env";

/**
 * E-IMZO signature verification.
 *  - mode "eimzo": the browser signs the challenge with the local E-IMZO app (attached PKCS#7). We verify it with the
 *    E-IMZO server (dsv-server): POST /backend/pkcs7/verify/attached → signer certificate + verification flags.
 *  - mode "mock": demo signatures (base64 JSON) so the full flow works without keys in development.
 */
export type VerifiedSignature = {
  ok: boolean;
  reason?: string;
  signedData?: string; // base64 of the signed payload
  signerName?: string;
  signerTin?: string;
  signerPinfl?: string;
  certSerial?: string;
  certValidTo?: Date;
  raw?: unknown;
};

function parseDn(dn: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of dn.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim().toUpperCase()] = part.slice(i + 1).trim().replace(/^"|"$/g, "");
  }
  return out;
}

export async function verifyPkcs7(pkcs7: string, opts: { ip?: string; host?: string; expectedData: string; mode: "EIMZO" | "MOCK" }): Promise<VerifiedSignature> {
  if (opts.mode === "MOCK") {
    if (env.EIMZO_MODE !== "mock") return { ok: false, reason: "Demo imzo o'chirilgan" };
    try {
      const j = JSON.parse(Buffer.from(pkcs7, "base64").toString("utf8"));
      if (!j?.mock || j.data !== opts.expectedData) return { ok: false, reason: "Imzolangan ma'lumot mos emas" };
      return { ok: true, signedData: j.data, certSerial: "DEMO", raw: j };
    } catch {
      return { ok: false, reason: "Noto'g'ri demo imzo" };
    }
  }

  try {
    const res = await fetch(`${env.EIMZO_SERVER_URL}/backend/pkcs7/verify/attached`, {
      method: "POST",
      headers: { "content-type": "text/plain", "X-Real-IP": opts.ip ?? "127.0.0.1", Host: opts.host ?? new URL(env.PUBLIC_URL).host },
      body: pkcs7,
      signal: AbortSignal.timeout(15_000),
    });
    const j: any = await res.json();
    if (j?.status !== 1) return { ok: false, reason: j?.message ?? "E-IMZO server rad etdi", raw: j };
    const info = j.pkcs7Info ?? {};
    const signer = info.signers?.[0];
    const cert = signer?.certificate?.[0] ?? {};
    if (!signer?.verified || !signer?.certificateVerified) return { ok: false, reason: "Imzo yoki sertifikat tasdiqlanmadi", raw: j };
    if (info.documentBase64 !== opts.expectedData) return { ok: false, reason: "Imzolangan hujjat mos emas", raw: j };
    const subject = parseDn(cert.subjectName ?? "");
    return {
      ok: true,
      signedData: info.documentBase64,
      signerName: subject.CN,
      signerTin: subject["1.2.860.3.16.1.1"] ?? subject.UID,
      signerPinfl: subject["1.2.860.3.16.1.2"],
      certSerial: cert.serialNumber,
      certValidTo: cert.validTo ? new Date(cert.validTo) : undefined,
      raw: { signingTime: signer.signingTime, policyIdentifiers: signer.policyIdentifiers, issuer: cert.issuerName },
    };
  } catch (e) {
    return { ok: false, reason: `E-IMZO server bilan aloqa yo'q: ${(e as Error).message}` };
  }
}
