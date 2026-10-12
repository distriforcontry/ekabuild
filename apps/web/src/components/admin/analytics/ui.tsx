"use client";
import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import type { Icon as IconType } from "iconsax-reactjs";
import { ArrowDown, ArrowUp, Chart } from "iconsax-reactjs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

/* ───────────────────────────── Panel (card with title, hint and optional actions) ───────────────────────────── */

export function Panel({
  title,
  hint,
  icon: Icon,
  actions,
  children,
  className,
  contentClassName,
  id,
}: {
  title: string;
  hint?: string;
  icon?: IconType;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  id?: string;
}) {
  const reduce = useReducedMotion();
  const headingId = React.useId();
  return (
    <motion.section
      id={id}
      aria-labelledby={headingId}
      // same initial state on server and client (hydration); reduced motion → instant
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: reduce ? 0 : 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={cn("min-w-0 break-inside-avoid print:!opacity-100 print:!transform-none", className)}
    >
      <Card className="h-full print:shadow-none">
        <CardHeader className="flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex min-w-0 items-start gap-3">
            {Icon && (
              <span className="mt-0.5 hidden size-9 shrink-0 place-items-center rounded-xl border border-gold-500/20 bg-gold-500/[0.07] text-gold-300 sm:grid print:hidden">
                <Icon size={18} variant="Bulk" />
              </span>
            )}
            <div className="min-w-0">
              <CardTitle id={headingId}>{title}</CardTitle>
              {hint && <CardDescription>{hint}</CardDescription>}
            </div>
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 sm:ml-auto print:hidden">{actions}</div>}
        </CardHeader>
        <CardContent className={contentClassName}>{children}</CardContent>
      </Card>
    </motion.section>
  );
}

/* ───────────────────────────── Segmented control ───────────────────────────── */

export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  label,
  size = "sm",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
  size?: "sm" | "md";
}) {
  const id = React.useId();
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const n = (i + (e.key === "ArrowRight" ? 1 : -1) + options.length) % options.length;
    onChange(options[n]!.value);
    refs.current[n]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex max-w-full shrink-0 overflow-x-auto rounded-xl border border-line bg-ink-850 p-1 no-scrollbar">
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onKeyDown={(e) => onKey(e, i)}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative cursor-pointer whitespace-nowrap rounded-lg font-semibold transition focus-visible:outline-2 focus-visible:outline-gold-400",
              size === "sm" ? "h-7 px-3 text-xs" : "h-8 px-3.5 text-[13px]",
              active ? "text-onyx" : "text-ink-300 hover:text-stone-100",
            )}
          >
            {active && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-lg bg-gold-gradient shadow-[0_4px_14px_-6px_rgb(201_164_100/0.7)]" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ───────────────────────────── Legend chip (doubles as a series toggle) ───────────────────────────── */

export function LegendToggle({ color, label, active, onToggle, disabled }: { color: string; label: string; active: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "inline-flex h-8 cursor-pointer items-center gap-2 rounded-full border px-3 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-gold-400 disabled:cursor-not-allowed",
        active ? "border-line-strong bg-ink-800 text-stone-100" : "border-line bg-transparent text-ink-400 hover:text-ink-200",
      )}
    >
      <span className={cn("h-[3px] w-3.5 rounded-full transition", !active && "opacity-30")} style={{ background: color }} />
      {label}
    </button>
  );
}

/** Static legend key (swatch + text — text never wears the series colour). */
export function LegendKey({ color, label, shape = "dot", className }: { color: string; label: React.ReactNode; shape?: "dot" | "line" | "square"; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-ink-300", className)}>
      <span
        className={cn("shrink-0", shape === "dot" && "size-2 rounded-full", shape === "square" && "size-2.5 rounded-[3px]", shape === "line" && "h-[3px] w-3.5 rounded-full")}
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

/* ───────────────────────────── Delta pill ───────────────────────────── */

/** Signed % change vs the previous period; colour = direction × whether "up" is good. */
export function DeltaPill({ value, upIsGood = true, className }: { value: number | null; upIsGood?: boolean; className?: string }) {
  const { t } = useI18n();
  if (value === null)
    return <span className={cn("inline-flex items-center rounded-full bg-gold-500/12 px-1.5 py-0.5 text-[11px] font-semibold text-gold-300", className)}>{t("admin.analytics.isNew")}</span>;
  const flat = Math.abs(value) < 0.5;
  const up = value > 0;
  const good = flat ? null : up === upIsGood;
  const txt = flat ? "0%" : `${up ? "+" : "−"}${Math.abs(value) >= 100 ? Math.round(Math.abs(value)) : Math.abs(value).toFixed(1).replace(/\.0$/, "")}%`;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums",
        good === null ? "bg-fg/5 text-ink-300" : good ? "bg-success/12 text-success" : "bg-danger/12 text-danger",
        className,
      )}
    >
      {!flat && (up ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
      {txt}
    </span>
  );
}

/* ───────────────────────────── Accessibility twin ───────────────────────────── */

/** Visually hidden table twin of a chart for screen readers (and the print view's fallback). */
export function SrTable({ caption, head, rows }: { caption: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h} scope="col">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) =>
              j === 0 ? (
                <th key={j} scope="row">
                  {c}
                </th>
              ) : (
                <td key={j}>{c}</td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ───────────────────────────── States ───────────────────────────── */

export function NoData({ className }: { className?: string }) {
  const { t } = useI18n();
  return <EmptyState icon={Chart} title={t("admin.analytics.empty")} description={t("admin.analytics.emptyHint")} className={cn("border-0 py-10", className)} />;
}

const BARS = [35, 52, 44, 68, 58, 74, 62, 80, 70, 88, 76, 92, 66, 84];

export function ChartSkeleton({ height = 240, dim, kind = "bars" }: { height?: number; dim?: boolean; kind?: "bars" | "rows" | "ring" }) {
  if (kind === "ring")
    return (
      <div className={cn("flex items-center gap-6", dim && "opacity-40")} style={{ height }}>
        <div className="relative aspect-square h-full max-h-48 shrink-0">
          <Skeleton className="size-full rounded-full" />
          <div className="absolute inset-[20%] rounded-full bg-ink-900" />
        </div>
        <div className="flex-1 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      </div>
    );
  if (kind === "rows")
    return (
      <div className={cn("space-y-3", dim && "opacity-40")} style={{ minHeight: height }}>
        {Array.from({ length: Math.max(3, Math.round(height / 48)) }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    );
  return (
    <div className={cn("flex items-end gap-2", dim && "opacity-40")} style={{ height }}>
      {BARS.map((h, i) => (
        <div key={i} className="flex-1" style={{ height: `${h}%` }}>
          <Skeleton className="h-full w-full rounded-md" />
        </div>
      ))}
    </div>
  );
}

/** Holds the previous render dimmed during a refetch — no skeleton flash, no layout jump. */
export function Dimmed({ active, children }: { active: boolean; children: React.ReactNode }) {
  return <div className={cn("transition-opacity duration-300", active && "pointer-events-none opacity-55")}>{children}</div>;
}
