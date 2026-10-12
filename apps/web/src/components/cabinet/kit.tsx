"use client";
import * as React from "react";
import Link from "next/link";
import { animate, motion, useReducedMotion } from "motion/react";
import type { Icon as IconType } from "iconsax-reactjs";
import { ArrowRight2 } from "iconsax-reactjs";
import { useBreadcrumb } from "@/components/layout/Breadcrumbs";
import { cn } from "@/lib/utils";

/**
 * Number that animates to `value` as soon as it mounts (and from the previous value when it changes).
 * Unlike a scroll-triggered counter it never gets stuck at 0 when the tile is skipped by a fast scroll.
 */
export function AnimatedNumber({ value, duration = 1.1, format }: { value: number; duration?: number; format?: (n: number) => string }) {
  const reduce = useReducedMotion();
  const fmtRef = React.useRef(format);
  fmtRef.current = format;
  const fmt = (n: number) => (fmtRef.current ? fmtRef.current(n) : new Intl.NumberFormat("uz-UZ").format(Math.round(n)).replace(/,/g, " "));
  const from = React.useRef(0);
  const [shown, setShown] = React.useState(() => (reduce ? value : 0));
  React.useEffect(() => {
    const target = Number.isFinite(value) ? value : 0;
    if (reduce) {
      setShown(target);
      from.current = target;
      return;
    }
    const controls = animate(from.current, target, { duration, ease: [0.16, 1, 0.3, 1], onUpdate: setShown });
    from.current = target;
    return () => controls.stop();
  }, [value, duration, reduce]);
  return <span className="tabular-nums">{fmt(shown)}</span>;
}

/**
 * Cabinet page kit — one rhythm for every /app page:
 * PageHead (eyebrow + display title + description + actions), Kpi tiles, Panel cards, SeeAll links.
 */

export function PageHead({
  eyebrow,
  icon: Icon,
  title,
  description,
  actions,
  meta,
  crumb,
  className,
}: {
  eyebrow?: React.ReactNode;
  icon?: IconType;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** badges under the title */
  meta?: React.ReactNode;
  /** dynamic breadcrumb label for detail pages */
  crumb?: string | null;
  className?: string;
}) {
  useBreadcrumb(crumb);
  return (
    <header className={cn("mb-8 flex flex-col gap-5 md:mb-10 md:flex-row md:items-end md:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-3 flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.26em] text-gold-400">
            <span aria-hidden className="h-px w-7 bg-gradient-to-r from-gold-500/0 to-gold-500" />
            {Icon && <Icon size={14} variant="Bulk" className="shrink-0" />}
            <span className="truncate">{eyebrow}</span>
          </div>
        )}
        <h1 className="text-balance bg-gradient-to-br from-stone-100 from-40% to-gold-200 bg-clip-text pb-1 font-display text-[34px] font-medium leading-[1.05] text-transparent md:text-[44px]">
          {title}
        </h1>
        {description && <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-ink-300 md:text-[15px]">{description}</p>}
        {meta && <div className="mt-4 flex flex-wrap items-center gap-2">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div>}
    </header>
  );
}

export function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  href,
  footer,
  index = 0,
  accent,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: IconType;
  href?: string;
  footer?: React.ReactNode;
  index?: number;
  /** highlighted tile (gold border + glow) */
  accent?: boolean;
  className?: string;
}) {
  const body = (
    <>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-12 -top-12 size-36 rounded-full blur-2xl transition-opacity duration-500",
          accent ? "bg-gold-500/20" : "bg-gold-500/[0.07] group-hover:bg-gold-500/[0.14]",
        )}
      />
      <div className="relative flex items-start justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase leading-snug tracking-[0.14em] text-ink-400">{label}</span>
        {Icon && (
          <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-gold-500/20 bg-gradient-to-br from-gold-500/15 to-gold-500/[0.03] text-gold-300 transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-105">
            <Icon size={18} variant="Bulk" />
          </span>
        )}
      </div>
      <div className="relative mt-3 whitespace-nowrap font-mono text-[22px] font-semibold leading-none tracking-tight text-stone-100 sm:text-[26px] md:text-[30px]">{value}</div>
      {hint && <div className="relative mt-2 text-xs text-ink-400">{hint}</div>}
      {footer && <div className="relative mt-4">{footer}</div>}
      {href && (
        <ArrowRight2
          size={14}
          className="absolute bottom-4 right-4 text-ink-500 opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-gold-300 group-hover:opacity-100"
        />
      )}
    </>
  );
  const cls = cn(
    "group relative block h-full overflow-hidden rounded-2xl border bg-ink-900/80 p-4 shadow-card backdrop-blur-sm transition-all duration-300 md:p-5",
    accent ? "border-gold-500/30" : "border-line",
    href && "hover:-translate-y-0.5 hover:border-gold-500/30 hover:shadow-lift active:translate-y-0",
    className,
  );
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
      className="h-full"
    >
      {href ? (
        <Link href={href} className={cls}>
          {body}
        </Link>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </motion.div>
  );
}

export function Panel({
  title,
  subtitle,
  icon: Icon,
  action,
  children,
  className,
  bodyClassName,
  id,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: IconType;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("relative overflow-hidden rounded-2xl border border-line bg-ink-900/80 shadow-card backdrop-blur-sm", className)}>
      {title && (
        <header className="flex items-center gap-3 px-5 pt-5 md:px-6 md:pt-6">
          {Icon && (
            <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-gold-500/20 bg-gold-500/10 text-gold-300">
              <Icon size={18} variant="Bulk" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold tracking-tight text-stone-100 sm:truncate">{title}</h2>
            {subtitle && <p className="mt-0.5 line-clamp-2 text-xs text-ink-400">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={cn("p-5 md:p-6", bodyClassName)}>{children}</div>
    </section>
  );
}

/** "See all →" link; collapses to a round arrow on phones so panel titles keep their room. */
export function SeeAll({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      aria-label={children}
      className="group inline-flex size-8 items-center justify-center gap-1 rounded-full border border-line text-xs font-semibold text-ink-300 transition hover:border-gold-500/30 hover:bg-fg/5 hover:text-gold-300 sm:h-8 sm:w-auto sm:rounded-lg sm:border-transparent sm:px-2.5"
    >
      <span className="hidden sm:inline">{children}</span>
      <ArrowRight2 size={13} className="transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

/** Small inline empty state for panels. */
export function PanelEmpty({
  icon: Icon,
  title,
  hint,
  description,
  action,
  className,
}: {
  icon: IconType;
  title: string;
  hint?: string;
  /** alias of `hint` (drop-in for the ui EmptyState) */
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  hint = hint ?? description;
  return (
    <div className={cn("relative flex flex-col items-center overflow-hidden rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center", className)}>
      <div aria-hidden className="bg-blueprint absolute inset-0 opacity-40 [mask-image:radial-gradient(circle_at_50%_30%,black,transparent_70%)]" />
      <span className="relative grid size-14 place-items-center rounded-2xl border border-gold-500/25 bg-gradient-to-br from-gold-500/15 to-transparent text-gold-300 shadow-glow">
        <Icon size={26} variant="Bulk" />
      </span>
      <div className="relative mt-4 font-semibold text-stone-100">{title}</div>
      {hint && <p className="relative mt-1 max-w-sm text-sm text-ink-400">{hint}</p>}
      {action && <div className="relative mt-5">{action}</div>}
    </div>
  );
}
