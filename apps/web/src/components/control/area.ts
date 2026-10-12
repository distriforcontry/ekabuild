import { API_BASE, buildQuery } from "@/lib/api";
import type { DuePayment } from "@/lib/types";

/**
 * The control centre exists twice: `/admin/*` (whole platform) and `/dev/*` (scoped to the developer's
 * organisation). Every shared component takes an `area` and derives its endpoints and links from it.
 */
export type Area = "admin" | "dev";

export const apiBase = (area: Area) => (area === "admin" ? "/admin" : "/dev");

export type ExportFilters = Record<string, string | number | null | undefined>;

/** Same-origin download URL for an Excel export (cookie auth goes through the Next rewrite of /api/v1). */
export function exportHref(area: Area, entity: string, filters: ExportFilters = {}) {
  return `${API_BASE}${apiBase(area)}/export/${entity}${buildQuery(filters)}`;
}

/** Link to a deal from a payment / deadline row. */
export function dealHref(area: Area, p: Pick<DuePayment["purchase"], "number">) {
  return area === "admin" ? `/admin/purchases?q=${encodeURIComponent(p.number)}` : `/app/developer/sales?q=${encodeURIComponent(p.number)}`;
}

/** Entities the developer scope can export (the admin gets the list from GET /admin/export). */
export const DEV_EXPORTS = ["projects", "units", "purchases", "payments", "certificates", "documents"] as const;
