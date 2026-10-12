"use client";
import { DEMO_ROOT } from "./static";

/**
 * Static demo (GitHub Pages) stand-in for the API: answers the public read-only calls the browser makes from a
 * snapshot taken at build time (`<root>/demo-api.json`, see deploy/pages/build.sh) or computes them locally.
 * Anything that needs an account or writes data explains that this is a demo.
 */
type Snapshot = {
  certificates: { certificate: { number: string; code: string } & Record<string, unknown>; project: unknown; document: unknown }[];
  documents: { sha256: string; title: string; type: string; status: string; issuedAt: string | null; number: string | null; project: { slug: string; name: string } }[];
};

let snapshot: Promise<Snapshot> | null = null;
const load = () => (snapshot ??= fetch(`${DEMO_ROOT}/demo-api.json`).then((r) => r.json() as Promise<Snapshot>));

const MESSAGES: Record<string, string> = {
  uz: "Bu GitHub Pages'dagi demo versiya — kirish, xarid va yuborish amallari to'liq platformada (ekabuild.uz) ishlaydi.",
  oz: "Бу GitHub Pages'даги демо версия — кириш, харид ва юбориш амаллари тўлиқ платформада (ekabuild.uz) ишлайди.",
  ru: "Это демо-версия на GitHub Pages — вход, покупка и отправка форм работают на полной платформе (ekabuild.uz).",
};

export function demoMessage() {
  const lang = typeof document !== "undefined" ? document.documentElement.lang : "uz";
  return lang.startsWith("ru") ? MESSAGES.ru : lang.includes("Cyrl") ? MESSAGES.oz : MESSAGES.uz;
}

async function sha256Hex(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Same schedule rules as apps/api/src/lib/finance.ts (no markup). */
function installment(amount: number, downPercent: number, months: number) {
  const start = new Date();
  const down = Math.round((amount * downPercent) / 100);
  const principal = amount - down;
  const monthly = Math.round(principal / months);
  const schedule = [{ seq: 0, dueDate: new Date(start.getTime() + 5 * 86400_000).toISOString(), amount: down, principal: down, interest: 0, balanceAfter: principal }];
  let balance = principal;
  for (let i = 1; i <= months; i++) {
    const pay = i === months ? balance : monthly;
    balance -= pay;
    const d = new Date(start);
    d.setMonth(d.getMonth() + i);
    schedule.push({ seq: i, dueDate: d.toISOString(), amount: pay, principal: pay, interest: 0, balanceAfter: Math.max(0, balance) });
  }
  return {
    total: amount,
    interest: 0,
    down,
    monthly: schedule[1]?.amount ?? 0,
    count: schedule.length,
    limits: { minDown: 20, maxMonths: 60, monthsOptions: [6, 12, 18, 24, 36, 48, 60] },
    schedule,
  };
}

export class DemoError extends Error {}

export async function demoRequest(method: string, path: string, query: Record<string, unknown> | undefined, body: unknown): Promise<unknown> {
  if (method === "GET" && path === "/verify") {
    const n = String(query?.number ?? "").trim().toUpperCase();
    const items = (await load()).certificates.filter((c) => c.certificate.number.toUpperCase() === n || c.certificate.code.toUpperCase() === n);
    return { items };
  }
  if (method === "POST" && path === "/verify/file" && body instanceof FormData) {
    const file = body.get("file");
    const digest = file instanceof File ? await sha256Hex(file) : "";
    const doc = (await load()).documents.find((d) => d.sha256 === digest);
    return doc ? { match: true, sha256: digest, document: doc } : { match: false, sha256: digest };
  }
  if (method === "GET" && path === "/calc/installment") {
    return installment(Number(query?.amount ?? 0), Number(query?.downPercent ?? 30), Number(query?.months ?? 12));
  }
  if (method === "GET" && path === "/support/threads/mine") return { thread: null, messages: [], agentsOnline: 0 };
  if (method === "POST" && /^\/projects\/[^/]+\/view$/.test(path)) return { ok: true };
  if (method === "GET" && path === "/auth/me") throw new DemoError("UNAUTHORIZED");
  throw new DemoError(demoMessage());
}
