"use client";
import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { Clock } from "iconsax-reactjs";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { goldRamp } from "../charts";
import { useFormat } from "../format";
import type { HourPoint } from "./types";
import { SrTable } from "./ui";

const ROWS = ["views", "purchases"] as const;
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

/** Activity by hour of day — one sequential ramp per row (each row scaled to its own max). */
export function HourlyHeatmap({ data }: { data: HourPoint[] }) {
  const { t } = useI18n();
  const f = useFormat();
  const reduce = useReducedMotion();
  const [hover, setHover] = React.useState<number | null>(null);
  const max = { views: Math.max(1, ...data.map((d) => d.views)), purchases: Math.max(1, ...data.map((d) => d.purchases)) };
  const peak = (k: (typeof ROWS)[number]) => data.reduce((p, d) => (d[k] > p[k] ? d : p), data[0]!);
  const shown = hover !== null ? data[hover]! : null;

  return (
    <div>
      <SrTable
        caption={t("admin.analytics.hourly.title")}
        head={[t("admin.analytics.hourly.hour"), t("admin.analytics.hourly.views"), t("admin.analytics.hourly.purchases")]}
        rows={data.map((d) => [hh(d.hour), d.views, d.purchases])}
      />
      {/* hover readout (keyboard: arrow through the cells) */}
      <div className="mb-3 flex min-h-6 flex-wrap items-center gap-x-4 gap-y-1 text-xs" aria-live="polite">
        {shown ? (
          <>
            <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-stone-100">
              <Clock size={14} className="text-gold-300" /> {hh(shown.hour)}–{hh((shown.hour + 1) % 24)}
            </span>
            {ROWS.map((k) => (
              <span key={k} className="text-ink-300">
                {t(`admin.analytics.hourly.${k}`)}: <span className="font-mono font-semibold text-stone-100">{f.number(shown[k])}</span>
              </span>
            ))}
          </>
        ) : (
          ROWS.map((k) => {
            const p = peak(k);
            return (
              <span key={k} className="text-ink-300">
                {t("admin.analytics.hourly.peak")} · {t(`admin.analytics.hourly.${k}`)}:{" "}
                <span className="font-mono font-semibold text-stone-100">{p[k] ? hh(p.hour) : "—"}</span>
              </span>
            );
          })
        )}
      </div>

      <div className="overflow-x-auto pb-1 no-scrollbar">
        <div className="min-w-[520px]" onMouseLeave={() => setHover(null)}>
          {ROWS.map((k, r) => (
            <div key={k} className="mb-1.5 grid grid-cols-[76px_1fr] items-center gap-2">
              <span className="truncate text-[11px] font-medium text-ink-300">{t(`admin.analytics.hourly.${k}`)}</span>
              <div className="grid grid-cols-24 gap-[3px]" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
                {data.map((d, i) => {
                  const v = d[k] / max[k];
                  return (
                    <motion.button
                      type="button"
                      key={d.hour}
                      aria-label={`${hh(d.hour)} — ${t(`admin.analytics.hourly.${k}`)}: ${d[k]}`}
                      onMouseEnter={() => setHover(i)}
                      onFocus={() => setHover(i)}
                      onBlur={() => setHover(null)}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                          e.preventDefault();
                          const sib = (e.currentTarget.parentElement?.children[(i + (e.key === "ArrowRight" ? 1 : 23)) % 24] as HTMLElement | undefined);
                          sib?.focus();
                        }
                      }}
                      initial={reduce ? false : { opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.35, delay: reduce ? 0 : r * 0.12 + i * 0.015 }}
                      className={cn(
                        "h-8 cursor-default rounded-[5px] outline-none transition focus-visible:ring-2 focus-visible:ring-gold-400",
                        hover === i && "ring-2 ring-stone-100/60",
                      )}
                      style={{ background: d[k] ? goldRamp(0.1 + v * 0.9) : "var(--color-ink-850)" }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
          <div className="grid grid-cols-[76px_1fr] gap-2">
            <span />
            <div className="grid font-mono text-[10px] text-ink-400" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
              {data.map((d) => (
                <span key={d.hour} className="text-center">
                  {d.hour % 3 === 0 ? String(d.hour).padStart(2, "0") : ""}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-ink-400" aria-hidden>
        <span>{t("admin.analytics.hourly.less")}</span>
        {[0.1, 0.3, 0.5, 0.7, 0.9, 1].map((v) => (
          <span key={v} className="size-3 rounded-[3px]" style={{ background: goldRamp(v) }} />
        ))}
        <span>{t("admin.analytics.hourly.more")}</span>
      </div>
    </div>
  );
}
