"use client";
import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { api, buildQuery, errorMessage } from "@/lib/api";
import type { Paginated } from "@/lib/types";
import type { SortState } from "./types";

type QueryValue = string | number | boolean | null | undefined;

const PAGE_SIZES = [10, 20, 50, 100];

/**
 * List state that lives in the URL (page, pageSize, q, sort, filters) so every view is shareable.
 * Updates go through the History API — Next keeps `useSearchParams` in sync without a server round trip.
 */
export function useListState<F extends string>(filterKeys: readonly F[], opts: { pageSize?: number; sort?: SortState } = {}) {
  const sp = useSearchParams();
  const pathname = usePathname();

  const page = Math.max(1, Number(sp.get("page")) || 1);
  const rawSize = Number(sp.get("pageSize"));
  const pageSize = PAGE_SIZES.includes(rawSize) ? rawSize : (opts.pageSize ?? 20);
  const q = sp.get("q") ?? "";
  const sort = parseSort(sp.get("sort")) ?? opts.sort ?? null;
  const filterString = filterKeys.map((k) => `${k}=${sp.get(k) ?? ""}`).join("&");
  const filters = React.useMemo(
    () => Object.fromEntries(filterKeys.map((k) => [k, sp.get(k) || null])) as Record<F, string | null>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filterString],
  );

  const update = React.useCallback(
    (patch: Record<string, QueryValue>, { resetPage = true }: { resetPage?: boolean } = {}) => {
      const next = new URLSearchParams(window.location.search);
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === undefined || v === "" || v === false) next.delete(k);
        else next.set(k, String(v));
      }
      if (resetPage && !("page" in patch)) next.delete("page");
      if (next.get("page") === "1") next.delete("page");
      const qs = next.toString();
      window.history.replaceState(window.history.state, "", `${pathname}${qs ? `?${qs}` : ""}`);
    },
    [pathname],
  );

  const activeFilters = filterKeys.filter((k) => filters[k]).length + (q ? 1 : 0);
  const resetFilters = React.useCallback(
    () => update(Object.fromEntries([...filterKeys.map((k) => [k, null]), ["q", null]])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [update, filterString],
  );

  return {
    page,
    pageSize,
    q,
    sort,
    filters,
    update,
    activeFilters,
    resetFilters,
    /** query object for the API: page, pageSize, q, sort, order + filters */
    apiQuery: {
      page,
      pageSize,
      q: q || undefined,
      sort: sort?.key,
      order: sort?.dir,
      ...filters,
    } as Record<string, QueryValue>,
    /** props for DataTable's `server` */
    server: (total: number) => ({
      total,
      page,
      pageSize,
      onPageChange: (p: number) => update({ page: p }, { resetPage: false }),
      onPageSizeChange: (s: number) => update({ pageSize: s === (opts.pageSize ?? 20) ? null : s }),
      onSortChange: (s: SortState) => update({ sort: s ? `${s.key}:${s.dir}` : null }),
    }),
  };
}

function parseSort(v: string | null): SortState {
  if (!v) return null;
  const [key, dir] = v.split(":");
  if (!key) return null;
  return { key, dir: dir === "desc" ? "desc" : "asc" };
}

function normalize<T>(d: unknown): Paginated<T> {
  if (Array.isArray(d)) return { items: d as T[], total: d.length, page: 1, pageSize: d.length || 1 };
  const p = (d ?? {}) as Partial<Paginated<T>>;
  const items = Array.isArray(p.items) ? p.items : [];
  return { items, total: typeof p.total === "number" ? p.total : items.length, page: p.page ?? 1, pageSize: p.pageSize ?? (items.length || 1) };
}

/**
 * Fetches a paginated admin list. Keeps the previous page while refetching (no skeleton flash),
 * exposes `mutate` for optimistic row updates and never throws (API may be down).
 */
export function useApiList<T>(path: string | null, query: Record<string, QueryValue> = {}) {
  const key = path ? path + buildQuery(query) : null;
  const [data, setData] = React.useState<Paginated<T> | null>(null);
  const [loading, setLoading] = React.useState(Boolean(path));
  const [error, setError] = React.useState<string | null>(null);
  const [nonce, setNonce] = React.useState(0);
  const queryRef = React.useRef(query);
  queryRef.current = query;

  React.useEffect(() => {
    if (!path) return;
    let alive = true;
    setLoading(true);
    setError(null);
    api
      .get<unknown>(path, { query: queryRef.current })
      .then((d) => {
        if (!alive) return;
        setData(normalize<T>(d));
      })
      .catch((e) => {
        if (!alive) return;
        setError(errorMessage(e));
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [key, nonce, path]);

  const reload = React.useCallback(() => setNonce((n) => n + 1), []);
  const mutate = React.useCallback((fn: (items: T[]) => T[]) => {
    setData((d) => (d ? { ...d, items: fn(d.items) } : d));
  }, []);

  return {
    items: data?.items ?? [],
    total: data?.total ?? 0,
    loading,
    /** true only while nothing has been loaded yet → show skeleton rows */
    initialLoading: loading && !data,
    /** background refetch with stale rows on screen */
    refreshing: loading && Boolean(data),
    error,
    reload,
    mutate,
    setData,
  };
}

/** Fetch a single resource (dashboard stats, a thread, …). */
export function useApi<T>(path: string | null, query?: Record<string, QueryValue>) {
  const key = path ? path + buildQuery(query) : null;
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(Boolean(path));
  const [error, setError] = React.useState<string | null>(null);
  const [nonce, setNonce] = React.useState(0);
  const queryRef = React.useRef(query);
  queryRef.current = query;

  React.useEffect(() => {
    if (!path) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    api
      .get<T>(path, { query: queryRef.current })
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(errorMessage(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [key, nonce, path]);

  const reload = React.useCallback(() => setNonce((n) => n + 1), []);
  return { data, setData, loading, error, reload };
}

/** Last non-null value — keeps a sheet's content on screen while it animates closed. */
export function useLatest<T>(value: T | null | undefined): T | null {
  const ref = React.useRef<T | null>(value ?? null);
  if (value != null) ref.current = value;
  return value ?? ref.current;
}

/** Re-renders every `ms` so relative times stay fresh. */
export function useNow(ms = 30_000) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** Debounced value */
export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

/** Run a batch of async operations and report how many succeeded. */
export async function settle<T>(items: T[], fn: (item: T) => Promise<unknown>) {
  const res = await Promise.allSettled(items.map(fn));
  const ok = res.filter((r) => r.status === "fulfilled").length;
  return { ok, fail: res.length - ok, results: res };
}
