// Locale-aware formatting for the catalog & project pages.
// Pure functions (no hooks) so they work identically on the server and the client — every
// output is deterministic (fixed Tashkent offset for times, manual month names) to avoid
// hydration mismatches between Node and the browser.
import { formatBytes, trustLevel } from "@eka/shared";
import type { Translator } from "@/i18n/core";

type I18nLike = Pick<Translator, "locale" | "t" | "tr" | "raw">;

const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000; // UTC+5, no DST

function toNum(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
}

function toDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  const d = typeof v === "string" ? new Date(v) : v;
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Group digits with non-breaking spaces: 845000000 → "845 000 000" */
export function groupDigits(n: number, fractionDigits = 0): string {
  const fixed = Math.abs(n).toFixed(fractionDigits);
  const [int, frac] = fixed.split(".");
  const grouped = int!.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${n < 0 ? "−" : ""}${grouped}${frac && Number(frac) !== 0 ? "," + frac.replace(/0+$/, "") : ""}`;
}

export function makeFormat(i: I18nLike) {
  const { t, tr, raw } = i;
  const currency = (c = "UZS") => (c === "UZS" ? t("catalog.money.currency") : c);
  const dec = (x: number) => {
    const s = x >= 100 ? x.toFixed(0) : x.toFixed(1).replace(/\.0$/, "");
    return s.replace(".", ",");
  };
  const months = t("catalog.date.months").split(",");
  const monthsGen = t("catalog.date.monthsGenitive").split(",");

  const fmt = {
    num(v: number | string | null | undefined, digits = 0) {
      const n = toNum(v);
      return n === null ? "—" : groupDigits(n, digits);
    },
    /** 845 000 000 so'm */
    money(v: number | string | null | undefined, cur = "UZS") {
      const n = toNum(v);
      return n === null ? "—" : `${groupDigits(n)} ${currency(cur)}`;
    },
    /** 1,2 mlrd */
    compact(v: number | string | null | undefined) {
      const n = toNum(v);
      if (n === null) return "—";
      const a = Math.abs(n);
      if (a >= 1e12) return `${dec(n / 1e12)} ${t("catalog.money.trln")}`;
      if (a >= 1e9) return `${dec(n / 1e9)} ${t("catalog.money.mlrd")}`;
      if (a >= 1e6) return `${dec(n / 1e6)} ${t("catalog.money.mln")}`;
      if (a >= 1e4) return `${dec(n / 1e3)} ${t("catalog.money.thousand")}`;
      return groupDigits(n);
    },
    /** 1,2 mlrd so'm */
    compactMoney(v: number | string | null | undefined, cur = "UZS") {
      const s = fmt.compact(v);
      return s === "—" ? s : `${s} ${currency(cur)}`;
    },
    area(v: number | null | undefined) {
      if (v === null || v === undefined || !Number.isFinite(v)) return "—";
      return `${groupDigits(v, 1)} m²`;
    },
    date(v: string | Date | null | undefined) {
      const d = toDate(v);
      if (!d) return "—";
      return t("catalog.date.format", {
        d: d.getUTCDate(),
        month: monthsGen[d.getUTCMonth()] ?? "",
        y: d.getUTCFullYear(),
      });
    },
    monthYear(v: string | Date | null | undefined) {
      const d = toDate(v);
      if (!d) return "—";
      return t("catalog.date.monthYear", { month: months[d.getUTCMonth()] ?? "", y: d.getUTCFullYear() });
    },
    dateTime(v: string | Date | null | undefined) {
      const d0 = toDate(v);
      if (!d0) return "—";
      const d = new Date(d0.getTime() + TASHKENT_OFFSET_MS);
      const hh = String(d.getUTCHours()).padStart(2, "0");
      const mm = String(d.getUTCMinutes()).padStart(2, "0");
      return `${fmt.date(d)}, ${hh}:${mm}`;
    },
    bytes(n: number | null | undefined) {
      return n === null || n === undefined ? "—" : formatBytes(n).replace(".", ",");
    },
    distance(m: number | null | undefined) {
      if (m === null || m === undefined || !Number.isFinite(m)) return "—";
      return m >= 1000
        ? t("catalog.map.km", { value: dec(m / 1000) })
        : t("catalog.map.meters", { value: Math.round(m) });
    },
    region(r: string | null | undefined) {
      if (!r) return "—";
      const map = raw<Record<string, string> | undefined>("catalog.regions");
      return map?.[r] ?? tr(r);
    },
    trustLabel(score: number) {
      return t(`catalog.trust.levels.${trustLevel(score).tone}`);
    },
    /** Days from now until a date (negative → past). */
    daysUntil(v: string | Date | null | undefined, now = Date.now()) {
      const d = toDate(v);
      if (!d) return null;
      return Math.ceil((d.getTime() - now) / 86_400_000);
    },
  };
  return fmt;
}

export type Format = ReturnType<typeof makeFormat>;

export const shortHash = (h: string | null | undefined, n = 10) => (h ? `${h.slice(0, n)}…${h.slice(-6)}` : "—");

export const isImage = (mime?: string | null, name?: string | null) =>
  Boolean(mime?.startsWith("image/")) || /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(name ?? "");
export const isPdf = (mime?: string | null, name?: string | null) => mime === "application/pdf" || /\.pdf$/i.test(name ?? "");
export const isModel = (mime?: string | null, name?: string | null) =>
  Boolean(mime?.includes("gltf")) || /\.(glb|gltf)$/i.test(name ?? "");

/** Great-circle distance in metres */
export function haversine(a: [number, number], b: [number, number]) {
  const R = 6_371_000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
