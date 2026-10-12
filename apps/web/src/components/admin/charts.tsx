"use client";
import * as React from "react";
import { useTheme } from "next-themes";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PROJECT_STATUSES, type ProjectStatus } from "@eka/shared";
import { cn } from "@/lib/utils";

/* ───────────────────────────── Theme-aware colours ───────────────────────────── */

export type ChartTheme = {
  gold: string;
  goldDeep: string;
  grid: string;
  axis: string;
  text: string;
  strong: string;
  surface: string;
  raised: string;
  border: string;
  /** categorical slots, validated for CVD separation on each surface (fixed order, never cycled) */
  categorical: string[];
  dark: boolean;
};

// Validated with the dataviz palette checker: adjacent CVD ΔE ≥ 9, normal-vision ΔE ≥ 18, both surfaces.
const CATEGORICAL_DARK = ["#b5873a", "#3987e5", "#d95926", "#199e70", "#9085e9", "#d55181"];
const CATEGORICAL_LIGHT = ["#a87a2c", "#2a78d6", "#eb6834", "#1baf7a", "#6250d6", "#e87ba4"];

const FALLBACK: ChartTheme = {
  gold: "#d4af6a",
  goldDeep: "#8e6e3c",
  grid: "rgba(255,255,255,0.08)",
  axis: "#6b6f7a",
  text: "#c4c7ce",
  strong: "#f4f1ea",
  surface: "#111215",
  raised: "#1c1d22",
  border: "rgba(255,255,255,0.14)",
  categorical: CATEGORICAL_DARK,
  dark: true,
};

/** Reads design tokens from CSS variables; re-reads whenever the theme changes. */
export function useChartTheme(): ChartTheme {
  const { resolvedTheme } = useTheme();
  const [theme, setTheme] = React.useState<ChartTheme>(FALLBACK);

  React.useEffect(() => {
    const read = () => {
      const s = getComputedStyle(document.documentElement);
      const v = (name: string, fb: string) => s.getPropertyValue(name).trim() || fb;
      const dark = document.documentElement.getAttribute("data-theme") !== "light";
      setTheme({
        gold: v("--color-gold-400", FALLBACK.gold),
        goldDeep: v("--color-gold-700", FALLBACK.goldDeep),
        grid: v("--color-line", FALLBACK.grid),
        axis: v("--color-ink-400", FALLBACK.axis),
        text: v("--color-ink-200", FALLBACK.text),
        strong: v("--color-stone-100", FALLBACK.strong),
        surface: v("--color-ink-900", FALLBACK.surface),
        raised: v("--color-ink-800", FALLBACK.raised),
        border: v("--color-line-strong", FALLBACK.border),
        categorical: dark ? CATEGORICAL_DARK : CATEGORICAL_LIGHT,
        dark,
      });
    };
    // next-themes writes data-theme in an effect — read on the next frame and on attribute changes
    const raf = requestAnimationFrame(read);
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class", "style"] });
    return () => {
      cancelAnimationFrame(raf);
      mo.disconnect();
    };
  }, [resolvedTheme]);

  return theme;
}

/** Colour follows the entity: each project status always gets the same slot. */
export const statusColor = (theme: ChartTheme, status: ProjectStatus | string) => {
  const i = PROJECT_STATUSES.indexOf(status as ProjectStatus);
  return theme.categorical[i >= 0 ? i % theme.categorical.length : theme.categorical.length - 1]!;
};

/* ───────────────────────────── Tooltip ───────────────────────────── */

type TipRow = { label: string; value: string; color?: string };

export function ChartTooltipBox({ title, rows }: { title?: string; rows: TipRow[] }) {
  return (
    <div className="min-w-36 rounded-xl border border-line-strong bg-ink-800/95 px-3 py-2.5 text-xs shadow-lift backdrop-blur-md">
      {title && <div className="mb-1.5 font-semibold text-stone-100">{title}</div>}
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2">
            {r.color && <span className="size-2 shrink-0 rounded-full" style={{ background: r.color }} />}
            <span className="flex-1 text-ink-300">{r.label}</span>
            <span className="font-mono font-semibold text-stone-100">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type TipProps = { active?: boolean; payload?: readonly any[]; label?: string | number };

/* ───────────────────────────── Area: purchases by month ───────────────────────────── */

export function PurchasesAreaChart({
  data,
  metric,
  format,
  formatLabel,
  seriesLabel,
  secondary,
  height = 280,
}: {
  data: { month: string; count: number; amount: number }[];
  metric: "count" | "amount";
  format: (v: number) => string;
  formatLabel: (month: string) => string;
  seriesLabel: string;
  /** the other measure, shown in the tooltip only (one y-axis per chart) */
  secondary?: { label: string; format: (v: number) => string };
  height?: number;
}) {
  const theme = useChartTheme();
  const id = React.useId().replace(/:/g, "");
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`gold-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={theme.gold} stopOpacity={theme.dark ? 0.42 : 0.32} />
              <stop offset="100%" stopColor={theme.gold} stopOpacity={0} />
            </linearGradient>
            <linearGradient id={`stroke-${id}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={theme.goldDeep} />
              <stop offset="60%" stopColor={theme.gold} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={theme.grid} />
          <XAxis
            dataKey="month"
            tickFormatter={formatLabel}
            tickLine={false}
            axisLine={{ stroke: theme.grid }}
            tick={{ fill: theme.axis, fontSize: 11 }}
            tickMargin={10}
            minTickGap={16}
          />
          <YAxis
            tickFormatter={(v: number) => format(v)}
            tickLine={false}
            axisLine={false}
            tick={{ fill: theme.axis, fontSize: 11, fontFamily: "var(--font-mono)" }}
            width={metric === "amount" ? 72 : 40}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ stroke: theme.border, strokeWidth: 1 }}
            content={({ active, payload, label }: TipProps) =>
              active && payload?.length ? (
                <ChartTooltipBox
                  title={formatLabel(String(label))}
                  rows={[
                    { label: seriesLabel, value: format(Number(payload[0].value)), color: theme.gold },
                    ...(secondary
                      ? [{ label: secondary.label, value: secondary.format(Number(payload[0].payload[metric === "count" ? "amount" : "count"])) }]
                      : []),
                  ]}
                />
              ) : null
            }
          />
          <Area
            type="monotone"
            dataKey={metric}
            stroke={`url(#stroke-${id})`}
            strokeWidth={2}
            fill={`url(#gold-${id})`}
            activeDot={{ r: 5, fill: theme.gold, stroke: theme.surface, strokeWidth: 2 }}
            dot={false}
            animationDuration={900}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ───────────────────────────── Donut: projects by status ───────────────────────────── */

export function StatusDonut({
  data,
  labelFor,
  totalLabel,
  unit,
  size = 220,
}: {
  data: { status: string; count: number }[];
  labelFor: (status: string) => string;
  totalLabel: string;
  unit: string;
  size?: number;
}) {
  const theme = useChartTheme();
  const [active, setActive] = React.useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.count, 0);
  const rows = data.map((d) => ({ ...d, name: labelFor(d.status), color: statusColor(theme, d.status) }));
  const shown = active != null ? rows[active] : null;

  return (
    <div className="flex flex-col items-center gap-6 2xl:flex-row 2xl:items-center">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={rows}
              dataKey="count"
              nameKey="name"
              innerRadius="68%"
              outerRadius="96%"
              paddingAngle={rows.length > 1 ? 2 : 0}
              cornerRadius={4}
              stroke={theme.surface}
              strokeWidth={2}
              onMouseEnter={(_: unknown, i: number) => setActive(i)}
              onMouseLeave={() => setActive(null)}
              animationDuration={900}
              label={false}
            >
              {rows.map((r, i) => (
                <Cell key={r.status} fill={r.color} opacity={active == null || active === i ? 1 : 0.35} style={{ transition: "opacity .2s" }} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="font-mono text-3xl font-semibold text-stone-100">{shown ? shown.count : total}</div>
            <div className="mt-0.5 max-w-28 truncate text-[11px] text-ink-400">{shown ? shown.name : totalLabel}</div>
          </div>
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-1.5">
        {rows.map((r, i) => {
          const pct = total ? Math.round((r.count / total) * 100) : 0;
          return (
            <li
              key={r.status}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              className={cn("flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition", active === i && "bg-fg/5")}
            >
              <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: r.color }} />
              <span className="min-w-0 flex-1 truncate text-ink-200">{r.name}</span>
              <span className="font-mono text-xs text-ink-400">{pct}%</span>
              <span className="w-8 text-right font-mono text-sm font-semibold text-stone-100" title={`${r.count} ${unit}`}>
                {r.count}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ───────────────────────────── Horizontal bars: projects by region ───────────────────────────── */

export function RegionBars({ data, unit, labelFor }: { data: { region: string; count: number }[]; unit: string; labelFor?: (r: string) => string }) {
  const theme = useChartTheme();
  const rows = [...data].sort((a, b) => b.count - a.count).slice(0, 10).map((d) => ({ ...d, name: labelFor ? labelFor(d.region) : d.region }));
  const height = Math.max(160, rows.length * 34 + 16);
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }} barCategoryGap={8}>
          <CartesianGrid horizontal={false} stroke={theme.grid} />
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={128}
            tickLine={false}
            axisLine={false}
            tick={{ fill: theme.text, fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: theme.grid }}
            content={({ active, payload }: TipProps) =>
              active && payload?.length ? (
                <ChartTooltipBox title={payload[0].payload.name} rows={[{ label: unit, value: String(payload[0].value), color: theme.gold }]} />
              ) : null
            }
          />
          <Bar
            dataKey="count"
            fill={theme.gold}
            radius={[0, 4, 4, 0]}
            maxBarSize={18}
            animationDuration={900}
            label={{ position: "right", fill: theme.text, fontSize: 11, fontFamily: "var(--font-mono)" }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ───────────────────────────── Histogram: trust distribution ───────────────────────────── */

export function TrustHistogram({ data, unit, height = 240 }: { data: { bucket: string; count: number }[]; unit: string; height?: number }) {
  const theme = useChartTheme();
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 4, left: 0, bottom: 0 }} barCategoryGap={2}>
          <defs>
            <linearGradient id="trust-bar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={theme.gold} stopOpacity={1} />
              <stop offset="100%" stopColor={theme.gold} stopOpacity={0.55} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={theme.grid} />
          <XAxis dataKey="bucket" tickLine={false} axisLine={{ stroke: theme.grid }} tick={{ fill: theme.axis, fontSize: 11, fontFamily: "var(--font-mono)" }} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={32} tick={{ fill: theme.axis, fontSize: 11, fontFamily: "var(--font-mono)" }} />
          <Tooltip
            cursor={{ fill: theme.grid }}
            content={({ active, payload, label }: TipProps) =>
              active && payload?.length ? (
                <ChartTooltipBox title={String(label)} rows={[{ label: unit, value: String(payload[0].value), color: theme.gold }]} />
              ) : null
            }
          />
          <Bar dataKey="count" fill="url(#trust-bar)" radius={[4, 4, 0, 0]} animationDuration={900} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ───────────────────────────── CSS-variable palette ─────────────────────────────
 * The same validated categorical slots as `useChartTheme`, exposed as CSS custom properties so SVG marks
 * (recharts or hand-drawn) follow the theme instantly — no React re-render, works for print too.
 * Render <ChartPaletteStyle /> once on a page, then use chartVar(0..5) / var(--chart-1..6). */

const paletteCss = (colors: string[]) => colors.map((c, i) => `--chart-${i + 1}:${c};`).join("");
export const CHART_PALETTE_CSS = `:root{${paletteCss(CATEGORICAL_DARK)}}[data-theme="light"]{${paletteCss(CATEGORICAL_LIGHT)}}`;

/** Palette variables + keyframes for the hand-drawn charts; render once per page. */
export function ChartPaletteStyle() {
  return <style>{CHART_PALETTE_CSS + CHART_KEYFRAMES_CSS}</style>;
}

/** Categorical slot as a CSS colour (fixed order — colour follows the entity, never its rank). */
export const chartVar = (slot: number) => `var(--chart-${(slot % 6) + 1})`;

/** Sequential gold ramp: 0 → surface-ish, 1 → full gold (one hue, light→dark in both themes). */
export const goldRamp = (t: number, surface = "var(--color-ink-850)") =>
  `color-mix(in oklab, var(--color-gold-400) ${Math.round(8 + Math.max(0, Math.min(1, t)) * 92)}%, ${surface})`;

/** Observed content-box size of an element (0×0 until mounted). */
export function useElementSize<T extends HTMLElement = HTMLDivElement>() {
  const ref = React.useRef<T>(null);
  const [size, setSize] = React.useState({ width: 0, height: 0 });
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setSize((s) => (Math.abs(s.width - r.width) < 0.5 && Math.abs(s.height - r.height) < 0.5 ? s : { width: r.width, height: r.height }));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/* ───────────────────────────── Sparkline ───────────────────────────── */

/** Tiny trend line for stat tiles: area wash + 2px line + end dot. Decorative (aria-hidden) — the tile carries the value. */
export function Sparkline({
  values,
  color = "var(--color-gold-400)",
  height = 36,
  className,
}: {
  values: number[];
  color?: string;
  height?: number;
  className?: string;
}) {
  const id = React.useId().replace(/:/g, "");
  const W = 120;
  const pts = values.length > 1 ? values : values.length === 1 ? [values[0]!, values[0]!] : [0, 0];
  const max = Math.max(...pts);
  const min = Math.min(0, ...pts);
  const span = max - min || 1;
  const xy = pts.map((v, i) => [(i / (pts.length - 1)) * W, 3 + (1 - (v - min) / span) * (height - 6)] as const);
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join("");
  const area = `${line}L${W},${height}L0,${height}Z`;
  const last = xy[xy.length - 1]!;
  return (
    <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className={cn("block w-full overflow-visible", className)} style={{ height }} aria-hidden>
      <defs>
        <linearGradient id={`spk-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.22} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#spk-${id})`} className="animate-[eka-fade_.9s_ease-out_both]" />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        pathLength={1}
        className="[stroke-dasharray:1] [stroke-dashoffset:1] animate-[eka-draw_1.2s_cubic-bezier(.16,1,.3,1)_.1s_forwards] motion-reduce:animate-none motion-reduce:[stroke-dashoffset:0]"
      />
      <circle cx={last[0]} cy={last[1]} r={3} fill={color} stroke="var(--color-ink-900)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" className="animate-[eka-fade_.4s_ease-out_1s_both]" />
    </svg>
  );
}

/** Keyframes used by the hand-drawn charts / diagrams (draw-on, fade, flowing dashes). */
export const CHART_KEYFRAMES_CSS = `
@keyframes eka-draw{to{stroke-dashoffset:0}}
@keyframes eka-fade{from{opacity:0}to{opacity:1}}
@keyframes eka-flow{to{stroke-dashoffset:-24}}
@keyframes eka-flow-rev{to{stroke-dashoffset:24}}
@keyframes eka-ping{0%{transform:scale(1);opacity:.55}100%{transform:scale(2.2);opacity:0}}
@media (prefers-reduced-motion: reduce){.eka-flowing{animation:none!important}}
`;
