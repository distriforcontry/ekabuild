"use client";
import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import type { Icon as IconType } from "iconsax-reactjs";
import { DocumentText, Eye, Flag, Login, Messages2, MoneyRecive, PenTool, Receipt2, SearchStatus, ShieldTick, TickCircle, UserAdd } from "iconsax-reactjs";
import { CountUp } from "@/components/ui/reveal";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip } from "@/components/ui/tooltip";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { Sparkline, chartVar } from "../charts";
import { useFormat } from "../format";
import { delta, type Analytics, type DailyPoint, type TotalKey } from "./types";
import { DeltaPill } from "./ui";

type Kpi = {
  key: TotalKey;
  icon: IconType;
  series?: keyof Omit<DailyPoint, "date">;
  color: string;
  money?: boolean;
  upIsGood?: boolean;
  hero?: boolean;
};

// colour follows the entity — same slots as the daily trend panels
const PRIMARY: Kpi[] = [
  { key: "revenue", icon: MoneyRecive, series: "revenue", color: chartVar(0), money: true, hero: true },
  { key: "views", icon: Eye, series: "views", color: chartVar(1) },
  { key: "certificateLookups", icon: SearchStatus, series: "lookups", color: chartVar(2) },
  { key: "registrations", icon: UserAdd, series: "registrations", color: chartVar(3) },
  { key: "purchases", icon: Receipt2, series: "purchases", color: chartVar(4) },
  { key: "paid", icon: TickCircle, series: "paid", color: chartVar(5) },
  { key: "avgTrust", icon: ShieldTick, color: "var(--color-gold-400)" },
];

const SECONDARY: Kpi[] = [
  { key: "signed", icon: PenTool, color: "" },
  { key: "fileChecks", icon: DocumentText, color: "" },
  { key: "logins", icon: Login, color: "" },
  { key: "supportThreads", icon: Messages2, color: "", upIsGood: false },
  { key: "complaints", icon: Flag, color: "", upIsGood: false },
];

/** ≤ 48 points so long periods stay legible as a sparkline */
function bucket(values: number[], max = 48) {
  if (values.length <= max) return values;
  const size = Math.ceil(values.length / max);
  const out: number[] = [];
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size).reduce((s, v) => s + v, 0));
  return out;
}

export function KpiGrid({ data, loading, error }: { data: Analytics | null; loading: boolean; error: boolean }) {
  const { t } = useI18n();
  const f = useFormat();
  const reduce = useReducedMotion();

  if (!data)
    return (
      <div className={cn("grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4", error && "opacity-50")}>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className={cn("rounded-2xl border border-line bg-ink-900 p-5", i === 0 && "col-span-2")}>
            <div className="flex items-start justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="size-9 rounded-xl" />
            </div>
            <Skeleton className={cn("mt-4 h-8", i === 0 ? "w-48" : "w-24")} />
            <Skeleton className="mt-4 h-9 w-full" />
          </div>
        ))}
      </div>
    );

  const fmt = (k: Kpi, v: number) => (k.money ? f.compactMoney(v) : k.key === "avgTrust" ? String(Math.round(v)) : f.number(v));

  return (
    <div className={cn("space-y-3 transition-opacity md:space-y-4", loading && "opacity-60")}>
      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        {PRIMARY.map((k, i) => {
          const cur = data.totals[k.key];
          const prev = data.previous[k.key];
          const values = k.series ? bucket(data.daily.map((d) => d[k.series!])) : [];
          return (
            <motion.div
              key={k.key}
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
              className={cn(k.hero && "col-span-2", "print:!opacity-100 print:!transform-none")}
            >
              <article
                aria-label={t(`admin.analytics.kpi.${k.key}`)}
                className={cn(
                  "group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-ink-900 p-5 shadow-card transition duration-300 hover:-translate-y-0.5 hover:border-line-strong",
                  k.hero ? "border-gold-500/25 bg-gradient-to-br from-gold-500/[0.08] via-ink-900 to-ink-900" : "border-line",
                )}
              >
                <div className="pointer-events-none absolute -right-12 -top-12 size-36 rounded-full bg-gold-500/5 blur-2xl transition group-hover:bg-gold-500/10" />
                <div className="relative flex items-start justify-between gap-3">
                  <span className="text-xs font-medium uppercase tracking-wider text-ink-400">{t(`admin.analytics.kpi.${k.key}`)}</span>
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-line bg-ink-800 text-gold-300">
                    <k.icon variant="Bulk" size={16} />
                  </span>
                </div>
                <div className="relative mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className={cn("font-semibold tracking-tight text-stone-100", k.hero ? "text-4xl md:text-5xl" : "text-2xl md:text-[28px]")}>
                    {k.money || k.key === "avgTrust" ? fmt(k, cur) : <CountUp value={cur} format={(n) => f.number(n)} />}
                  </span>
                  <Tooltip content={t("admin.analytics.prevValue", { value: fmt(k, prev) })}>
                    <span tabIndex={0} className="cursor-help rounded-full focus-visible:outline-2 focus-visible:outline-gold-400">
                      <DeltaPill value={delta(cur, prev)} upIsGood={k.upIsGood !== false} />
                    </span>
                  </Tooltip>
                </div>
                <div className="relative mt-auto pt-4">
                  {k.series ? (
                    <Sparkline values={values} color={k.color} height={k.hero ? 48 : 34} />
                  ) : (
                    <TrustMeter value={cur} prev={prev} />
                  )}
                  <div className="mt-1.5 text-[11px] text-ink-400">
                    {t("admin.analytics.vsPrev")} · <span className="font-mono">{fmt(k, prev)}</span>
                  </div>
                </div>
              </article>
            </motion.div>
          );
        })}
      </div>

      <div role="list" aria-label={t("admin.analytics.kpi.secondary")} className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3 lg:grid-cols-5">
        {SECONDARY.map((k) => {
          const cur = data.totals[k.key];
          const prev = data.previous[k.key];
          return (
            <div role="listitem" key={k.key} className="flex items-center gap-3 bg-ink-900 px-4 py-3.5 last:col-span-2 sm:last:col-span-1">
              <k.icon size={18} variant="Bulk" className="shrink-0 text-gold-300" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-medium uppercase tracking-wider text-ink-400">{t(`admin.analytics.kpi.${k.key}`)}</div>
                <div className="mt-0.5 flex items-baseline gap-2">
                  <span className="text-lg font-semibold text-stone-100">{f.number(cur)}</span>
                  <DeltaPill value={delta(cur, prev)} upIsGood={k.upIsGood !== false} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 0–100 meter with a tick for the previous period */
function TrustMeter({ value, prev }: { value: number; prev: number }) {
  const v = Math.max(0, Math.min(100, value));
  const p = Math.max(0, Math.min(100, prev));
  return (
    <div className="relative flex h-[34px] items-center" aria-hidden>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-gold-500/12">
        <motion.div
          className="h-full rounded-full bg-gold-gradient"
          initial={{ width: 0 }}
          animate={{ width: `${v}%` }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        />
      </div>
      {prev > 0 && <span className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-stone-100/70" style={{ left: `calc(${p}% - 1px)` }} />}
    </div>
  );
}
