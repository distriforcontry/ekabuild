"use client";
import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { useFormat } from "../format";
import type { UnitMixRow } from "./types";
import { LegendKey, SrTable } from "./ui";

const PARTS = [
  { key: "sold", color: "var(--color-gold-400)" },
  { key: "reserved", color: "var(--chart-2)" },
  { key: "available", color: "var(--color-ink-600)" },
] as const;

/** Stacked status bars by room count, with avg area & price as aligned columns (no second axis). */
export function UnitMix({ rows }: { rows: UnitMixRow[] }) {
  const { t } = useI18n();
  const f = useFormat();
  const reduce = useReducedMotion();
  const [hover, setHover] = React.useState<number | null>(null);
  const roomLabel = (n: number) => (n <= 0 ? t("admin.analytics.units.studio") : t("admin.analytics.units.rooms", { n }));
  const totals = rows.map((r) => r.sold + r.reserved + r.available);
  const max = Math.max(1, ...totals);
  const maxPrice = Math.max(1, ...rows.map((r) => r.avgPrice));

  return (
    <div>
      <SrTable
        caption={t("admin.analytics.units.title")}
        head={[t("admin.analytics.units.total"), t("admin.analytics.units.sold"), t("admin.analytics.units.reserved"), t("admin.analytics.units.available"), t("admin.analytics.units.avgArea"), t("admin.analytics.units.avgPrice")]}
        rows={rows.map((r) => [roomLabel(r.rooms), r.sold, r.reserved, r.available, `${r.avgArea.toFixed(1)} m²`, f.money(r.avgPrice)])}
      />
      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5" aria-hidden>
        {PARTS.map((p) => (
          <LegendKey key={p.key} color={p.color} label={t(`admin.analytics.units.${p.key}`)} shape="square" />
        ))}
      </div>
      <div aria-hidden>
        <div className="mb-2 hidden grid-cols-[88px_1fr_76px_92px] gap-3 text-[10px] font-semibold uppercase tracking-wider text-ink-500 sm:grid">
          <span />
          <span />
          <span className="text-right">{t("admin.analytics.units.avgArea")}</span>
          <span className="text-right">{t("admin.analytics.units.avgPrice")}</span>
        </div>
        <ul className="space-y-2">
          {rows.map((r, i) => {
            const total = totals[i]!;
            const soldPct = total ? Math.round((r.sold / total) * 100) : 0;
            return (
              <li
                key={r.rooms}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                className={cn("grid grid-cols-[72px_1fr] items-center gap-x-3 gap-y-1 rounded-lg px-1 py-1.5 transition sm:grid-cols-[88px_1fr_76px_92px]", hover === i && "bg-fg/5")}
              >
                <span className="text-sm font-medium text-ink-200">{roomLabel(r.rooms)}</span>
                <div className="min-w-0">
                  <div className="flex h-5 items-center" style={{ width: `${Math.max(8, (total / max) * 100)}%` }}>
                    {PARTS.map((p, j) => {
                      const v = r[p.key];
                      if (!v) return null;
                      return (
                        <motion.span
                          key={p.key}
                          className={cn("h-full first:rounded-l-[4px] last:rounded-r-[4px]", j > 0 && "ml-[2px]")}
                          style={{ background: p.color }}
                          initial={reduce ? false : { width: 0 }}
                          animate={{ width: `${(v / total) * 100}%` }}
                          transition={{ duration: 0.9, delay: 0.1 + i * 0.07 + j * 0.05, ease: [0.16, 1, 0.3, 1] }}
                          title={`${t(`admin.analytics.units.${p.key}`)}: ${v}`}
                        />
                      );
                    })}
                  </div>
                  <div className="mt-1 flex gap-3 font-mono text-[11px] text-ink-400">
                    <span>
                      <span className="font-semibold text-stone-100">{total}</span> · {t("admin.analytics.units.soldShare", { pct: `${soldPct}%` })}
                    </span>
                    {hover === i && (
                      <span className="hidden text-ink-300 md:inline">
                        {r.sold} / {r.reserved} / {r.available}
                      </span>
                    )}
                  </div>
                </div>
                <span className="col-start-2 font-mono text-xs text-ink-300 sm:col-start-auto sm:text-right">
                  <span className="sm:hidden">{t("admin.analytics.units.avgArea")}: </span>
                  {r.avgArea ? `${r.avgArea.toFixed(1)} m²` : "—"}
                </span>
                <span className="col-start-2 sm:col-start-auto sm:text-right">
                  <span className="font-mono text-xs font-semibold text-stone-100">{r.avgPrice ? f.compactMoney(r.avgPrice) : "—"}</span>
                  <span className="mt-1 hidden h-1 overflow-hidden rounded-full bg-fg/6 sm:ml-auto sm:block sm:w-16">
                    <span className="block h-full rounded-full bg-gold-400/70" style={{ width: `${(r.avgPrice / maxPrice) * 100}%` }} />
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
