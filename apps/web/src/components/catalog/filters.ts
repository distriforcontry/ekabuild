// Catalog filter state <-> URL search params <-> API query. Pure; used by the server page and the client view.
import { PROJECT_STATUSES, PROJECT_TYPES, REGIONS, type ProjectStatus, type ProjectType } from "@eka/shared";
import type { ProjectCard } from "@/lib/types";

export const SORTS = ["trust", "new", "price_asc", "price_desc", "progress"] as const;
export type SortKey = (typeof SORTS)[number];

export const VIEWS = ["grid", "list", "map"] as const;
export type ViewMode = (typeof VIEWS)[number];

export const PAGE_SIZE = 12;
export const DEFAULT_SORT: SortKey = "trust";

export type CatalogFilters = {
  q: string;
  region: string | null;
  status: ProjectStatus | null;
  type: ProjectType | null;
  sort: SortKey;
  page: number;
  minPrice: number | null;
  maxPrice: number | null;
  verified: boolean;
  view: ViewMode;
};

export type SearchParamsRecord = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const oneOf = <T extends string>(list: readonly T[], v: string | undefined): T | null =>
  v && (list as readonly string[]).includes(v) ? (v as T) : null;
const posNum = (v: string | undefined) => {
  if (!v) return null;
  const n = Number(v.replace(/\s/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

export function parseFilters(sp: SearchParamsRecord): CatalogFilters {
  const region = first(sp.region);
  const page = Number(first(sp.page));
  return {
    q: (first(sp.q) ?? "").trim().slice(0, 120),
    region: region && (REGIONS as readonly string[]).includes(region) ? region : null,
    status: oneOf(PROJECT_STATUSES, first(sp.status)),
    type: oneOf(PROJECT_TYPES, first(sp.type)),
    sort: oneOf(SORTS, first(sp.sort)) ?? DEFAULT_SORT,
    page: Number.isInteger(page) && page > 0 ? page : 1,
    minPrice: posNum(first(sp.minPrice)),
    maxPrice: posNum(first(sp.maxPrice)),
    verified: ["1", "true"].includes(first(sp.verified) ?? ""),
    view: oneOf(VIEWS, first(sp.view)) ?? "grid",
  };
}

/** Query for GET /projects */
export function toApiQuery(f: CatalogFilters) {
  return {
    q: f.q || undefined,
    region: f.region ?? undefined,
    status: f.status ?? undefined,
    type: f.type ?? undefined,
    sort: f.sort,
    page: f.page,
    pageSize: PAGE_SIZE,
    minPrice: f.minPrice ?? undefined,
    maxPrice: f.maxPrice ?? undefined,
    verified: f.verified ? "true" : undefined,
  };
}

/** URL search string for a filter state (defaults omitted). */
export function toSearch(f: CatalogFilters): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.region) p.set("region", f.region);
  if (f.status) p.set("status", f.status);
  if (f.type) p.set("type", f.type);
  if (f.minPrice) p.set("minPrice", String(f.minPrice));
  if (f.maxPrice) p.set("maxPrice", String(f.maxPrice));
  if (f.verified) p.set("verified", "1");
  if (f.sort !== DEFAULT_SORT) p.set("sort", f.sort);
  if (f.view !== "grid") p.set("view", f.view);
  if (f.page > 1) p.set("page", String(f.page));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function hrefFor(f: CatalogFilters, patch: Partial<CatalogFilters> = {}, resetPage = true) {
  const next = { ...f, ...(resetPage && !("page" in patch) ? { page: 1 } : {}), ...patch };
  return `/projects${toSearch(next)}`;
}

export function activeFilterCount(f: CatalogFilters) {
  return [f.q, f.region, f.status, f.type, f.minPrice, f.maxPrice, f.verified || null].filter(Boolean).length;
}

export const EMPTY_FILTERS: Pick<CatalogFilters, "q" | "region" | "status" | "type" | "minPrice" | "maxPrice" | "verified"> = {
  q: "",
  region: null,
  status: null,
  type: null,
  minPrice: null,
  maxPrice: null,
  verified: false,
};

/**
 * Static demo (no API): the whole catalog is prerendered once; filter, sort and paginate it in the browser
 * exactly like GET /projects does.
 */
export function filterLocally(items: ProjectCard[], f: CatalogFilters): { items: ProjectCard[]; total: number } {
  const q = f.q.toLowerCase();
  const price = (p: ProjectCard) => (p.priceFrom == null ? null : Number(p.priceFrom));
  let out = items.filter(
    (p) =>
      (!q || [p.name, p.address, p.district ?? "", p.developer.name].some((v) => v.toLowerCase().includes(q))) &&
      (!f.region || p.region === f.region) &&
      (!f.status || p.status === f.status) &&
      (!f.type || p.type === f.type) &&
      (!f.verified || p.verificationStatus === "VERIFIED") &&
      (f.minPrice == null || (price(p) ?? 0) >= f.minPrice) &&
      (f.maxPrice == null || (price(p) ?? Infinity) <= f.maxPrice),
  );
  const by = {
    trust: (a: ProjectCard, b: ProjectCard) => Number(b.featured) - Number(a.featured) || b.trustScore - a.trustScore,
    new: (a: ProjectCard, b: ProjectCard) => +new Date(b.createdAt ?? 0) - +new Date(a.createdAt ?? 0),
    price_asc: (a: ProjectCard, b: ProjectCard) => (price(a) ?? Infinity) - (price(b) ?? Infinity),
    price_desc: (a: ProjectCard, b: ProjectCard) => (price(b) ?? -1) - (price(a) ?? -1),
    progress: (a: ProjectCard, b: ProjectCard) => b.progress - a.progress,
  }[f.sort];
  out = [...out].sort(by);
  return { items: out.slice((f.page - 1) * PAGE_SIZE, f.page * PAGE_SIZE), total: out.length };
}
