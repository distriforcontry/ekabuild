"use client";
import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowDown, ArrowRight, Warning2 } from "iconsax-reactjs";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { goldRamp, useElementSize } from "../charts";
import { useFormat } from "../format";
import type { Analytics } from "./types";
import { SrTable } from "./ui";

const pct = (v: number) => (v >= 10 ? `${Math.round(v)}%` : v >= 1 ? `${v.toFixed(1)}%` : v > 0 ? `${v.toFixed(2)}%` : "0%");

export function Funnel({ data }: { data: Analytics["funnel"] }) {
  const { t } = useI18n();
  const f = useFormat();
  const [ref, { width }] = useElementSize<HTMLDivElement>();
  const [hover, setHover] = React.useState<number | null>(null);

  const max = Math.max(1, ...data.map((d) => d.count));
  // log scale keeps "paid" visible next to thousands of views (stated in the caption)
  const scale = (c: number) => (c <= 0 ? 0 : Math.log10(1 + c) / Math.log10(1 + max));
  const steps = data.map((d, i) => {
    const prev = i > 0 ? data[i - 1]!.count : null;
    return {
      ...d,
      label: t(`admin.analytics.funnel.steps.${d.step}`),
      s: scale(d.count),
      stepConv: prev === null ? null : prev > 0 ? (d.count / prev) * 100 : 0,
      ofFirst: data[0]!.count > 0 ? (d.count / data[0]!.count) * 100 : 0,
      color: goldRamp(0.35 + (i / Math.max(1, data.length - 1)) * 0.65),
    };
  });
  // the step that loses the largest share of the previous step's audience
  const worst = steps.reduce<number | null>((w, s, i) => (s.stepConv === null ? w : w === null || s.stepConv < steps[w]!.stepConv! ? i : w), null);
  const overall = steps[0]!.count > 0 ? (steps[steps.length - 1]!.count / steps[0]!.count) * 100 : 0;

  return (
    <div>
      <SrTable
        caption={t("admin.analytics.funnel.title")}
        head={[t("admin.analytics.funnel.step"), t("admin.analytics.funnel.count"), t("admin.analytics.funnel.stepConversion")]}
        rows={steps.map((s) => [s.label, f.number(s.count), s.stepConv === null ? "—" : pct(s.stepConv)])}
      />
      <div ref={ref} aria-hidden>
        {width === 0 ? <div className="h-[300px]" /> : width >= 760 ? (
          <HorizontalFunnel steps={steps} width={width} hover={hover} setHover={setHover} worst={worst} fmt={f.number} />
        ) : (
          <VerticalFunnel steps={steps} hover={hover} setHover={setHover} worst={worst} fmt={f.number} />
        )}
      </div>
      <div className="mt-5 grid gap-4 border-t border-line pt-4 sm:grid-cols-[auto_minmax(0,1fr)] lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] lg:gap-8">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-400">{t("admin.analytics.funnel.overall")}</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight text-stone-100">{pct(overall)}</div>
        </div>
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-400">{t("admin.analytics.funnel.dropoff")}</div>
          <div className="mt-1.5 flex items-start gap-2 text-sm text-stone-100">
            {worst !== null ? (
              <>
                <Warning2 size={16} variant="Bulk" className="mt-0.5 shrink-0 text-warning" />
                <span>
                  {steps[worst - 1]!.label} → {steps[worst]!.label} <span className="ml-1 font-mono text-xs text-ink-300">{pct(steps[worst]!.stepConv!)}</span>
                </span>
              </>
            ) : (
              "—"
            )}
          </div>
        </div>
        <p className="text-xs leading-relaxed text-ink-400 sm:col-span-2 lg:col-span-1 lg:text-right">{t("admin.analytics.funnel.scale")}</p>
      </div>
    </div>
  );
}

type Step = { step: string; count: number; label: string; s: number; stepConv: number | null; ofFirst: number; color: string };
type Props = { steps: Step[]; hover: number | null; setHover: (i: number | null) => void; worst: number | null; fmt: (n: number) => string };

function HorizontalFunnel({ steps, width, hover, setHover, worst, fmt }: Props & { width: number }) {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const H = 300;
  const top = 74; // label band
  const band = 168;
  const cy = top + band / 2;
  const n = steps.length;
  const colW = width / n;
  const flat = 0.58; // share of a column that keeps its height before curving into the next
  const hOf = (s: number) => (s <= 0 ? 4 : 10 + s * (band - 10));

  const shape = (i: number) => {
    const x0 = i * colW + (i ? 1 : 0);
    const xf = i * colW + colW * flat;
    const x1 = (i + 1) * colW - (i < n - 1 ? 1 : 0);
    const h0 = hOf(steps[i]!.s) / 2;
    const h1 = i < n - 1 ? hOf(steps[i + 1]!.s) / 2 : h0;
    const mx = (xf + x1) / 2;
    return [
      `M${x0},${cy - h0}`,
      `L${xf},${cy - h0}`,
      `C${mx},${cy - h0} ${mx},${cy - h1} ${x1},${cy - h1}`,
      `L${x1},${cy + h1}`,
      `C${mx},${cy + h1} ${mx},${cy + h0} ${xf},${cy + h0}`,
      `L${x0},${cy + h0}Z`,
    ].join("");
  };

  return (
    <div className="relative" style={{ height: H }}>
      <svg width={width} height={H} className="absolute inset-0 overflow-visible">
        <defs>
          <linearGradient id="funnel-sheen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity={0.16} />
            <stop offset="45%" stopColor="#fff" stopOpacity={0} />
          </linearGradient>
        </defs>
        {/* recessive centre guide */}
        <line x1={0} x2={width} y1={cy} y2={cy} stroke="var(--color-line)" />
        {steps.map((s, i) => (
          <motion.g
            key={s.step}
            initial={reduce ? false : { opacity: 0, scaleY: 0.2 }}
            animate={{ opacity: hover === null || hover === i ? 1 : 0.45, scaleY: 1 }}
            transition={{ duration: 0.9, delay: reduce ? 0 : 0.1 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: `0px ${cy}px` }}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <path d={shape(i)} fill={s.color} />
            <path d={shape(i)} fill="url(#funnel-sheen)" />
          </motion.g>
        ))}
      </svg>

      {steps.map((s, i) => (
        <div
          key={s.step}
          className="absolute top-0 flex flex-col px-3"
          style={{ left: i * colW, width: colW * flat + 8 }}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(null)}
        >
          <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-ink-400">{s.label}</span>
          <span className="mt-1 text-xl font-semibold tracking-tight text-stone-100 xl:text-2xl">{fmt(s.count)}</span>
          {i > 0 && <span className="mt-0.5 truncate font-mono text-[11px] text-ink-400">{t("admin.analytics.funnel.ofFirst", { pct: pct(s.ofFirst) })}</span>}
        </div>
      ))}

      {/* step conversion chips sit on the curve between steps */}
      {steps.map((s, i) =>
        s.stepConv === null ? null : (
          <motion.div
            key={`c-${s.step}`}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduce ? 0 : 0.6 + i * 0.12, duration: 0.5 }}
            className="absolute -translate-x-1/2"
            style={{ left: (i - 1) * colW + colW * (flat + (1 - flat) / 2), top: top + band + 14 }}
          >
            <span
              className={cn(
                "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-1 font-mono text-[11px] font-semibold tabular-nums shadow-card",
                worst === i ? "border-warning/40 bg-warning/10 text-stone-100" : "border-line-strong bg-ink-800 text-stone-100",
              )}
              title={t("admin.analytics.funnel.stepConversion")}
            >
              <ArrowRight size={11} className="text-ink-400" />
              {pct(s.stepConv)}
            </span>
          </motion.div>
        ),
      )}
    </div>
  );
}

function VerticalFunnel({ steps, hover, setHover, worst, fmt }: Props) {
  const reduce = useReducedMotion();
  return (
    <ol className="space-y-1">
      {steps.map((s, i) => (
        <li key={s.step} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className={cn("transition-opacity", hover !== null && hover !== i && "opacity-50")}>
          {s.stepConv !== null && (
            <div className="flex justify-center py-1">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px] font-semibold text-stone-100",
                  worst === i ? "border-warning/40 bg-warning/10" : "border-line bg-ink-800",
                )}
              >
                <ArrowDown size={11} className="text-ink-400" />
                {pct(s.stepConv)}
              </span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <span className="w-24 shrink-0 truncate text-xs font-medium text-ink-300">{s.label}</span>
            <div className="flex h-9 flex-1 items-center justify-center">
              <motion.div
                className="h-full rounded-lg"
                style={{ background: s.color }}
                initial={reduce ? false : { width: 0 }}
                animate={{ width: `${Math.max(4, s.s * 100)}%` }}
                transition={{ duration: 0.9, delay: 0.1 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <span className="w-16 shrink-0 text-right text-sm font-semibold text-stone-100">{fmt(s.count)}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
