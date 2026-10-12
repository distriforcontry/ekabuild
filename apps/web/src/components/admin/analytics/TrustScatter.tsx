"use client";
import * as React from "react";
import { CartesianGrid, ReferenceArea, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { useI18n } from "@/i18n/client";
import { ChartTooltipBox } from "../charts";
import { useFormat } from "../format";
import type { TrustSalesPoint } from "./types";
import { SrTable } from "./ui";

/* eslint-disable @typescript-eslint/no-explicit-any */
type TipProps = { active?: boolean; payload?: readonly any[] };

const TRUST_SPLIT = 65; // "trusted" band starts here (same as the trust histogram)
const SOLD_SPLIT = 50;

export function TrustScatter({ points }: { points: TrustSalesPoint[] }) {
  const { t, tr } = useI18n();
  const f = useFormat();
  const data = points.map((p) => ({ ...p, x: p.trustScore, y: Math.round(p.soldShare * 1000) / 10, z: Math.max(1, p.units), label: tr(p.name) }));
  const avg = (xs: typeof data) => (xs.length ? xs.reduce((s, p) => s + p.y, 0) / xs.length : null);
  const high = avg(data.filter((p) => p.x >= TRUST_SPLIT));
  const low = avg(data.filter((p) => p.x < TRUST_SPLIT));
  const pctTxt = (v: number | null) => (v === null ? "—" : `${Math.round(v)}%`);
  const q = (k: "stars" | "hidden" | "risky" | "weak") => t(`admin.analytics.scatter.quadrants.${k}`);
  const quadLabel = { fill: "var(--color-ink-400)", fontSize: 10, fontWeight: 600 } as const;

  return (
    <div>
      <SrTable
        caption={t("admin.analytics.scatter.title")}
        head={[t("admin.analytics.projects.name"), t("admin.analytics.scatter.x"), t("admin.analytics.scatter.y"), t("admin.analytics.scatter.units")]}
        rows={data.map((p) => [p.label, String(p.x), `${p.y}%`, f.number(p.units)])}
      />
      <div className="h-[300px]" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="var(--color-line)" />
            <ReferenceArea x1={TRUST_SPLIT} x2={100} y1={SOLD_SPLIT} y2={100} fill="var(--color-gold-400)" fillOpacity={0.06} stroke="none" label={{ value: q("stars"), position: "insideTopRight", ...quadLabel }} />
            <ReferenceArea x1={TRUST_SPLIT} x2={100} y1={0} y2={SOLD_SPLIT} fill="none" stroke="none" label={{ value: q("hidden"), position: "insideBottomRight", ...quadLabel }} />
            <ReferenceArea x1={0} x2={TRUST_SPLIT} y1={SOLD_SPLIT} y2={100} fill="none" stroke="none" label={{ value: q("risky"), position: "insideTopLeft", ...quadLabel }} />
            <ReferenceArea x1={0} x2={TRUST_SPLIT} y1={0} y2={SOLD_SPLIT} fill="var(--color-danger)" fillOpacity={0.04} stroke="none" label={{ value: q("weak"), position: "insideBottomLeft", ...quadLabel }} />
            <ReferenceLine x={TRUST_SPLIT} stroke="var(--color-line-strong)" />
            <ReferenceLine y={SOLD_SPLIT} stroke="var(--color-line-strong)" />
            <XAxis
              type="number"
              dataKey="x"
              domain={[0, 100]}
              ticks={[0, 25, 50, 65, 85, 100]}
              tickLine={false}
              axisLine={{ stroke: "var(--color-line)" }}
              tick={{ fill: "var(--color-ink-400)", fontSize: 11, fontFamily: "var(--font-mono)" }}
              name={t("admin.analytics.scatter.x")}
            />
            <YAxis
              type="number"
              dataKey="y"
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tickFormatter={(v: number) => `${v}%`}
              tickLine={false}
              axisLine={false}
              width={44}
              tick={{ fill: "var(--color-ink-400)", fontSize: 11, fontFamily: "var(--font-mono)" }}
              name={t("admin.analytics.scatter.y")}
            />
            <ZAxis type="number" dataKey="z" range={[70, 900]} />
            <Tooltip
              cursor={{ stroke: "var(--color-line-strong)", strokeDasharray: "0" }}
              content={({ active, payload }: TipProps) =>
                active && payload?.length ? (
                  <ChartTooltipBox
                    title={payload[0].payload.label}
                    rows={[
                      { label: t("admin.analytics.scatter.x"), value: String(payload[0].payload.x), color: "var(--color-gold-400)" },
                      { label: t("admin.analytics.scatter.y"), value: `${payload[0].payload.y}%` },
                      { label: t("admin.analytics.scatter.units"), value: f.number(payload[0].payload.units) },
                    ]}
                  />
                ) : null
              }
            />
            <Scatter data={data} fill="var(--color-gold-400)" fillOpacity={0.72} stroke="var(--color-ink-900)" strokeWidth={2} animationDuration={900} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-ink-300">{t("admin.analytics.scatter.insight", { high: pctTxt(high), low: pctTxt(low) })}</span>
        <span className="inline-flex items-center gap-2 text-ink-400">
          <span className="inline-flex items-end gap-1" aria-hidden>
            <span className="size-2 rounded-full bg-gold-400/70" />
            <span className="size-3 rounded-full bg-gold-400/70" />
            <span className="size-4 rounded-full bg-gold-400/70" />
          </span>
          {t("admin.analytics.scatter.units")}
        </span>
      </div>
    </div>
  );
}
