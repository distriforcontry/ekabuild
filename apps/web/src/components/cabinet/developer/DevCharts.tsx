"use client";
import * as React from "react";
import { useTheme } from "next-themes";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { useFmt } from "../format";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ───────────── theme-aware colours (read from the CSS tokens, re-read on theme change) ─────────────

type Palette = { gold: string; goldHi: string; goldDeep: string; info: string; track: string; grid: string; axis: string; text: string; surface: string };
const FALLBACK: Palette = {
  gold: "#d4af6a",
  goldHi: "#e9d5a8",
  goldDeep: "#8e6e3c",
  info: "#5b9bd5",
  track: "#34363d",
  grid: "rgba(255,255,255,0.08)",
  axis: "#6b6f7a",
  text: "#c4c7ce",
  surface: "#111215",
};

export function useChartPalette(): Palette {
  const { resolvedTheme } = useTheme();
  const [p, setP] = React.useState<Palette>(FALLBACK);
  React.useEffect(() => {
    const read = () => {
      const s = getComputedStyle(document.documentElement);
      const v = (name: string, fb: string) => s.getPropertyValue(name).trim() || fb;
      const dark = document.documentElement.getAttribute("data-theme") !== "light";
      setP({
        gold: v("--color-gold-400", FALLBACK.gold),
        // light theme flips the gold scale (gold-200 becomes dark bronze) — use the brushed mid-gold there
        goldHi: dark ? v("--color-gold-200", FALLBACK.goldHi) : v("--color-gold-500", "#b08a4e"),
        goldDeep: v("--color-gold-700", FALLBACK.goldDeep),
        info: v("--color-info", FALLBACK.info),
        track: v("--color-ink-600", FALLBACK.track),
        grid: v("--color-line", FALLBACK.grid),
        axis: v("--color-ink-400", FALLBACK.axis),
        text: v("--color-ink-200", FALLBACK.text),
        surface: v("--color-ink-900", FALLBACK.surface),
      });
    };
    const raf = requestAnimationFrame(read);
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    return () => {
      cancelAnimationFrame(raf);
      mo.disconnect();
    };
  }, [resolvedTheme]);
  return p;
}

function TipBox({ title, rows }: { title?: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="min-w-40 rounded-xl border border-line-strong bg-ink-800/95 px-3 py-2.5 text-xs shadow-lift backdrop-blur-md">
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

// ───────────── sales by month ─────────────

export type MonthPoint = { key: string; label: string; amount: number; count: number };

export function SalesByMonthChart({ data }: { data: MonthPoint[] }) {
  const c = useChartPalette();
  const fmt = useFmt();
  const { t } = useI18n();
  const id = React.useId().replace(/:/g, "");
  const max = Math.max(...data.map((d) => d.amount), 0);
  return (
    <div className="h-64 w-full" role="img" aria-label={t("app.developer.dashboard.charts.salesAria")}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 22, right: 4, left: 0, bottom: 0 }} barCategoryGap="28%">
          <defs>
            <linearGradient id={`sales-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c.goldHi} />
              <stop offset="100%" stopColor={c.goldDeep} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={c.grid} strokeDasharray="3 5" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: c.axis, fontSize: 11 }} dy={6} interval={0} />
          <YAxis
            width={74}
            tickLine={false}
            axisLine={false}
            tick={{ fill: c.axis, fontSize: 10, fontFamily: "var(--font-mono)" }}
            tickFormatter={(v: number) => (v ? fmt.compact(v).replace(/\s*so['ʻ‘’]?m$/i, "") : "0")}
            domain={[0, max ? "auto" : 1]}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: c.grid, radius: 8 } as any}
            content={({ active, payload }: any) =>
              active && payload?.length ? (
                <TipBox
                  title={payload[0].payload.label}
                  rows={[
                    { label: t("app.developer.dashboard.charts.amount"), value: fmt.compact(payload[0].payload.amount), color: c.gold },
                    { label: t("app.developer.dashboard.charts.count"), value: String(payload[0].payload.count) },
                  ]}
                />
              ) : null
            }
          />
          <Bar dataKey="amount" fill={`url(#sales-${id})`} radius={[6, 6, 2, 2]} maxBarSize={34} animationDuration={1100} animationEasing="ease-out">
            <LabelList
              dataKey="count"
              position="top"
              offset={8}
              content={(props: any) =>
                props.value ? (
                  <text x={props.x + props.width / 2} y={props.y - 8} textAnchor="middle" fill={c.text} fontSize={10} fontFamily="var(--font-mono)">
                    {props.value}
                  </text>
                ) : null
              }
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ───────────── units status donut ─────────────

export function UnitsDonut({ sold, reserved, available }: { sold: number; reserved: number; available: number }) {
  const c = useChartPalette();
  const { t, label } = useI18n();
  const fmt = useFmt();
  const total = sold + reserved + available;
  const rows = React.useMemo(
    () => [
      { key: "SOLD", value: sold, color: c.gold },
      { key: "RESERVED", value: reserved, color: c.info },
      { key: "AVAILABLE", value: available, color: c.track },
    ],
    [sold, reserved, available, c.gold, c.info, c.track],
  );
  const empty = React.useMemo(() => [{ key: "EMPTY", value: 1, color: c.track }], [c.track]);
  const [hover, setHover] = React.useState<number | null>(null);
  const share = total ? Math.round((sold / total) * 100) : 0;
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row lg:flex-col 2xl:flex-row">
      <div className="relative size-44 shrink-0" role="img" aria-label={t("app.developer.dashboard.charts.unitsAria", { sold, reserved, available })}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={total ? rows : empty}
              dataKey="value"
              nameKey="key"
              innerRadius="72%"
              outerRadius="100%"
              paddingAngle={total ? 2 : 0}
              cornerRadius={4}
              stroke={c.surface}
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
              animationDuration={1100}
              onMouseEnter={(_: unknown, i: number) => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {(total ? rows : empty).map((r, i) => (
                <Cell key={r.key} fill={r.color} opacity={hover == null || hover === i ? 1 : 0.45} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="font-mono text-[28px] font-semibold leading-none text-stone-100">{share}%</div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">{t("app.developer.dashboard.charts.soldShare")}</div>
          </div>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-2">
        {rows.map((r, i) => (
          <li
            key={r.key}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition",
              hover === i ? "border-line-strong bg-fg/[0.04]" : "border-line bg-ink-850/40",
            )}
          >
            <span className="size-2.5 shrink-0 rounded-full ring-2 ring-ink-900" style={{ background: r.color }} />
            <span className="flex-1 truncate text-sm text-ink-200">{label("unitStatus", r.key)}</span>
            <span className="font-mono text-sm font-semibold text-stone-100">{fmt.number(r.value)}</span>
            <span className="w-10 text-right font-mono text-[11px] text-ink-400">{total ? Math.round((r.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ───────────── trust score per project ─────────────

export function TrustBars({ data }: { data: { name: string; score: number }[] }) {
  const c = useChartPalette();
  const { t } = useI18n();
  const id = React.useId().replace(/:/g, "");
  const h = Math.max(120, data.length * 46 + 16);
  return (
    <div className="w-full" style={{ height: h }} role="img" aria-label={t("app.developer.dashboard.charts.trustAria")}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 4, bottom: 4 }} barCategoryGap="30%">
          <defs>
            <linearGradient id={`trust-${id}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={c.goldDeep} />
              <stop offset="100%" stopColor={c.goldHi} />
            </linearGradient>
          </defs>
          <CartesianGrid horizontal={false} stroke={c.grid} strokeDasharray="3 5" />
          <XAxis type="number" domain={[0, 100]} ticks={[0, 50, 80, 100]} tickLine={false} axisLine={false} tick={{ fill: c.axis, fontSize: 10, fontFamily: "var(--font-mono)" }} />
          <YAxis
            type="category"
            dataKey="name"
            width={136}
            tickLine={false}
            axisLine={false}
            tick={(props: any) => (
              <text x={props.x} y={props.y} dy={4} textAnchor="end" fill={c.text} fontSize={12}>
                {String(props.payload.value).length > 19 ? `${String(props.payload.value).slice(0, 18)}…` : props.payload.value}
              </text>
            )}
          />
          <Tooltip
            cursor={{ fill: c.grid } as any}
            content={({ active, payload }: any) =>
              active && payload?.length ? (
                <TipBox title={payload[0].payload.name} rows={[{ label: t("app.common.trust"), value: `${payload[0].payload.score}/100`, color: c.gold }]} />
              ) : null
            }
          />
          <Bar dataKey="score" fill={`url(#trust-${id})`} radius={[2, 6, 6, 2]} maxBarSize={18} background={{ fill: c.grid, radius: 6 } as any} animationDuration={1100}>
            <LabelList dataKey="score" position="right" offset={8} fill={c.text} fontSize={11} fontFamily="var(--font-mono)" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Builds the last `n` calendar months with locale labels and sums purchases into them. */
export function useMonthlySales(items: { createdAt: string; amount: string | number; status: string }[], n = 6): MonthPoint[] {
  const { locale, tr } = useI18n();
  return React.useMemo(() => {
    const UZ = ["Yan", "Fev", "Mar", "Apr", "May", "Iyn", "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek"];
    const RU = new Intl.DateTimeFormat("ru-RU", { month: "short" });
    const now = new Date();
    const months: MonthPoint[] = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const label = locale === "ru" ? RU.format(d).replace(".", "") : tr(UZ[d.getMonth()]!);
      months.push({ key, label, amount: 0, count: 0 });
    }
    for (const p of items) {
      if (p.status === "CANCELLED") continue;
      const d = new Date(p.createdAt);
      const m = months.find((x) => x.key === `${d.getFullYear()}-${d.getMonth()}`);
      if (m) {
        m.amount += Number(p.amount) || 0;
        m.count += 1;
      }
    }
    return months;
  }, [items, n, locale, tr]);
}
