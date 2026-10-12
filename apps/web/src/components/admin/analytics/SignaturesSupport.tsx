"use client";
import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Danger, InfoCircle, Messages2, TickCircle, Timer1, Warning2 } from "iconsax-reactjs";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { useFormat } from "../format";
import type { Analytics } from "./types";
import { SrTable } from "./ui";

export function SignaturesDonut({ data }: { data: Analytics["signatures"] }) {
  const { t } = useI18n();
  const f = useFormat();
  const [active, setActive] = React.useState<number | null>(null);
  const rows = [
    { key: "EIMZO", label: t("admin.analytics.signatures.eimzo"), value: data.EIMZO, color: "var(--color-gold-400)" },
    { key: "MOCK", label: t("admin.analytics.signatures.mock"), value: data.MOCK, color: "var(--color-ink-500)" },
  ];
  const total = data.EIMZO + data.MOCK;
  const share = total ? Math.round((data.EIMZO / total) * 100) : 0;
  const shown = active !== null ? rows[active]! : null;

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:flex-wrap">
      <SrTable caption={t("admin.analytics.signatures.title")} head={[t("admin.analytics.signatures.title"), t("admin.analytics.signatures.total")]} rows={rows.map((r) => [r.label, r.value])} />
      <div className="relative size-[168px] shrink-0" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={total ? rows : [{ key: "none", label: "", value: 1, color: "var(--color-ink-800)" }]}
              dataKey="value"
              innerRadius="72%"
              outerRadius="98%"
              paddingAngle={total && data.EIMZO && data.MOCK ? 3 : 0}
              cornerRadius={5}
              stroke="var(--color-ink-900)"
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
              onMouseEnter={(_: unknown, i: number) => setActive(i)}
              onMouseLeave={() => setActive(null)}
              animationDuration={900}
            >
              {(total ? rows : [{ key: "none", color: "var(--color-ink-800)" }]).map((r, i) => (
                <Cell key={r.key} fill={r.color} opacity={active === null || active === i ? 1 : 0.35} style={{ transition: "opacity .2s" }} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="text-3xl font-semibold tracking-tight text-stone-100">{shown ? f.number(shown.value) : `${share}%`}</div>
            <div className="mt-0.5 max-w-24 text-[11px] leading-tight text-ink-400">{shown ? shown.label : t("admin.analytics.signatures.share")}</div>
          </div>
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-2">
        {rows.map((r, i) => (
          <li
            key={r.key}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            className={cn("flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition", active === i && "bg-fg/5")}
          >
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: r.color }} />
            <span className="min-w-0 flex-1 truncate text-ink-200">{r.label}</span>
            <span className="font-mono text-xs text-ink-400">{total ? Math.round((r.value / total) * 100) : 0}%</span>
            <span className="w-8 text-right font-mono font-semibold text-stone-100">{r.value}</span>
          </li>
        ))}
        <li className="flex items-center justify-between border-t border-line px-2 pt-2.5 text-xs text-ink-400">
          {t("admin.analytics.signatures.total")} <span className="font-mono text-sm font-semibold text-stone-100">{f.number(total)}</span>
        </li>
      </ul>
      <p className="flex w-full basis-full items-start gap-2 rounded-xl border border-line bg-ink-850/60 p-3 text-xs leading-relaxed text-ink-300 sm:basis-auto">
        <InfoCircle size={16} variant="Bulk" className="mt-px shrink-0 text-gold-300" />
        {t("admin.analytics.signatures.note")}
      </p>
    </div>
  );
}

export function SupportKpi({ data }: { data: Analytics["support"] }) {
  const { t } = useI18n();
  const f = useFormat();
  const reduce = useReducedMotion();
  const rate = data.threads ? data.closed / data.threads : 0;
  const m = data.avgFirstResponseMin;
  const sla = m === null ? null : m <= 15 ? "good" : m <= 60 ? "warn" : "bad";
  const SlaIcon = sla === "good" ? TickCircle : sla === "warn" ? Warning2 : Danger;
  const R = 42;
  const C = 2 * Math.PI * R;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-5">
        <div className="relative size-[108px] shrink-0">
          <svg viewBox="0 0 100 100" className="size-full -rotate-90" role="img" aria-label={`${t("admin.analytics.support.resolution")}: ${Math.round(rate * 100)}%`}>
            <circle cx={50} cy={50} r={R} fill="none" stroke="var(--color-ink-800)" strokeWidth={8} />
            <motion.circle
              cx={50}
              cy={50}
              r={R}
              fill="none"
              stroke="var(--color-gold-400)"
              strokeWidth={8}
              strokeLinecap="round"
              strokeDasharray={C}
              initial={{ strokeDashoffset: reduce ? C * (1 - rate) : C }}
              animate={{ strokeDashoffset: C * (1 - rate) }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="text-2xl font-semibold tracking-tight text-stone-100">{Math.round(rate * 100)}%</div>
              <div className="text-[10px] uppercase tracking-wider text-ink-400">{t("admin.analytics.support.closed")}</div>
            </div>
          </div>
        </div>
        <dl className="grid flex-1 grid-cols-2 gap-3">
          <div className="rounded-xl border border-line bg-ink-850/60 p-3">
            <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-ink-400">
              <Messages2 size={13} /> {t("admin.analytics.support.threads")}
            </dt>
            <dd className="mt-1 text-xl font-semibold text-stone-100">{f.number(data.threads)}</dd>
          </div>
          <div className="rounded-xl border border-line bg-ink-850/60 p-3">
            <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-ink-400">
              <TickCircle size={13} /> {t("admin.analytics.support.closed")}
            </dt>
            <dd className="mt-1 text-xl font-semibold text-stone-100">{f.number(data.closed)}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-xl border border-line bg-ink-850/60 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-ink-400">
              <Timer1 size={13} /> {t("admin.analytics.support.firstResponse")}
            </div>
            <div className="mt-1 text-2xl font-semibold tracking-tight text-stone-100">
              {m === null ? <span className="text-base text-ink-400">{t("admin.analytics.support.noResponse")}</span> : t("admin.analytics.support.minutes", { n: m < 10 ? m.toFixed(1) : Math.round(m) })}
            </div>
          </div>
          {sla && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold",
                sla === "good" ? "bg-success/12 text-success" : sla === "warn" ? "bg-warning/12 text-warning" : "bg-danger/12 text-danger",
              )}
            >
              <SlaIcon size={14} variant="Bulk" /> {t(`admin.analytics.support.sla.${sla}`)}
            </span>
          )}
        </div>
        {/* 0–60 min track with the 15-minute target marked */}
        <div className="relative mt-4 h-2 rounded-full bg-ink-800" aria-hidden>
          <span className="absolute inset-y-0 left-0 w-1/4 rounded-l-full bg-success/25" />
          {m !== null && (
            <motion.span
              className={cn("absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink-900", sla === "good" ? "bg-success" : sla === "warn" ? "bg-warning" : "bg-danger")}
              initial={{ left: "0%" }}
              animate={{ left: `${Math.min(100, (m / 60) * 100)}%` }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
            />
          )}
        </div>
        <div className="mt-1.5 flex justify-between font-mono text-[10px] text-ink-500">
          <span>0</span>
          <span className="text-ink-400">{t("admin.analytics.support.target")}</span>
          <span>60+</span>
        </div>
      </div>
    </div>
  );
}
