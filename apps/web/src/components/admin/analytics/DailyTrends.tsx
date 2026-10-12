"use client";
import * as React from "react";
import { Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useI18n } from "@/i18n/client";
import { ChartTooltipBox, chartVar } from "../charts";
import { useFormat } from "../format";
import type { DailyPoint } from "./types";
import { LegendToggle, SrTable } from "./ui";

type SeriesKey = keyof Omit<DailyPoint, "date">;
type Series = { key: SeriesKey; slot: number; panel: "traffic" | "conversions" | "money" };

// colour follows the entity (same slots as the KPI sparklines)
const SERIES: Series[] = [
  { key: "views", slot: 1, panel: "traffic" },
  { key: "lookups", slot: 2, panel: "traffic" },
  { key: "registrations", slot: 3, panel: "conversions" },
  { key: "purchases", slot: 4, panel: "conversions" },
  { key: "paid", slot: 5, panel: "conversions" },
  { key: "revenue", slot: 0, panel: "money" },
];
const PANELS = [
  { key: "traffic", height: 210 },
  { key: "conversions", height: 170 },
  { key: "money", height: 170 },
] as const;

/* eslint-disable @typescript-eslint/no-explicit-any */
type TipProps = { active?: boolean; payload?: readonly any[]; label?: string | number };

/**
 * Daily dynamics as three synced small multiples (one y-scale each) — traffic, conversions and money never
 * share an axis, so the money scale can't invent a correlation; the crosshair moves across all panels together.
 */
export function DailyTrends({ data, days }: { data: DailyPoint[]; days: number }) {
  const { t } = useI18n();
  const f = useFormat();
  const [on, setOn] = React.useState<Record<SeriesKey, boolean>>({ views: true, lookups: true, registrations: true, purchases: true, paid: true, revenue: true });
  const syncId = React.useId();
  const label = (k: SeriesKey) => t(`admin.analytics.trends.${k}`);
  const fmtDate = (d: string) => f.shortDate(`${d}T00:00:00`);
  const dense = data.length > 120;

  const visiblePanels = PANELS.filter((p) => SERIES.some((s) => s.panel === p.key && on[s.key]));
  const lastPanel = visiblePanels[visiblePanels.length - 1]?.key;

  return (
    <div>
      <div role="group" aria-label={t("admin.analytics.trends.series")} className="mb-4 flex flex-wrap gap-2 print:hidden">
        {SERIES.map((s) => (
          <LegendToggle
            key={s.key}
            color={chartVar(s.slot)}
            label={label(s.key)}
            active={on[s.key]}
            onToggle={() => setOn((o) => ({ ...o, [s.key]: !o[s.key] }))}
            // keep at least one series visible
            disabled={on[s.key] && Object.values(on).filter(Boolean).length === 1}
          />
        ))}
      </div>

      <SrTable
        caption={t("admin.analytics.trends.title")}
        head={[t("admin.analytics.trends.date"), ...SERIES.map((s) => label(s.key))]}
        rows={data.map((d) => [d.date, ...SERIES.map((s) => (s.key === "revenue" ? f.money(d.revenue) : f.number(d[s.key])))])}
      />

      <div className="space-y-1" aria-hidden>
        {visiblePanels.map((p) => {
          const series = SERIES.filter((s) => s.panel === p.key && on[s.key]);
          const money = p.key === "money";
          const showX = p.key === lastPanel;
          return (
            <div key={p.key}>
              <div className="mb-1 flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{t(`admin.analytics.trends.${p.key}`)}</span>
                <span className="font-mono text-[11px] text-ink-400">
                  Σ {series.map((s) => (money ? f.compactMoney(sum(data, s.key)) : f.number(sum(data, s.key)))).join(" · ")}
                </span>
              </div>
              <div style={{ height: p.height + (showX ? 26 : 0) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data} syncId={syncId} margin={{ top: 6, right: 6, left: 0, bottom: 0 }} barCategoryGap={dense ? 0 : "18%"}>
                    <defs>
                      {series.map((s) => (
                        <linearGradient key={s.key} id={`trend-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={chartVar(s.slot)} stopOpacity={0.22} />
                          <stop offset="100%" stopColor={chartVar(s.slot)} stopOpacity={0} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid vertical={false} stroke="var(--color-line)" />
                    <XAxis
                      dataKey="date"
                      hide={!showX}
                      tickFormatter={fmtDate}
                      tickLine={false}
                      axisLine={{ stroke: "var(--color-line)" }}
                      tick={{ fill: "var(--color-ink-400)", fontSize: 11 }}
                      tickMargin={8}
                      minTickGap={28}
                      height={26}
                    />
                    <YAxis
                      tickFormatter={(v: number) => (money ? f.compactMoney(v) : compact(v))}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                      width={money ? 76 : 44}
                      tick={{ fill: "var(--color-ink-400)", fontSize: 11, fontFamily: "var(--font-mono)" }}
                    />
                    <Tooltip
                      cursor={money && !dense ? { fill: "var(--color-line)" } : { stroke: "var(--color-line-strong)", strokeWidth: 1 }}
                      content={({ active, payload, label: l }: TipProps) =>
                        active && payload?.length ? (
                          <ChartTooltipBox
                            title={fmtDate(String(l))}
                            rows={payload.map((pl) => {
                              const s = SERIES.find((x) => x.key === pl.dataKey)!;
                              return { label: label(s.key), value: s.key === "revenue" ? f.money(Number(pl.value)) : f.number(Number(pl.value)), color: chartVar(s.slot) };
                            })}
                          />
                        ) : null
                      }
                    />
                    {series.map((s) =>
                      money ? (
                        days > 90 ? (
                          <Area key={s.key} type="monotone" dataKey={s.key} stroke={chartVar(s.slot)} strokeWidth={2} fill={`url(#trend-${s.key})`} dot={false} activeDot={{ r: 4, stroke: "var(--color-ink-900)", strokeWidth: 2 }} animationDuration={900} />
                        ) : (
                          <Bar key={s.key} dataKey={s.key} fill={chartVar(s.slot)} radius={[4, 4, 0, 0]} maxBarSize={18} animationDuration={900} />
                        )
                      ) : s.key === "views" ? (
                        <Area key={s.key} type="monotone" dataKey={s.key} stroke={chartVar(s.slot)} strokeWidth={2} fill={`url(#trend-${s.key})`} dot={false} activeDot={{ r: 4, stroke: "var(--color-ink-900)", strokeWidth: 2 }} animationDuration={900} />
                      ) : (
                        <Line key={s.key} type="linear" dataKey={s.key} stroke={chartVar(s.slot)} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "var(--color-ink-900)", strokeWidth: 2 }} animationDuration={900} />
                      ),
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const sum = (data: DailyPoint[], k: SeriesKey) => data.reduce((s, d) => s + d[k], 0);
const compact = (v: number) => (v >= 1_000_000 ? `${+(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${+(v / 1000).toFixed(1)}K` : String(v));
