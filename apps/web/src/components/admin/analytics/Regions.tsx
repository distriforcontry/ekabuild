"use client";
import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { goldRamp } from "../charts";
import { useFormat } from "../format";
import type { RegionRow } from "./types";
import { LegendKey, Segmented, SrTable } from "./ui";

/** Uzbekistan as an equal-area tile grid (col, row) — roughly west → east. */
const TILES: Record<string, { col: number; row: number; code: string }> = {
  "Qoraqalpog'iston": { col: 0, row: 0, code: "QQR" },
  Xorazm: { col: 0, row: 1, code: "XOR" },
  Navoiy: { col: 1, row: 0, code: "NAV" },
  Buxoro: { col: 1, row: 1, code: "BUX" },
  Samarqand: { col: 2, row: 1, code: "SAM" },
  Qashqadaryo: { col: 2, row: 2, code: "QSH" },
  Surxondaryo: { col: 3, row: 2, code: "SUR" },
  Jizzax: { col: 3, row: 1, code: "JIZ" },
  Sirdaryo: { col: 4, row: 1, code: "SIR" },
  "Toshkent shahri": { col: 4, row: 0, code: "TSH" },
  "Toshkent viloyati": { col: 5, row: 0, code: "TSV" },
  Namangan: { col: 6, row: 0, code: "NAM" },
  "Farg'ona": { col: 6, row: 1, code: "FAR" },
  Andijon: { col: 7, row: 1, code: "AND" },
};
const norm = (s: string) => s.toLowerCase().replace(/[‘’ʻʼ`']/g, "").replace(/\s+/g, " ").trim();
const TILE_BY_NORM = new Map(Object.entries(TILES).map(([k, v]) => [norm(k), { name: k, ...v }]));

export type RegionMetric = "projects" | "sold" | "revenue" | "avgTrust" | "avgPricePerSqm";
const METRICS: RegionMetric[] = ["revenue", "sold", "projects", "avgTrust", "avgPricePerSqm"];

export function RegionsMetricSwitch({ value, onChange }: { value: RegionMetric; onChange: (m: RegionMetric) => void }) {
  const { t } = useI18n();
  return <Segmented label={t("admin.analytics.regions.metric")} value={value} onChange={onChange} options={METRICS.map((m) => ({ value: m, label: t(`admin.analytics.regions.${m}`) }))} />;
}

export function Regions({ rows, metric }: { rows: RegionRow[]; metric: RegionMetric }) {
  const { t, tr } = useI18n();
  const f = useFormat();
  const reduce = useReducedMotion();
  const [active, setActive] = React.useState<string | null>(null);

  const byTile = new Map<string, RegionRow>();
  for (const r of rows) {
    const tile = TILE_BY_NORM.get(norm(r.region));
    if (tile) byTile.set(tile.name, r);
  }
  const fmt = (m: RegionMetric, v: number) =>
    m === "revenue" || m === "avgPricePerSqm" ? f.compactMoney(v) : m === "avgTrust" ? String(Math.round(v)) : f.number(v);
  // tiles are narrow: drop the decimal once the integer part has 2+ digits ("175 mlrd")
  const short = (m: RegionMetric, v: number) => fmt(m, v).replace(/(\d{2,})[.,]\d(?=\s)/, "$1");
  const values = rows.map((r) => r[metric]);
  const max = Math.max(0, ...values);
  const min = Math.min(...values.filter((v) => v > 0), max);

  const focusRow =
    (active && rows.find((r) => TILE_BY_NORM.get(norm(r.region))?.name === active)) || [...rows].sort((a, b) => b[metric] - a[metric])[0] || null;

  const bars = [...rows].map((r) => ({ ...r, units: r.sold + r.available })).sort((a, b) => b.units - a.units || b.projects - a.projects);
  const maxUnits = Math.max(1, ...bars.map((b) => b.units));

  return (
    <div className="grid gap-8 xl:grid-cols-5">
      <div className="xl:col-span-3">
        <SrTable
          caption={t("admin.analytics.regions.title")}
          head={[t("admin.analytics.regions.region"), t(`admin.analytics.regions.${metric}`)]}
          rows={rows.map((r) => [tr(r.region), fmt(metric, r[metric])])}
        />
        <div className="grid grid-cols-8 gap-1.5 sm:gap-2" aria-hidden>
          {Array.from({ length: 24 }).map((_, idx) => {
            const col = idx % 8;
            const row = Math.floor(idx / 8);
            const entry = Object.entries(TILES).find(([, v]) => v.col === col && v.row === row);
            if (!entry) return <div key={idx} />;
            const [name, tile] = entry;
            const r = byTile.get(name);
            const v = r ? r[metric] : 0;
            const tnorm = max > 0 ? v / max : 0;
            const has = Boolean(r && (r.projects || v));
            const strong = tnorm > 0.55;
            return (
              <motion.div
                key={name}
                initial={reduce ? false : { opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: reduce ? 0 : (col + row) * 0.04, ease: [0.16, 1, 0.3, 1] }}
                onMouseEnter={() => setActive(name)}
                onMouseLeave={() => setActive(null)}
                title={`${tr(name)} — ${r ? fmt(metric, v) : t("admin.analytics.regions.noProjects")}`}
                className={cn(
                  "relative flex aspect-[1/0.9] flex-col justify-between overflow-hidden rounded-lg border p-1.5 transition duration-200 sm:rounded-xl sm:p-2",
                  has ? "border-transparent" : "border-dashed border-line-strong",
                  active === name && "z-10 scale-[1.06] shadow-lift ring-2 ring-gold-400/70",
                )}
                style={{ background: has ? goldRamp(0.12 + tnorm * 0.88) : "transparent" }}
              >
                <span className={cn("truncate font-mono text-[9px] font-bold tracking-wider sm:text-[11px]", has && strong ? "text-ink-950/70" : "text-ink-300")}>{tr(tile.code)}</span>
                <span className={cn("hidden truncate text-[10px] font-semibold tracking-tight sm:block sm:text-[13px]", has ? (strong ? "text-ink-950" : "text-stone-100") : "text-ink-500")}>
                  {has ? short(metric, v) : "—"}
                </span>
              </motion.div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[11px] text-ink-400">
          <div className="flex items-center gap-2">
            <span>{t("admin.analytics.regions.less")}</span>
            <span className="h-2 w-28 rounded-full" style={{ background: `linear-gradient(90deg, ${goldRamp(0.12)}, ${goldRamp(1)})` }} />
            <span>{t("admin.analytics.regions.more")}</span>
            {max > 0 && (
              <span className="ml-1 font-mono">
                {fmt(metric, min)} – {fmt(metric, max)}
              </span>
            )}
          </div>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px] border border-dashed border-line-strong" /> {t("admin.analytics.regions.noProjects")}
          </span>
        </div>
        {focusRow && (
          <div className="mt-4 rounded-xl border border-line bg-ink-850/60 p-4" aria-live="polite">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-gold-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-gold-200">{tr(TILE_BY_NORM.get(norm(focusRow.region))?.code ?? "—")}</span>
              <span className="text-sm font-semibold text-stone-100">{tr(focusRow.region)}</span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-5">
              {(
                [
                  ["projects", f.number(focusRow.projects)],
                  ["units", `${f.number(focusRow.sold)} / ${f.number(focusRow.sold + focusRow.available)}`],
                  ["revenue", f.compactMoney(focusRow.revenue)],
                  ["avgTrust", String(Math.round(focusRow.avgTrust))],
                  ["avgPricePerSqm", f.compactMoney(focusRow.avgPricePerSqm)],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="truncate text-[10px] uppercase tracking-wider text-ink-400">{t(`admin.analytics.regions.${k}`)}</dt>
                  <dd className={cn("truncate font-mono text-sm", k === metric ? "font-semibold text-gold-200" : "text-stone-100")}>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>

      <div className="xl:col-span-2">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{t("admin.analytics.regions.soldVsAvailable")}</h4>
          <div className="flex gap-3">
            <LegendKey color="var(--color-gold-400)" label={t("admin.analytics.regions.sold")} shape="square" />
            <LegendKey color="var(--color-ink-600)" label={t("admin.analytics.regions.available")} shape="square" />
          </div>
        </div>
        <ul className="space-y-2.5">
          {bars.slice(0, 8).map((b, i) => {
            const tile = TILE_BY_NORM.get(norm(b.region));
            return (
              <li
                key={b.region}
                onMouseEnter={() => tile && setActive(tile.name)}
                onMouseLeave={() => setActive(null)}
                className={cn("rounded-lg px-2 py-1 transition", tile && active === tile.name && "bg-fg/5")}
              >
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate text-ink-200">{tr(b.region)}</span>
                  <span className="shrink-0 font-mono text-xs text-ink-400">
                    <span className="font-semibold text-stone-100">{f.number(b.sold)}</span> / {f.number(b.units)}
                  </span>
                </div>
                <div className="mt-1.5 flex h-2 overflow-hidden rounded-full" style={{ width: `${Math.max(6, (b.units / maxUnits) * 100)}%` }}>
                  <motion.span
                    className="h-full rounded-l-full bg-gold-400"
                    initial={reduce ? false : { width: 0 }}
                    animate={{ width: `${b.units ? (b.sold / b.units) * 100 : 0}%` }}
                    transition={{ duration: 0.9, delay: 0.1 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                  />
                  {b.sold > 0 && b.available > 0 && <span className="h-full w-0.5 shrink-0 bg-ink-900" />}
                  <span className="h-full flex-1 rounded-r-full bg-ink-600" />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export function RegionsTable({ rows }: { rows: RegionRow[] }) {
  const { t, tr } = useI18n();
  const f = useFormat();
  const columns: Column<RegionRow>[] = [
    { key: "region", header: t("admin.analytics.regions.region"), cell: (r) => <span className="font-medium text-stone-100">{tr(r.region)}</span>, sortValue: (r) => r.region, exportValue: (r) => r.region, alwaysVisible: true },
    { key: "projects", header: t("admin.analytics.regions.projects"), align: "right", cell: (r) => <span className="font-mono">{f.number(r.projects)}</span>, sortValue: (r) => r.projects, exportValue: (r) => r.projects },
    { key: "sold", header: t("admin.analytics.regions.sold"), align: "right", cell: (r) => <span className="font-mono">{f.number(r.sold)}</span>, sortValue: (r) => r.sold, exportValue: (r) => r.sold },
    { key: "available", header: t("admin.analytics.regions.available"), align: "right", hideOnMobile: true, cell: (r) => <span className="font-mono">{f.number(r.available)}</span>, sortValue: (r) => r.available, exportValue: (r) => r.available },
    { key: "revenue", header: t("admin.analytics.regions.revenue"), align: "right", cell: (r) => <span className="font-mono text-stone-100">{f.compactMoney(r.revenue)}</span>, sortValue: (r) => r.revenue, exportValue: (r) => r.revenue },
    { key: "avgTrust", header: t("admin.analytics.regions.avgTrust"), align: "right", hideOnMobile: true, cell: (r) => <TrustCell value={r.avgTrust} />, sortValue: (r) => r.avgTrust, exportValue: (r) => Math.round(r.avgTrust) },
    { key: "avgPricePerSqm", header: t("admin.analytics.regions.avgPricePerSqm"), align: "right", hideOnMobile: true, cell: (r) => <span className="font-mono">{f.compactMoney(r.avgPricePerSqm)}</span>, sortValue: (r) => r.avgPricePerSqm, exportValue: (r) => r.avgPricePerSqm },
  ];
  return (
    <DataTable
      columns={columns}
      data={rows}
      rowKey={(r) => r.region}
      exportName="analytics-regions"
      initialSort={{ key: "revenue", dir: "desc" }}
      pageSize={20}
      dense
      className="rounded-none border-x-0 border-b-0 bg-transparent shadow-none"
    />
  );
}

/** Small inline 0–100 bar + number (shared by the analytics tables). */
export function TrustCell({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  const tone = v >= 85 ? "bg-success" : v >= 65 ? "bg-gold-400" : v >= 40 ? "bg-warning" : "bg-danger";
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-fg/8 sm:block">
        <span className={cn("block h-full rounded-full", tone)} style={{ width: `${v}%` }} />
      </span>
      <span className="w-7 text-right font-mono text-stone-100">{Math.round(v)}</span>
    </span>
  );
}
