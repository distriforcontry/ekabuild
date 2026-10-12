"use client";
import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Bar, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltipBox, useChartTheme } from "@/components/admin/charts";
import { useFormat } from "@/components/admin/format";
import { useI18n } from "@/i18n/client";
import type { FinanceSummary, PaymentPlanType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SrTable, useMonthLabel } from "./ui";

/* eslint-disable @typescript-eslint/no-explicit-any */
type TipProps = { active?: boolean; payload?: readonly any[]; label?: string | number };

const DANGER = "var(--color-danger)";

const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/** Legend chip (identity is never colour-alone: swatch + text). */
function LegendItem({ color, label, line, dashed }: { color: string; label: string; line?: boolean; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-300">
      {line ? (
        <svg width="18" height="8" aria-hidden className="shrink-0">
          <line x1="1" y1="4" x2="17" y2="4" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <circle cx="9" cy="4" r="2.5" fill={color} />
        </svg>
      ) : (
        <span className={cn("size-2.5 shrink-0 rounded-[3px]", dashed && "border border-dashed border-ink-400 bg-transparent")} style={dashed ? undefined : { background: color }} />
      )}
      {label}
    </span>
  );
}

/**
 * Monthly cash: collected vs scheduled bars, overdue as a line on the same money axis (one y-scale),
 * the months after "today" shaded as a forecast band.
 */
export function CashflowChart({ data, height = 300 }: { data: FinanceSummary["monthly"]; height?: number }) {
  const { t } = useI18n();
  const f = useFormat();
  const theme = useChartTheme();
  const monthLabel = useMonthLabel();
  const now = monthKey();
  const future = data.filter((d) => d.month > now);
  const collectedColor = theme.gold;
  const scheduledColor = theme.categorical[1]!;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <LegendItem color={collectedColor} label={t("admin.control.finance.cash.collected")} />
        <LegendItem color={scheduledColor} label={t("admin.control.finance.cash.scheduled")} />
        <LegendItem color={DANGER} label={t("admin.control.finance.cash.overdue")} line />
        {future.length > 0 && <LegendItem color="" dashed label={t("admin.control.finance.cash.forecast")} />}
      </div>
      <SrTable
        caption={t("admin.control.finance.cash.title")}
        head={[t("admin.control.finance.cash.month"), t("admin.control.finance.cash.collected"), t("admin.control.finance.cash.scheduled"), t("admin.control.finance.cash.overdue")]}
        rows={data.map((d) => [monthLabel(d.month), f.money(d.collected), f.money(d.scheduled), f.money(d.overdue)])}
      />
      <div style={{ height }} className="w-full" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 18, right: 6, left: 0, bottom: 0 }} barGap={2} barCategoryGap="22%">
            <defs>
              <pattern id="eka-forecast-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="6" stroke={theme.border} strokeWidth="1.5" />
              </pattern>
            </defs>
            <CartesianGrid vertical={false} stroke={theme.grid} />
            {future.length > 0 && (
              <ReferenceArea
                x1={future[0]!.month}
                x2={future[future.length - 1]!.month}
                fill="url(#eka-forecast-hatch)"
                fillOpacity={0.55}
                stroke={theme.border}
                strokeDasharray="4 4"
                ifOverflow="extendDomain"
                label={{ value: t("admin.control.finance.cash.forecast"), position: "insideTopRight", fill: theme.axis, fontSize: 10, offset: 6 }}
              />
            )}
            <XAxis dataKey="month" tickFormatter={monthLabel} tickLine={false} axisLine={{ stroke: theme.grid }} tick={{ fill: theme.axis, fontSize: 11 }} tickMargin={10} minTickGap={8} interval="preserveStartEnd" />
            <YAxis tickFormatter={(v: number) => f.compactMoney(v)} tickLine={false} axisLine={false} width={64} tick={{ fill: theme.axis, fontSize: 11, fontFamily: "var(--font-mono)" }} />
            <ReferenceLine x={now} stroke={theme.gold} strokeOpacity={0.5} strokeDasharray="3 3" label={{ value: t("admin.control.finance.cash.now"), position: "top", fill: theme.gold, fontSize: 10 }} />
            <Tooltip
              cursor={{ fill: theme.grid }}
              content={({ active, payload, label }: TipProps) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as FinanceSummary["monthly"][number];
                const isFuture = row.month > now;
                return (
                  <ChartTooltipBox
                    title={`${monthLabel(String(label))}${isFuture ? ` · ${t("admin.control.finance.cash.forecast")}` : ""}`}
                    rows={[
                      { label: t("admin.control.finance.cash.collected"), value: f.compactMoney(row.collected), color: collectedColor },
                      { label: t("admin.control.finance.cash.scheduled"), value: f.compactMoney(row.scheduled), color: scheduledColor },
                      { label: t("admin.control.finance.cash.overdue"), value: f.compactMoney(row.overdue), color: DANGER },
                    ]}
                  />
                );
              }}
            />
            <Bar dataKey="collected" fill={collectedColor} radius={[4, 4, 0, 0]} maxBarSize={22} animationDuration={900} />
            <Bar dataKey="scheduled" fill={scheduledColor} radius={[4, 4, 0, 0]} maxBarSize={22} animationDuration={900}>
              {data.map((d) => (
                <Cell key={d.month} fillOpacity={d.month > now ? 0.55 : 0.9} />
              ))}
            </Bar>
            <Line
              type="monotone"
              dataKey="overdue"
              stroke={DANGER}
              strokeWidth={2}
              dot={(p: { cx?: number; cy?: number; payload?: { overdue: number }; index?: number }) =>
                p.payload && p.payload.overdue > 0 && p.cx != null && p.cy != null ? (
                  <circle key={p.index} cx={p.cx} cy={p.cy} r={4} fill={DANGER} stroke={theme.surface} strokeWidth={2} />
                ) : (
                  <g key={p.index} />
                )
              }
              activeDot={{ r: 5, fill: DANGER, stroke: theme.surface, strokeWidth: 2 }}
              animationDuration={900}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** FULL vs INSTALLMENT donut (deal count in the ring, amounts in the legend). */
export function PlanDonut({ data, size = 176 }: { data: FinanceSummary["byPlan"]; size?: number }) {
  const { t, label } = useI18n();
  const f = useFormat();
  const theme = useChartTheme();
  const [active, setActive] = React.useState<number | null>(null);
  const order: PaymentPlanType[] = ["FULL", "INSTALLMENT"];
  const rows = order.map((p, i) => {
    const d = data.find((x) => x.planType === p);
    return { planType: p, count: d?.count ?? 0, amount: d?.amount ?? 0, name: label("paymentPlan", p), color: theme.categorical[i]! };
  });
  const total = rows.reduce((s, r) => s + r.count, 0);
  const totalAmount = rows.reduce((s, r) => s + r.amount, 0);
  const shown = active != null ? rows[active] : null;

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row xl:flex-col 2xl:flex-row">
      <SrTable
        caption={t("admin.control.finance.plan.title")}
        head={["", t("admin.control.finance.plan.total"), t("admin.control.finance.projects.contracted")]}
        rows={rows.map((r) => [r.name, r.count, f.money(r.amount)])}
      />
      <div className="relative shrink-0" style={{ width: size, height: size }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={rows}
              dataKey="count"
              nameKey="name"
              innerRadius="70%"
              outerRadius="96%"
              paddingAngle={total && rows.every((r) => r.count) ? 3 : 0}
              cornerRadius={4}
              stroke={theme.surface}
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
              onMouseEnter={(_: unknown, i: number) => setActive(i)}
              onMouseLeave={() => setActive(null)}
              animationDuration={900}
            >
              {rows.map((r, i) => (
                <Cell key={r.planType} fill={r.color} opacity={active == null || active === i ? 1 : 0.35} style={{ transition: "opacity .2s" }} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="font-mono text-3xl font-semibold text-stone-100">{shown ? shown.count : total}</div>
            <div className="mt-0.5 max-w-24 truncate text-[11px] text-ink-400">{shown ? shown.name : t("admin.control.finance.plan.total")}</div>
          </div>
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-2">
        {rows.map((r, i) => {
          const pct = totalAmount ? Math.round((r.amount / totalAmount) * 100) : 0;
          return (
            <li
              key={r.planType}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              className={cn("rounded-xl border border-line px-3 py-2.5 transition", active === i ? "bg-fg/5" : "bg-ink-850/50")}
            >
              <div className="flex items-center gap-2 text-sm">
                <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: r.color }} />
                <span className="min-w-0 flex-1 truncate font-medium text-ink-100">{r.name}</span>
                <span className="font-mono text-xs text-ink-400">{pct}%</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-2 pl-[18px]">
                <span className="font-mono text-sm font-semibold text-stone-100">{f.compactMoney(r.amount)}</span>
                <span className="text-[11px] text-ink-400">{t("admin.control.finance.plan.deals", { n: r.count })}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Per-project receivables as bullet bars: track = contracted, gold = collected, red tick-range = overdue. */
export function ProjectFinanceBars({ data, hrefFor }: { data: FinanceSummary["byProject"]; hrefFor?: (id: string) => string | null }) {
  const { t, tr } = useI18n();
  const f = useFormat();
  const reduce = useReducedMotion();
  const max = Math.max(1, ...data.map((d) => d.contracted));
  return (
    <div>
      <SrTable
        caption={t("admin.control.finance.projects.title")}
        head={[t("admin.control.finance.projects.project"), t("admin.control.finance.projects.contracted"), t("admin.control.finance.projects.collected"), t("admin.control.finance.projects.overdue")]}
        rows={data.map((d) => [tr(d.name), f.money(d.contracted), f.money(d.collected), f.money(d.overdue)])}
      />
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5" aria-hidden>
        <LegendItem color="var(--color-gold-400)" label={t("admin.control.finance.projects.collected")} />
        <LegendItem color="color-mix(in oklab, var(--color-ink-400) 35%, transparent)" label={t("admin.control.finance.projects.contracted")} />
        <LegendItem color={DANGER} label={t("admin.control.finance.projects.overdue")} />
      </div>
      <ul className="grid gap-x-10 gap-y-4 lg:grid-cols-2">
        {data.map((d, i) => {
          const rate = d.contracted ? Math.round((d.collected / d.contracted) * 100) : 0;
          const href = hrefFor?.(d.id);
          const name = <span className="truncate text-sm font-medium text-ink-100">{tr(d.name)}</span>;
          return (
            <li key={d.id} className="group">
              <div className="mb-1.5 flex items-baseline gap-3">
                {href ? (
                  <Link href={href} className="min-w-0 flex-1 truncate transition hover:text-gold-300">
                    {name}
                  </Link>
                ) : (
                  <span className="min-w-0 flex-1 truncate">{name}</span>
                )}
                <span className="shrink-0 font-mono text-xs text-ink-300">
                  <span className="text-stone-100">{f.compactMoney(d.collected)}</span>
                  <span className="text-ink-500"> / {f.compactMoney(d.contracted)}</span>
                </span>
                <span className={cn("w-10 shrink-0 text-right font-mono text-xs font-semibold", rate >= 80 ? "text-success" : rate >= 50 ? "text-gold-300" : "text-warning")}>{rate}%</span>
              </div>
              <div className="relative h-2.5 overflow-hidden rounded-full bg-fg/[0.05]" style={{ width: `${Math.max(8, (d.contracted / max) * 100)}%` }}>
                <div className="absolute inset-0 rounded-full bg-[color-mix(in_oklab,var(--color-ink-400)_35%,transparent)]" />
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full bg-gold-gradient"
                  initial={reduce ? false : { width: 0 }}
                  animate={{ width: `${d.contracted ? (d.collected / d.contracted) * 100 : 0}%` }}
                  transition={{ duration: 1, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                />
                {d.overdue > 0 && (
                  <div
                    className="absolute inset-y-0 rounded-full bg-danger ring-2 ring-ink-900"
                    style={{ left: `${(d.collected / d.contracted) * 100}%`, width: `${Math.max(1.5, (d.overdue / d.contracted) * 100)}%` }}
                    title={f.money(d.overdue)}
                  />
                )}
              </div>
              {d.overdue > 0 && (
                <div className="mt-1 text-[11px] text-danger">
                  {t("admin.control.finance.projects.overdue")}: <span className="font-mono">{f.compactMoney(d.overdue)}</span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
