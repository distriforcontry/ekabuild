"use client";
import * as React from "react";
import { formatCompactMoney, formatDate, formatDateTime, formatMoney } from "@eka/shared";
import { useI18n } from "@/i18n/client";

const RU_DATE = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" });
const RU_SHORT = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" });
const UZ_SHORT_MONTHS = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];

const toDate = (v: string | Date | null | undefined) => {
  if (!v) return null;
  const d = typeof v === "string" ? new Date(v) : v;
  return Number.isNaN(d.getTime()) ? null : d;
};

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/** Locale-aware formatting for the admin (uz → shared helpers, oz → transliterated, ru → Intl). */
export function useFormat() {
  const { locale, tr, t } = useI18n();
  return React.useMemo(() => {
    const ru = locale === "ru";
    const date = (v: string | Date | null | undefined) => {
      const d = toDate(v);
      if (!d) return "—";
      return ru ? RU_DATE.format(d).replace(/\s?г\.$/, "") : tr(formatDate(d));
    };
    const dateTime = (v: string | Date | null | undefined) => {
      const d = toDate(v);
      if (!d) return "—";
      return ru ? `${date(d)}, ${hhmm(d)}` : tr(formatDateTime(d));
    };
    const shortDate = (v: string | Date | null | undefined) => {
      const d = toDate(v);
      if (!d) return "—";
      return ru ? RU_SHORT.format(d).replace(".", "") : tr(`${d.getDate()} ${UZ_SHORT_MONTHS[d.getMonth()]}`);
    };
    const time = (v: string | Date | null | undefined) => {
      const d = toDate(v);
      return d ? hhmm(d) : "—";
    };
    const money = (v: number | string | null | undefined, currency = "UZS") => {
      const s = formatMoney(v, currency);
      return ru ? s.replace("so'm", "сум") : tr(s);
    };
    const compactMoney = (v: number | string | null | undefined) => {
      const s = formatCompactMoney(v);
      return ru ? s.replace("trln", "трлн").replace("mlrd", "млрд").replace("mln", "млн") : tr(s);
    };
    const number = (v: number | null | undefined) =>
      v == null || !Number.isFinite(v) ? "—" : new Intl.NumberFormat("ru-RU").format(v).replace(/ /g, " ");
    const relative = (v: string | Date | null | undefined, now = Date.now()) => {
      const d = toDate(v);
      if (!d) return "—";
      const s = Math.max(0, Math.round((now - d.getTime()) / 1000));
      if (s < 45) return t("common.time.justNow");
      const m = Math.round(s / 60);
      if (m < 60) return t("common.time.minutesAgo", { n: m });
      const h = Math.round(m / 60);
      if (h < 24) return t("common.time.hoursAgo", { n: h });
      const days = Math.round(h / 24);
      if (days < 7) return t("common.time.daysAgo", { n: days });
      return date(d);
    };
    /** compact relative label for dense lists: 5m, 3h, 2d, 12 okt */
    const ago = (v: string | Date | null | undefined, now = Date.now()) => {
      const d = toDate(v);
      if (!d) return "";
      const m = Math.floor((now - d.getTime()) / 60000);
      const sameDay = new Date(now).toDateString() === d.toDateString();
      if (m < 1) return t("common.time.justNow");
      if (sameDay) return hhmm(d);
      if (m < 60 * 24 * 6) return ru ? RU_WEEKDAY.format(d) : tr(UZ_WEEKDAYS[d.getDay()]!);
      return shortDate(d);
    };
    return { date, dateTime, shortDate, time, money, compactMoney, number, relative, ago };
  }, [locale, tr, t]);
}

const RU_WEEKDAY = new Intl.DateTimeFormat("ru-RU", { weekday: "short" });
const UZ_WEEKDAYS = ["Yak", "Du", "Se", "Chor", "Pay", "Ju", "Sha"];

/** First 8 chars of a hash for display */
export const shortHash = (h: string | null | undefined, n = 8) => (h ? h.slice(0, n) : "—");

/** Days until a date (negative → in the past) */
export function daysUntil(v: string | null | undefined, now = Date.now()) {
  const d = toDate(v);
  if (!d) return null;
  return Math.ceil((d.getTime() - now) / 86_400_000);
}

/** Public site origin. On admin.ekabuild.uz → https://ekabuild.uz; locally → current origin. */
export function siteOrigin() {
  if (typeof window === "undefined") return process.env.NEXT_PUBLIC_SITE_URL ?? "https://ekabuild.uz";
  const { protocol, host } = window.location;
  if (/^(admin|app)\./.test(host)) return `${protocol}//${host.replace(/^(admin|app)\./, "")}`;
  return window.location.origin;
}

/** Origin of the user cabinet (app.ekabuild.uz) for links that live under /app. */
export function cabinetUrl(path: string) {
  if (typeof window === "undefined") return path;
  const { protocol, host } = window.location;
  if (/^admin\./.test(host)) return `${protocol}//${host.replace(/^admin\./, "app.")}${path.replace(/^\/app/, "") || "/"}`;
  return path;
}

const CYR: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", ғ: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i", й: "y", к: "k", қ: "q", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ў: "o", ф: "f", х: "x", ҳ: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sh",
  ъ: "", ы: "i", ь: "", э: "e", ю: "yu", я: "ya",
};

/** Text slug for URLs: Latin letters, digits and dashes (Cyrillic is transliterated). */
export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[а-яёўқғҳ]/g, (c) => CYR[c] ?? "")
    .replace(/[‘’ʻʼ`']/g, "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
