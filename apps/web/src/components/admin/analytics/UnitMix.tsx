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
      <ul className="space-y-4" aria-hidden>
        {rows.map((r, i) => {
          const total = totals[i]!;
          const soldPct = total ? Math.round((r.sold / total) * 100) : 0;
          return (
            <li key={r.rooms} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className={cn("rounded-xl px-2 py-1.5 transition", hover === i && "bg-fg/5")}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="text-sm font-semibold text-stone-100">{roomLabel(r.rooms)}</span>
                <span className="flex items-baseline gap-3 font-mono text-xs text-ink-300">
                  <span title={t("admin.analytics.units.avgArea")}>{r.avgArea ? `${r.avgArea.toFixed(1)} m²` : "—"}</span>
                  <span className="text-ink-500">·</span>
                  <span className="font-semibold text-stone-100" title={t("admin.analytics.units.avgPrice")}>
                    {r.avgPrice ? f.compactMoney(r.avgPrice) : "—"}
                  </span>
                </span>
              </div>
              <div className="mt-2 flex h-3 items-center" style={{ width: `${Math.max(8, (total / max) * 100)}%` }}>
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
                    />
                  );
                })}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[11px] text-ink-400">
                <span>
                  <span className="font-semibold text-stone-100">{f.number(total)}</span> · {t("admin.analytics.units.soldShare", { pct: `${soldPct}%` })}
                </span>
                <span className="ml-auto">
                  {PARTS.map((p) => r[p.key]).join(" / ")}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-[11px] text-ink-400">
        <span>
          {t("admin.analytics.units.avgArea")} · {t("admin.analytics.units.avgPrice")}
        </span>
        <span className="font-mono">
          {PARTS.map((p) => t(`admin.analytics.units.${p.key}`)).join(" / ")}
        </span>
      </div>
    </div>
  );
}
