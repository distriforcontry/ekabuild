import * as React from "react";
import type { Icon as IconType } from "iconsax-reactjs";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  eyebrow?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between", className)}>
      <div>
        {eyebrow && <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-gold-400">{eyebrow}</div>}
        <h1 className="text-2xl font-bold tracking-tight text-stone-100 md:text-3xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-ink-300 md:text-[15px]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div className={cn("max-w-3xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow && (
        <div className={cn("mb-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-gold-400")}>
          <span className="h-px w-8 bg-gold-500/60" />
          {eyebrow}
        </div>
      )}
      <h2 className="font-display text-4xl font-medium leading-[1.05] text-stone-100 md:text-6xl">{title}</h2>
      {description && <p className="mt-5 text-base leading-relaxed text-ink-300 md:text-lg">{description}</p>}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: IconType;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong px-6 py-14 text-center", className)}>
      {Icon && (
        <div className="mb-4 grid size-14 place-items-center rounded-2xl border border-gold-500/20 bg-gold-500/5 text-gold-300">
          <Icon variant="Bulk" className="size-6" />
        </div>
      )}
      <h3 className="text-base font-semibold text-stone-100">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-ink-400">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  trend,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: IconType;
  trend?: { value: string; positive?: boolean };
  className?: string;
}) {
  return (
    <div className={cn("group relative overflow-hidden rounded-2xl border border-line bg-ink-900 p-5 shadow-card transition hover:border-line-strong", className)}>
      <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-gold-500/5 blur-2xl transition group-hover:bg-gold-500/10" />
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-ink-400">{label}</span>
        {Icon && (
          <span className="grid size-9 place-items-center rounded-xl border border-line bg-ink-800 text-gold-300">
            <Icon variant="Bulk" className="size-4" />
          </span>
        )}
      </div>
      <div className="mt-3 font-mono text-2xl font-semibold tracking-tight text-stone-100 md:text-[28px]">{value}</div>
      <div className="mt-1.5 flex items-center gap-2 text-xs">
        {trend && <span className={trend.positive === false ? "text-danger" : "text-success"}>{trend.value}</span>}
        {hint && <span className="text-ink-400">{hint}</span>}
      </div>
    </div>
  );
}

/** Key/value row used in detail panels */
export function InfoRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-line py-3 last:border-0">
      <span className="text-sm text-ink-400">{label}</span>
      <span className={cn("text-right text-sm text-stone-100", mono && "font-mono")}>{value}</span>
    </div>
  );
}
