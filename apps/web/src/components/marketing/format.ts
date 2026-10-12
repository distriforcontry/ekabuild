// Locale-aware formatting for marketing pages (uz / oz / ru).
import { formatDate as formatDateUz, formatDateTime as formatDateTimeUz } from "@eka/shared";
import type { Locale } from "@/i18n/config";
import { latinToCyrillic } from "@/i18n/translit";

const toDate = (v: string | Date | null | undefined) => {
  if (!v) return null;
  const d = typeof v === "string" ? new Date(v) : v;
  return Number.isNaN(d.getTime()) ? null : d;
};

export function fmtDate(v: string | Date | null | undefined, locale: Locale): string {
  const d = toDate(v);
  if (!d) return "—";
  if (locale === "ru") return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(d);
  const s = formatDateUz(d);
  return locale === "oz" ? latinToCyrillic(s) : s;
}

export function fmtDateTime(v: string | Date | null | undefined, locale: Locale): string {
  const d = toDate(v);
  if (!d) return "—";
  if (locale === "ru")
    return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
  const s = formatDateTimeUz(d);
  return locale === "oz" ? latinToCyrillic(s) : s;
}

export function fmtTime(v: string | Date | null | undefined): string {
  const d = toDate(v);
  if (!d) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const UNITS: Record<Locale, [string, string, string]> = {
  uz: ["trln", "mlrd", "mln"],
  oz: ["трлн", "млрд", "млн"],
  ru: ["трлн", "млрд", "млн"],
};
const CURRENCY: Record<Locale, string> = { uz: "so'm", oz: "сўм", ru: "сум" };

/** 845000000 → "845 mln so'm" / "845 млн сум" */
export function fmtMoneyCompact(value: string | number | null | undefined, locale: Locale, currency = "UZS"): string | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n) || n <= 0) return null;
  const [tr, bn, mn] = UNITS[locale];
  const dec = locale === "ru" ? "," : ".";
  const short = (x: number) => {
    const s = x >= 100 ? Math.round(x).toString() : x.toFixed(1).replace(/\.0$/, "");
    return s.replace(".", dec);
  };
  let body: string;
  if (n >= 1e12) body = `${short(n / 1e12)} ${tr}`;
  else if (n >= 1e9) body = `${short(n / 1e9)} ${bn}`;
  else if (n >= 1e6) body = `${short(n / 1e6)} ${mn}`;
  else body = new Intl.NumberFormat("ru-RU").format(n);
  const cur = currency === "UZS" ? CURRENCY[locale] : currency;
  return `${body} ${cur}`;
}

export function fmtNumber(n: number): string {
  return new Intl.NumberFormat("ru-RU").format(n).replace(/ /g, " ");
}

/** Normalises any list response: plain array or { items }. */
export function asList<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (v && typeof v === "object" && Array.isArray((v as { items?: unknown }).items)) return (v as { items: T[] }).items;
  return [];
}
