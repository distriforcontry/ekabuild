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

/**
 * Replace {{path.to.value}} placeholders. A missing value renders as "______" (a blank line to fill in by hand);
 * a section that is explicitly absent (e.g. `buyerOrg: null` for an individual buyer) renders as nothing.
 */
export function renderTemplate(body: string, ctx: Record<string, unknown>): string {
  return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
    let cur: unknown = ctx;
    const parts = path.split(".");
    for (let i = 0; i < parts.length; i++) {
      if (cur === null && i > 0) return "";
      cur = cur && typeof cur === "object" ? (cur as Record<string, unknown>)[parts[i]!] : undefined;
    }
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
  /** payment plan + schedule (UNIT deals) — rendered into {{payment.*}} placeholders */
  payment?: { planType: "FULL" | "INSTALLMENT"; downPercent: number; months: number; rows: { seq: number; dueDate: Date; amount: number }[] } | null;
  reservationUntil?: Date | null;
  date?: Date;
}) {
  const d = input.date ?? new Date();
  const money = (n: number) => formatMoney(n, input.currency);
  const pay = input.payment;
  const scheduleTable = pay
    ? ["| № | To'lov | Muddati | Summa |", "|---|---|---|---|", ...pay.rows.map((r) => `| ${r.seq + 1} | ${r.seq === 0 ? (pay.planType === "FULL" ? "To'liq to'lov" : `Boshlang'ich to'lov (${pay.downPercent}%)`) : `${r.seq}-oy`} | ${dmy(r.dueDate)} | ${money(r.amount)} |`)].join("\n")
    : "";
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
    payment: pay
      ? {
          plan:
            pay.planType === "FULL"
              ? "bir martalik to'liq to'lov, shartnoma imzolangan kundan boshlab 5 (besh) kun ichida"
              : `bo'lib to'lash: boshlang'ich to'lov ${pay.downPercent}% (${money(pay.rows[0]?.amount ?? 0)}), qolgan qismi ${pay.months} oy davomida har oy teng ulushlarda`,
          down: money(pay.rows[0]?.amount ?? 0),
          monthly: pay.rows[1] ? money(pay.rows[1].amount) : "—",
          months: pay.months,
          count: pay.rows.length,
          lastDate: pay.rows.length ? dmy(pay.rows[pay.rows.length - 1]!.dueDate) : "—",
          table: scheduleTable,
        }
      : null,
    reservation: { until: input.reservationUntil ? dmy(input.reservationUntil) : null },
  };
}

function dmy(d: Date) {
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

/** Exact payload each party signs: binds contract number, body hash and signer role. */
export function signingPayload(c: { number: string; bodyHash: string }, role: string, userId: string) {
  const text = `EKA BUILD SHARTNOMA\nRaqam: ${c.number}\nSHA-256: ${c.bodyHash}\nTomon: ${role}\nFoydalanuvchi: ${userId}`;
  return { text, data: Buffer.from(text, "utf8").toString("base64") };
}
