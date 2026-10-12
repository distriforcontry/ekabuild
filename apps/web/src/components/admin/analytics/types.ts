// DTO for GET /admin/analytics?days=7|30|90|365 (docs/API.md → "Analytics — /admin/analytics")

export const PERIODS = [7, 30, 90, 365] as const;
export type Period = (typeof PERIODS)[number];

export const TOTAL_KEYS = [
  "views",
  "certificateLookups",
  "fileChecks",
  "registrations",
  "logins",
  "purchases",
  "signed",
  "paid",
  "revenue",
  "complaints",
  "supportThreads",
  "avgTrust",
] as const;
export type TotalKey = (typeof TOTAL_KEYS)[number];
export type Totals = Record<TotalKey, number>;

export const FUNNEL_STEPS = ["views", "favorites", "purchases", "signed", "paid"] as const;
export type FunnelStep = (typeof FUNNEL_STEPS)[number];

export type DailyPoint = { date: string; views: number; registrations: number; purchases: number; paid: number; revenue: number; lookups: number };
export type RegionRow = { region: string; projects: number; sold: number; available: number; revenue: number; avgTrust: number; avgPricePerSqm: number };
export type DeveloperRow = { id: string; name: string; projects: number; sold: number; revenue: number; avgTrust: number; complaints: number };
export type TopProject = { slug: string; name: string; views: number; purchases: number; conversion: number; trustScore: number; coverUrl: string | null };
export type TrustSalesPoint = { name: string; slug: string; trustScore: number; soldShare: number; units: number };
export type UnitMixRow = { rooms: number; sold: number; reserved: number; available: number; avgArea: number; avgPrice: number };
export type FlowLink = { from: string; to: string; count: number };
export type HourPoint = { hour: number; views: number; purchases: number };

export type Analytics = {
  range: { from: string; to: string; days: number };
  totals: Totals;
  previous: Totals;
  funnel: { step: FunnelStep; count: number }[];
  daily: DailyPoint[];
  byRegion: RegionRow[];
  byDeveloper: DeveloperRow[];
  topProjects: TopProject[];
  trustVsSales: TrustSalesPoint[];
  unitMix: UnitMixRow[];
  statusFlow: FlowLink[];
  signatures: { EIMZO: number; MOCK: number };
  support: { threads: number; closed: number; avgFirstResponseMin: number | null };
  hourly: HourPoint[];
};

/* ───────────────────────────── normalisation (the API may evolve — never trust shapes) ───────────────────────────── */

type Loose = Record<string, unknown>;
const num = (v: unknown) => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown, fb = "") => (typeof v === "string" ? v : v == null ? fb : String(v));
const arr = (v: unknown): Loose[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Loose[]) : []);
const obj = (v: unknown): Loose => (v && typeof v === "object" && !Array.isArray(v) ? (v as Loose) : {});

/** statusFlow ids may come lower-case / shortened ("pending") — map them onto PurchaseStatus names. */
const STATUS_ALIASES: Record<string, string> = {
  created: "CREATED",
  draft: "DRAFT",
  pending: "PENDING_SIGNATURES",
  pending_signatures: "PENDING_SIGNATURES",
  partially_signed: "PARTIALLY_SIGNED",
  signed: "SIGNED",
  paid: "PAID",
  completed: "COMPLETED",
  cancelled: "CANCELLED",
  canceled: "CANCELLED",
};
const statusId = (v: unknown) => {
  const s = str(v).trim();
  return STATUS_ALIASES[s.toLowerCase()] ?? s.toUpperCase();
};

function totals(v: unknown): Totals {
  const o = obj(v);
  return Object.fromEntries(TOTAL_KEYS.map((k) => [k, num(o[k])])) as Totals;
}

export function normalizeAnalytics(raw: unknown, days: number): Analytics {
  const o = obj(raw);
  const range = obj(o.range);
  const funnelMap = new Map(arr(o.funnel).map((f) => [str(f.step), num(f.count)]));
  const hourlyMap = new Map(arr(o.hourly).map((h) => [num(h.hour), h]));
  const sig = obj(o.signatures);
  const sup = obj(o.support);
  return {
    range: { from: str(range.from), to: str(range.to), days: num(range.days) || days },
    totals: totals(o.totals),
    previous: totals(o.previous),
    funnel: FUNNEL_STEPS.map((step) => ({ step, count: funnelMap.get(step) ?? 0 })),
    daily: arr(o.daily)
      .map((d) => ({
        date: str(d.date).slice(0, 10),
        views: num(d.views),
        registrations: num(d.registrations),
        purchases: num(d.purchases),
        paid: num(d.paid),
        revenue: num(d.revenue),
        lookups: num(d.lookups),
      }))
      .filter((d) => d.date)
      .sort((a, b) => a.date.localeCompare(b.date)),
    byRegion: arr(o.byRegion).map((r) => ({
      region: str(r.region, "—"),
      projects: num(r.projects),
      sold: num(r.sold),
      available: num(r.available),
      revenue: num(r.revenue),
      avgTrust: num(r.avgTrust),
      avgPricePerSqm: num(r.avgPricePerSqm),
    })),
    byDeveloper: arr(o.byDeveloper).map((d, i) => ({
      id: str(d.id, String(i)),
      name: str(d.name, "—"),
      projects: num(d.projects),
      sold: num(d.sold),
      revenue: num(d.revenue),
      avgTrust: num(d.avgTrust),
      complaints: num(d.complaints),
    })),
    topProjects: arr(o.topProjects).map((p, i) => ({
      slug: str(p.slug, String(i)),
      name: str(p.name, "—"),
      views: num(p.views),
      purchases: num(p.purchases),
      conversion: num(p.conversion),
      trustScore: num(p.trustScore),
      coverUrl: typeof p.coverUrl === "string" && p.coverUrl ? p.coverUrl : null,
    })),
    trustVsSales: arr(o.trustVsSales).map((p, i) => ({
      name: str(p.name, "—"),
      slug: str(p.slug, String(i)),
      trustScore: num(p.trustScore),
      soldShare: Math.max(0, Math.min(1, num(p.soldShare))),
      units: num(p.units),
    })),
    unitMix: arr(o.unitMix)
      .map((u) => ({
        rooms: num(u.rooms),
        sold: num(u.sold),
        reserved: num(u.reserved),
        available: num(u.available),
        avgArea: num(u.avgArea),
        avgPrice: num(u.avgPrice),
      }))
      .sort((a, b) => a.rooms - b.rooms),
    statusFlow: arr(o.statusFlow)
      .map((l) => ({ from: statusId(l.from), to: statusId(l.to), count: num(l.count) }))
      .filter((l) => l.from && l.to && l.from !== l.to && l.count > 0),
    signatures: { EIMZO: num(sig.EIMZO), MOCK: num(sig.MOCK) },
    support: {
      threads: num(sup.threads),
      closed: num(sup.closed),
      avgFirstResponseMin: sup.avgFirstResponseMin == null ? null : num(sup.avgFirstResponseMin),
    },
    hourly: Array.from({ length: 24 }, (_, hour) => {
      const h = hourlyMap.get(hour);
      return { hour, views: num(h?.views), purchases: num(h?.purchases) };
    }),
  };
}

/** % change vs the previous period; null = no baseline (new) */
export function delta(cur: number, prev: number): number | null {
  if (!prev) return cur ? null : 0;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

/** Files are served by the API; images accept ?w= for resized WebP */
export function thumb(url: string | null, w = 320) {
  if (!url) return null;
  return url.includes("?") ? `${url}&w=${w}` : `${url}?w=${w}`;
}
