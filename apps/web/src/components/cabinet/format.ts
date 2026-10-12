"use client";
import * as React from "react";
import { formatArea, formatBytes, formatCompactMoney, formatDate, formatDateTime, formatMoney } from "@eka/shared";
import { useI18n } from "@/i18n/client";

const RU_DATE = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" });
const RU_DATETIME = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
const RU_SHORT = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" });
const UZ_MONTHS_SHORT = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];

const toDate = (v: string | Date | null | undefined) => {
  if (!v) return null;
  const d = typeof v === "string" ? new Date(v) : v;
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Locale-aware formatting for the cabinet (uz / oz via transliteration / ru via Intl). */
export function useFmt() {
  const { locale, tr, t } = useI18n();
  return React.useMemo(() => {
    const ru = locale === "ru";
    const money = (v: number | string | null | undefined, currency = "UZS") => {
      const s = formatMoney(v, currency);
      return ru ? s.replace("so'm", "сум") : tr(s);
    };
    const compact = (v: number | string | null | undefined) => {
      const s = formatCompactMoney(v);
      return ru ? s.replace("trln", "трлн").replace("mlrd", "млрд").replace("mln", "млн") : tr(s);
    };
    const date = (v: string | Date | null | undefined) => {
      const d = toDate(v);
      if (!d) return "—";
      return ru ? RU_DATE.format(d) : tr(formatDate(d));
    };
    const dateTime = (v: string | Date | null | undefined) => {
      const d = toDate(v);
      if (!d) return "—";
      return ru ? RU_DATETIME.format(d) : tr(formatDateTime(d));
    };
    const short = (v: string | Date | null | undefined) => {
      const d = toDate(v);
      if (!d) return "—";
      return ru ? RU_SHORT.format(d) : tr(`${d.getDate()} ${UZ_MONTHS_SHORT[d.getMonth()]}`);
    };
    const time = (v: string | Date | null | undefined) => {
      const d = toDate(v);
      if (!d) return "";
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    };
    const relative = (v: string | Date | null | undefined) => {
      const d = toDate(v);
      if (!d) return "—";
      const diff = (Date.now() - d.getTime()) / 1000;
      if (diff < 60) return t("common.time.justNow");
      if (diff < 3600) return t("common.time.minutesAgo", { n: Math.floor(diff / 60) });
      if (diff < 86400) return t("common.time.hoursAgo", { n: Math.floor(diff / 3600) });
      if (diff < 86400 * 7) return t("common.time.daysAgo", { n: Math.floor(diff / 86400) });
      return date(d);
    };
    const area = (v: number | null | undefined) => formatArea(v);
    const bytes = (v: number | null | undefined) => (v == null ? "—" : formatBytes(v));
    const number = (v: number | null | undefined) => (v == null ? "—" : new Intl.NumberFormat("uz-UZ").format(v).replace(/,/g, " "));
    return { money, compact, date, dateTime, short, time, relative, area, bytes, number };
  }, [locale, tr, t]);
}

/** Calendar-day key used for grouping (local time). */
export const dayKey = (v: string | Date) => {
  const d = typeof v === "string" ? new Date(v) : v;
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};
