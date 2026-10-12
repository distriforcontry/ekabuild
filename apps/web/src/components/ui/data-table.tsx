"use client";
import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowDown2,
  ArrowLeft2,
  ArrowRight2,
  ArrowUp2,
  ArrowSwapVertical,
  DocumentDownload,
  Eye,
  SearchNormal1,
  SearchStatus,
} from "iconsax-reactjs";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";
import { Button } from "./button";
import { Skeleton } from "./skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "./dropdown";

export type Column<T> = {
  key: string;
  header: React.ReactNode;
  /** custom cell renderer; defaults to row[key] */
  cell?: (row: T, index: number) => React.ReactNode;
  /** enables sorting; value used for client-side sort */
  sortValue?: (row: T) => string | number | Date | null | undefined;
  /** server mode: sortable without sortValue */
  sortable?: boolean;
  /** plain value for CSV export */
  exportValue?: (row: T) => string | number | null | undefined;
  align?: "left" | "right" | "center";
  className?: string;
  headerClassName?: string;
  width?: string;
  /** hidden below md breakpoint */
  hideOnMobile?: boolean;
  /** user can't hide it from the column menu */
  alwaysVisible?: boolean;
};

type Sort = { key: string; dir: "asc" | "desc" } | null;

type ServerState = {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  onSearchChange?: (q: string) => void;
  onSortChange?: (sort: Sort) => void;
};

export type DataTableProps<T> = {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  /** text used by the built-in search (client mode) */
  searchText?: (row: T) => string;
  searchPlaceholder?: string;
  /** filters / buttons rendered in the toolbar */
  toolbar?: React.ReactNode;
  onRowClick?: (row: T) => void;
  /** server-side pagination/search/sort; omit for client mode */
  server?: ServerState;
  pageSize?: number;
  selectable?: boolean;
  bulkActions?: (selected: T[], clear: () => void) => React.ReactNode;
  exportName?: string;
  emptyTitle?: string;
  emptyHint?: string;
  className?: string;
  /** compact row height */
  dense?: boolean;
  initialSort?: Sort;
};

const PAGE_SIZES = [10, 20, 50, 100];

function cmp(a: unknown, b: unknown) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "uz", { numeric: true, sensitivity: "base" });
}

/**
 * Feature-complete table: search, sort, pagination (client or server), row selection with bulk actions,
 * column visibility, CSV export, skeleton loading, animated rows, empty state, sticky header, responsive.
 */
export function DataTable<T>({
  columns,
  data,
  rowKey,
  loading,
  searchText,
  searchPlaceholder,
  toolbar,
  onRowClick,
  server,
  pageSize: initialPageSize = 10,
  selectable,
  bulkActions,
  exportName,
  emptyTitle,
  emptyHint,
  className,
  dense,
  initialSort = null,
}: DataTableProps<T>) {
  const { t } = useI18n();
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<Sort>(initialSort);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(initialPageSize);
  const [hidden, setHidden] = React.useState<Set<string>>(new Set());
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  // debounce server search
  React.useEffect(() => {
    if (!server?.onSearchChange) return;
    const id = setTimeout(() => server.onSearchChange?.(query), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const visibleColumns = columns.filter((c) => !hidden.has(c.key));
  const showSearch = Boolean(searchText || server?.onSearchChange);

  const processed = React.useMemo(() => {
    if (server) return data;
    let rows = data;
    if (query && searchText) {
      const q = query.toLowerCase();
      rows = rows.filter((r) => searchText(r).toLowerCase().includes(q));
    }
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col?.sortValue) {
        const sv = col.sortValue;
        rows = [...rows].sort((a, b) => (sort.dir === "asc" ? 1 : -1) * cmp(sv(a), sv(b)));
      }
    }
    return rows;
  }, [data, query, sort, searchText, columns, server]);

  const total = server ? server.total : processed.length;
  const curPage = server ? server.page : page;
  const curSize = server ? server.pageSize : pageSize;
  const pages = Math.max(1, Math.ceil(total / curSize));
  const rows = server ? processed : processed.slice((curPage - 1) * curSize, curPage * curSize);

  React.useEffect(() => {
    if (!server && page > pages) setPage(1);
  }, [pages, page, server]);

  const goTo = (p: number) => {
    const next = Math.min(pages, Math.max(1, p));
    if (server) server.onPageChange(next);
    else setPage(next);
  };

  const toggleSort = (col: Column<T>) => {
    if (!col.sortValue && !col.sortable) return;
    const next: Sort = !sort || sort.key !== col.key ? { key: col.key, dir: "asc" } : sort.dir === "asc" ? { key: col.key, dir: "desc" } : null;
    setSort(next);
    server?.onSortChange?.(next);
  };

  const allOnPage = rows.map(rowKey);
  const allSelected = allOnPage.length > 0 && allOnPage.every((k) => selected.has(k));
  const toggleAll = () =>
    setSelected((s) => {
      const n = new Set(s);
      if (allSelected) allOnPage.forEach((k) => n.delete(k));
      else allOnPage.forEach((k) => n.add(k));
      return n;
    });
  const toggleOne = (k: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  const selectedRows = data.filter((r) => selected.has(rowKey(r)));

  const exportCsv = () => {
    const cols = visibleColumns.filter((c) => c.exportValue);
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = cols.map((c) => esc(typeof c.header === "string" ? c.header : c.key)).join(",");
    const body = processed.map((r) => cols.map((c) => esc(c.exportValue!(r))).join(",")).join("\n");
    const blob = new Blob(["﻿" + header + "\n" + body], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${exportName ?? "export"}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const from = total === 0 ? 0 : (curPage - 1) * curSize + 1;
  const to = Math.min(total, curPage * curSize);
  const cellPad = dense ? "px-4 py-2.5" : "px-4 py-3.5";

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-line bg-ink-900 shadow-card", className)}>
      {/* toolbar */}
      {(showSearch || toolbar || exportName || columns.length > 4) && (
        <div className="flex flex-col gap-3 border-b border-line p-3 md:flex-row md:items-center md:p-4">
          {showSearch && (
            <div className="relative w-full md:max-w-xs">
              <SearchNormal1 size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (!server) setPage(1);
                }}
                placeholder={searchPlaceholder ?? t("common.table.searchPlaceholder")}
                className="h-10 w-full rounded-xl border border-line bg-ink-850 pl-9 pr-3 text-sm text-stone-100 placeholder:text-ink-400 transition focus:border-gold-500/60 focus:outline-none focus:ring-4 focus:ring-gold-500/10"
              />
            </div>
          )}
          <div className="flex flex-1 flex-wrap items-center gap-2">{toolbar}</div>
          <div className="flex items-center gap-2">
            {columns.length > 4 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="sm">
                    <Eye size={16} /> {t("common.table.columns")}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{t("common.table.columns")}</DropdownMenuLabel>
                  {columns
                    .filter((c) => !c.alwaysVisible)
                    .map((c) => (
                      <DropdownMenuItem
                        key={c.key}
                        onSelect={(e) => {
                          e.preventDefault();
                          setHidden((h) => {
                            const n = new Set(h);
                            if (n.has(c.key)) n.delete(c.key);
                            else n.add(c.key);
                            return n;
                          });
                        }}
                      >
                        <span className={cn("grid size-4 place-items-center rounded border", !hidden.has(c.key) ? "border-gold-400 bg-gold-400" : "border-line-strong")} />
                        {typeof c.header === "string" ? c.header : c.key}
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {exportName && (
              <Button variant="secondary" size="sm" onClick={exportCsv} disabled={!processed.length}>
                <DocumentDownload size={16} /> CSV
              </Button>
            )}
          </div>
        </div>
      )}

      {/* bulk bar */}
      <AnimatePresence>
        {selectable && selected.size > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-line bg-gold-500/8"
          >
            <div className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className="font-medium text-gold-200">{t("common.table.selected", { count: selected.size })}</span>
              <div className="flex flex-1 flex-wrap gap-2">{bulkActions?.(selectedRows, () => setSelected(new Set()))}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-ink-900/95 backdrop-blur">
            <tr className="border-b border-line">
              {selectable && (
                <th className="w-10 px-4 py-3">
                  <Check checked={allSelected} onChange={toggleAll} />
                </th>
              )}
              {visibleColumns.map((c) => {
                const sortable = Boolean(c.sortValue || c.sortable);
                const active = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    style={{ width: c.width }}
                    aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined}
                    className={cn(
                      "whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-ink-400",
                      c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left",
                      c.hideOnMobile && "hidden md:table-cell",
                      c.headerClassName,
                    )}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(c)}
                        className={cn("inline-flex cursor-pointer items-center gap-1 uppercase transition hover:text-stone-100", active && "text-gold-300")}
                      >
                        {c.header}
                        {active ? sort!.dir === "asc" ? <ArrowUp2 size={12} /> : <ArrowDown2 size={12} /> : <ArrowSwapVertical size={12} className="opacity-50" />}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: Math.min(curSize, 8) }).map((_, i) => (
                <tr key={i} className="border-b border-line last:border-0">
                  {selectable && <td className={cellPad} />}
                  {visibleColumns.map((c) => (
                    <td key={c.key} className={cn(cellPad, c.hideOnMobile && "hidden md:table-cell")}>
                      <Skeleton className="h-4 w-full max-w-40" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length + (selectable ? 1 : 0)}>
                  <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                    <div className="mb-3 grid size-12 place-items-center rounded-2xl border border-line bg-ink-850 text-ink-400">
                      <SearchStatus size={22} variant="Bulk" />
                    </div>
                    <div className="font-semibold text-stone-100">{emptyTitle ?? t("common.table.empty")}</div>
                    <div className="mt-1 text-sm text-ink-400">{emptyHint ?? t("common.table.emptyHint")}</div>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row, i) => {
                const k = rowKey(row);
                const sel = selected.has(k);
                return (
                  <motion.tr
                    key={k}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: Math.min(i, 12) * 0.025, ease: [0.16, 1, 0.3, 1] }}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      "border-b border-line transition-colors last:border-0",
                      onRowClick && "cursor-pointer",
                      sel ? "bg-gold-500/6" : "hover:bg-fg/[0.025]",
                    )}
                  >
                    {selectable && (
                      <td className={cellPad} onClick={(e) => e.stopPropagation()}>
                        <Check checked={sel} onChange={() => toggleOne(k)} />
                      </td>
                    )}
                    {visibleColumns.map((c) => (
                      <td
                        key={c.key}
                        className={cn(
                          cellPad,
                          "text-ink-100",
                          c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left",
                          c.hideOnMobile && "hidden md:table-cell",
                          c.className,
                        )}
                      >
                        {c.cell ? c.cell(row, i) : String((row as Record<string, unknown>)[c.key] ?? "—")}
                      </td>
                    ))}
                  </motion.tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* pagination */}
      {total > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 border-t border-line px-4 py-3 text-xs text-ink-400 sm:flex-row">
          <div className="flex items-center gap-3">
            <span>{t("common.table.rows", { from, to, total })}</span>
            <span className="hidden sm:inline">·</span>
            <label className="hidden items-center gap-2 sm:flex">
              {t("common.table.perPage")}
              <select
                value={curSize}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (server) server.onPageSizeChange?.(n);
                  else {
                    setPageSize(n);
                    setPage(1);
                  }
                }}
                className="h-7 cursor-pointer rounded-md border border-line bg-ink-850 px-1.5 text-ink-100 focus:outline-none"
              >
                {PAGE_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => goTo(curPage - 1)} disabled={curPage <= 1} aria-label={t("common.actions.previous")}>
              <ArrowLeft2 size={16} />
            </Button>
            {pageNumbers(curPage, pages).map((p, i) =>
              p === "…" ? (
                <span key={`e${i}`} className="px-1.5">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => goTo(p)}
                  className={cn(
                    "h-8 min-w-8 cursor-pointer rounded-lg px-2 font-mono text-xs transition",
                    p === curPage ? "bg-gold-500/15 text-gold-200 ring-1 ring-gold-500/30" : "hover:bg-fg/5 hover:text-stone-100",
                  )}
                >
                  {p}
                </button>
              ),
            )}
            <Button variant="ghost" size="icon-sm" onClick={() => goTo(curPage + 1)} disabled={curPage >= pages} aria-label={t("common.actions.next")}>
              <ArrowRight2 size={16} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function pageNumbers(cur: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const start = Math.max(2, cur - 1);
  const end = Math.min(pages - 1, cur + 1);
  if (start > 2) out.push("…");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < pages - 1) out.push("…");
  out.push(pages);
  return out;
}

function Check({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onChange}
      className={cn(
        "grid size-4.5 cursor-pointer place-items-center rounded-[5px] border transition",
        checked ? "border-gold-400 bg-gold-400 text-onyx" : "border-line-strong hover:border-ink-400",
      )}
    >
      {checked && (
        <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m2.5 6 2.5 2.5 4.5-5" />
        </svg>
      )}
    </button>
  );
}
