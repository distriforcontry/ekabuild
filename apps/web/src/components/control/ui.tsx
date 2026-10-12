"use client";
import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import type { Icon as IconType } from "iconsax-reactjs";
import { PageHead } from "@/components/cabinet/kit";
import { PageHeader } from "@/components/ui/misc";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import type { Area } from "./area";

/** Admin pages use the compact admin header; developer pages use the cabinet's display header. */
export function ControlHeader({
  area,
  icon,
  title,
  description,
  actions,
}: {
  area: Area;
  icon?: IconType;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const { t } = useI18n();
  if (area === "admin") return <PageHeader eyebrow={t("admin.control.eyebrow")} title={title} description={description} actions={actions} />;
  return <PageHead eyebrow={t("admin.control.eyebrowDev")} icon={icon} title={title} description={description} actions={actions} />;
}

const RU_MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const UZ_MONTHS = ["yan", "fev", "mar", "apr", "may", "iyun", "iyul", "avg", "sen", "okt", "noy", "dek"];

/** "2026-03" → "mar 26" (uz / oz / ru) */
export function useMonthLabel() {
  const { locale, tr } = useI18n();
  return React.useCallback(
    (m: string) => {
      const [y, mm] = m.split("-");
      const idx = Number(mm) - 1;
      if (!y || Number.isNaN(idx) || idx < 0 || idx > 11) return m;
      return `${locale === "ru" ? RU_MONTHS[idx] : tr(UZ_MONTHS[idx]!)} ${y.slice(2)}`;
    },
    [locale, tr],
  );
}

/** Short month name for a date: "okt" / "окт" (own tables — Chromium has no uz month data). */
export function useMonthShort() {
  const { locale, tr } = useI18n();
  return React.useCallback((d: Date) => (locale === "ru" ? RU_MONTHS[d.getMonth()]! : tr(UZ_MONTHS[d.getMonth()]!)), [locale, tr]);
}

/** Code-like tokens (deal / contract / certificate numbers: P-2026-PCC4CH, BUI-2024-1222) must never be transliterated. */
const CODE_TOKEN = /(\b(?=[A-Z0-9-]*\d)[A-Z0-9]+(?:-[A-Z0-9]+)+\b)/;

/** `tr()` for free-form DB text that may embed document numbers: transliterates everything except the codes. */
export function useTrSafe() {
  const { tr, locale } = useI18n();
  return React.useCallback(
    (text: string | null | undefined) =>
      !text || locale !== "oz"
        ? (text ?? "")
        : text
            .split(CODE_TOKEN)
            .map((part, i) => (i % 2 === 1 ? part : tr(part)))
            .join(""),
    [tr, locale],
  );
}

/** "Boshlang'ich to'lov" / "3-to'lov" / "To'liq to'lov" */
export function useSeqLabel() {
  const { t } = useI18n();
  return React.useCallback(
    (seq: number, planType?: string | null) =>
      seq === 0 ? (planType === "FULL" ? t("admin.control.seq.full") : t("admin.control.seq.down")) : t("admin.control.seq.n", { n: seq }),
    [t],
  );
}

/** Days-left pill: red when late, amber when ≤ critical days, neutral otherwise. */
export function DaysBadge({ days, critical = 3, className }: { days: number; critical?: number; className?: string }) {
  const { t } = useI18n();
  const tone = days < 0 ? "border-danger/30 bg-danger/10 text-danger" : days <= critical ? "border-warning/30 bg-warning/10 text-warning" : "border-line-strong bg-fg/5 text-ink-200";
  const text = days < 0 ? t("admin.control.daysLate", { n: -days }) : days === 0 ? t("admin.control.today") : days === 1 ? t("admin.control.tomorrow") : t("admin.control.daysLeft", { n: days });
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 font-mono text-[10.5px] font-semibold", tone, className)}>{text}</span>;
}

/** Pill segmented control (single choice), gold thumb slides between options. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
  size = "sm",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; count?: number | null }[];
  label?: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const id = React.useId();
  const reduce = useReducedMotion();
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex max-w-full shrink-0 overflow-x-auto rounded-xl border border-line bg-ink-850 p-1 [scrollbar-width:none]", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg font-semibold transition-colors",
              size === "sm" ? "h-7 px-3 text-xs" : "h-8 px-3.5 text-[13px]",
              active ? "text-onyx" : "text-ink-300 hover:text-stone-100",
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-lg bg-gold-gradient"
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 36 }}
              />
            )}
            <span className="relative">{o.label}</span>
            {o.count != null && (
              <span className={cn("relative rounded-full px-1.5 font-mono text-[10px]", active ? "bg-onyx/15 text-onyx" : "bg-fg/8 text-ink-300")}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Visually hidden table twin of a chart (screen readers / no-colour fallback). */
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
            {r.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Rounded panel with title row — the same surface as admin Cards / cabinet Panels. */
export function Block({
  title,
  subtitle,
  icon: Icon,
  action,
  children,
  className,
  bodyClassName,
  tone = "gold",
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: IconType;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  tone?: "gold" | "danger" | "info" | "success";
}) {
  const iconTone = {
    gold: "border-gold-500/20 bg-gold-500/10 text-gold-300",
    danger: "border-danger/25 bg-danger/10 text-danger",
    info: "border-info/25 bg-info/10 text-info",
    success: "border-success/25 bg-success/10 text-success",
  }[tone];
  return (
    <section className={cn("relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-ink-900 shadow-card", className)}>
      <header className="flex items-start gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
        {Icon && (
          <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl border", iconTone)}>
            <Icon size={18} variant="Bulk" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold tracking-tight text-stone-100">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-ink-400">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <div className={cn("min-w-0 flex-1 p-4 sm:p-5", bodyClassName)}>{children}</div>
    </section>
  );
}
