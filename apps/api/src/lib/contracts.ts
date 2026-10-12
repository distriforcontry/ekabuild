import { formatMoney } from "@eka/shared";

const ONES = ["", "bir", "ikki", "uch", "to'rt", "besh", "olti", "yetti", "sakkiz", "to'qqiz"];
const TENS = ["", "o'n", "yigirma", "o'ttiz", "qirq", "ellik", "oltmish", "yetmish", "sakson", "to'qson"];
const SCALES = ["", "ming", "million", "milliard", "trillion"];

function triple(n: number): string {
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const o = n % 10;
  return [h ? `${h > 1 ? ONES[h] + " " : "bir "}yuz` : "", TENS[t], ONES[o]].filter(Boolean).join(" ");
}

/** 845000000 → "sakkiz yuz qirq besh million" */
export function numberToUzWords(value: number): string {
  let n = Math.floor(Math.abs(value));
  if (n === 0) return "nol";
  const parts: string[] = [];
  let i = 0;
  while (n > 0) {
    const chunk = n % 1000;
    if (chunk) parts.unshift(`${triple(chunk)}${SCALES[i] ? " " + SCALES[i] : ""}`);
    n = Math.floor(n / 1000);
    i++;
  }
  return parts.join(" ");
}

/** Replace {{path.to.value}} placeholders. Unknown placeholders render as "______" (blank line to fill). */
export function renderTemplate(body: string, ctx: Record<string, unknown>): string {
  return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
    let cur: unknown = ctx;
    for (const p of path.split(".")) cur = cur && typeof cur === "object" ? (cur as Record<string, unknown>)[p] : undefined;
    return cur === undefined || cur === null || cur === "" ? "______" : String(cur);
  });
}

export function contractContext(input: {
  number: string;
  buyer: { fullName: string; phone: string; pinfl: string | null };
  buyerOrg: { name: string; tin: string } | null;
  seller: { name: string; tin: string; director: string | null; address: string | null };
  project: { name: string; address: string; cadastreNumber: string | null };
  unit: { number: string; floor: number; area: number; rooms: number; section: number } | null;
  amount: number;
  currency: string;
}) {
  const d = new Date();
  return {
    contract: { number: input.number, date: `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}` },
    buyer: input.buyer,
    buyerOrg: input.buyerOrg,
    seller: input.seller,
    project: input.project,
    unit: input.unit,
    amount: formatMoney(input.amount, input.currency),
    amountWords: `${numberToUzWords(input.amount)} ${input.currency === "UZS" ? "so'm" : input.currency}`,
    currency: input.currency,
  };
}

/** Exact payload each party signs: binds contract number, body hash and signer role. */
export function signingPayload(c: { number: string; bodyHash: string }, role: string, userId: string) {
  const text = `EKA BUILD SHARTNOMA\nRaqam: ${c.number}\nSHA-256: ${c.bodyHash}\nTomon: ${role}\nFoydalanuvchi: ${userId}`;
  return { text, data: Buffer.from(text, "utf8").toString("base64") };
}
