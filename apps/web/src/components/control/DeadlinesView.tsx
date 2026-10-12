"use client";
import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Icon as IconType } from "iconsax-reactjs";
import { ArrowRight2, Award, Building4, CalendarTick, Danger, DocumentText, Flag, PenTool, Refresh, ShieldTick, Timer1, Warning2, WalletMoney, Clock } from "iconsax-reactjs";
import { useFormat } from "@/components/admin/format";
import { useApi, useListState } from "@/components/admin/hooks";
import { ErrorNotice, ResetFilters } from "@/components/admin/primitives";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n/client";
import type { Deadline, DeadlineKind, DeadlineSeverity, DeadlinesResponse } from "@/lib/types";
import { cn } from "@/lib/utils";
import { apiBase, type Area } from "./area";
import { ControlHeader, DaysBadge, Segmented, useMonthShort, useTrSafe } from "./ui";

const KINDS: DeadlineKind[] = ["payment", "reservation", "contract", "certificate", "project", "document", "complaint"];
const SEVERITIES: DeadlineSeverity[] = ["overdue", "critical", "soon"];
const HORIZONS = ["30", "60", "90", "180"] as const;
/** rows shown per group before "show more" */
const CAP = 10;

export const KIND_ICON: Record<DeadlineKind, IconType> = {
  certificate: Award,
  project: Building4,
  reservation: Timer1,
  payment: WalletMoney,
  contract: PenTool,
  complaint: Flag,
  document: DocumentText,
};

const SEV: Record<DeadlineSeverity, { icon: IconType; ring: string; dot: string; card: string; text: string; bar: string }> = {
  overdue: {
    icon: Danger,
    ring: "border-danger/35 bg-danger/12 text-danger",
    dot: "bg-danger",
    card: "border-danger/25 bg-gradient-to-br from-danger/[0.09] via-ink-900 to-ink-900",
    text: "text-danger",
    bar: "bg-danger",
  },
  critical: {
    icon: Warning2,
    ring: "border-warning/35 bg-warning/12 text-warning",
    dot: "bg-warning",
    card: "border-warning/25 bg-gradient-to-br from-warning/[0.08] via-ink-900 to-ink-900",
    text: "text-warning",
    bar: "bg-warning",
  },
  soon: {
    icon: Clock,
    ring: "border-info/30 bg-info/10 text-info",
    dot: "bg-info",
    card: "border-line bg-ink-900",
    text: "text-info",
    bar: "bg-info",
  },
};

type Group = "overdue" | "week" | "later";
const groupOf = (d: Deadline): Group => (d.daysLeft < 0 ? "overdue" : d.daysLeft <= 7 ? "week" : "later");

/** Deadlines control centre: severity summary, kind filters, horizon, grouped timeline with deep links. */
export function DeadlinesView({ area }: { area: Area }) {
  const { t } = useI18n();
  const f = useFormat();
  const reduce = useReducedMotion();
  const list = useListState(["kind", "severity", "days"] as const);
  const days = (HORIZONS as readonly string[]).includes(list.filters.days ?? "") ? list.filters.days! : "60";
  const res = useApi<DeadlinesResponse>(`${apiBase(area)}/deadlines`, { days });
  const kind = list.filters.kind as DeadlineKind | null;
  const severity = list.filters.severity as DeadlineSeverity | null;

  const items = React.useMemo(() => res.data?.items ?? [], [res.data]);
  const filtered = items.filter((d) => (!kind || d.kind === kind) && (!severity || d.severity === severity));
  const groups = (["overdue", "week", "later"] as Group[]).map((g) => ({ g, items: filtered.filter((d) => groupOf(d) === g) })).filter((x) => x.items.length);
  const summary = res.data?.summary ?? {};
  const activeFilters = (kind ? 1 : 0) + (severity ? 1 : 0);
  const [expanded, setExpanded] = React.useState<Partial<Record<Group, boolean>>>({});

  return (
    <div className="min-w-0">
      <ControlHeader
        area={area}
        icon={CalendarTick}
        title={t("admin.control.deadlines.title")}
        description={area === "admin" ? t("admin.control.deadlines.description") : t("admin.control.deadlines.descriptionDev")}
        actions={
          <Button variant="secondary" size="sm" onClick={res.reload} loading={res.loading && Boolean(res.data)}>
            {!(res.loading && res.data) && <Refresh />} {t("admin.control.refresh")}
          </Button>
        }
      />

      <ErrorNotice error={res.error} onRetry={res.reload} />

      {/* severity summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:gap-4">
        {SEVERITIES.map((s, i) => {
          const n = summary[s] ?? 0;
          const active = severity === s;
          const S = SEV[s];
          return (
            <motion.button
              key={s}
              type="button"
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => list.update({ severity: active ? null : s })}
              aria-pressed={active}
              className={cn(
                "group relative flex cursor-pointer items-center gap-4 overflow-hidden rounded-2xl border p-4 text-left shadow-card transition duration-300 hover:-translate-y-0.5 md:p-5",
                n ? S.card : "border-line bg-ink-900",
                active && "ring-2 ring-gold-400/60 ring-offset-2 ring-offset-ink-950",
              )}
            >
              <span className={cn("relative grid size-12 shrink-0 place-items-center rounded-2xl border", n ? S.ring : "border-success/25 bg-success/10 text-success")}>
                {n ? <S.icon size={22} variant="Bulk" /> : <ShieldTick size={22} variant="Bulk" />}
                {s === "overdue" && n > 0 && !reduce && <span className="absolute inset-0 animate-ping rounded-2xl border border-danger/40" style={{ animationDuration: "2.4s" }} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">{t(`admin.control.deadlines.severity.${s}`)}</span>
                <span className={cn("mt-0.5 block font-mono text-3xl font-semibold leading-none", n ? S.text : "text-stone-100")}>{res.data ? n : "—"}</span>
                <span className="mt-1 block truncate text-xs text-ink-400">{t(`admin.control.deadlines.severityHint.${s}`)}</span>
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* kind chips + horizon */}
      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-start">
      <div className="flex flex-1 flex-wrap items-center gap-2" role="group" aria-label={t("admin.control.deadlines.filters.kind")}>
        <KindChip active={!kind} onClick={() => list.update({ kind: null })} label={t("admin.control.deadlines.filters.all")} count={res.data ? items.length : null} />
        {KINDS.map((k) => {
          const n = summary[k] ?? 0;
          if (!n && kind !== k) return null;
          return <KindChip key={k} icon={KIND_ICON[k]} active={kind === k} onClick={() => list.update({ kind: kind === k ? null : k })} label={t(`admin.control.deadlines.kinds.${k}`)} count={n} />;
        })}
        <ResetFilters count={activeFilters} onReset={() => list.update({ kind: null, severity: null })} />
      </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{t("admin.control.deadlines.horizon")}</span>
          <Segmented
            value={days as (typeof HORIZONS)[number]}
            onChange={(v) => list.update({ days: v === "60" ? null : v })}
            label={t("admin.control.deadlines.horizon")}
            options={HORIZONS.map((h) => ({ value: h, label: t("admin.control.deadlines.horizonDays", { n: h }) }))}
          />
        </div>
      </div>

      {/* timeline */}
      <div className="mt-6">
        {!res.data ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={cn("flex gap-4", res.error && "opacity-40")}>
                <Skeleton className="hidden h-14 w-14 rounded-xl sm:block" />
                <Skeleton className="h-[72px] flex-1 rounded-2xl" />
              </div>
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="relative flex flex-col items-center overflow-hidden rounded-2xl border border-dashed border-line-strong px-6 py-16 text-center">
            <div aria-hidden className="bg-blueprint absolute inset-0 opacity-40 [mask-image:radial-gradient(circle_at_50%_30%,black,transparent_70%)]" />
            <span className="relative grid size-14 place-items-center rounded-2xl border border-success/30 bg-success/10 text-success shadow-glow">
              <ShieldTick size={26} variant="Bulk" />
            </span>
            <div className="relative mt-4 font-semibold text-stone-100">{items.length ? t("admin.control.deadlines.emptyFiltered") : t("admin.control.deadlines.empty")}</div>
            {!items.length && <p className="relative mt-1 max-w-sm text-sm text-ink-400">{t("admin.control.deadlines.emptyHint")}</p>}
          </div>
        ) : (
          <div className="space-y-8">
            {groups.map(({ g, items: rows }) => (
              <section key={g} aria-labelledby={`dl-${g}`}>
                <h2 id={`dl-${g}`} className="mb-3 flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.18em] text-ink-400">
                  <span className={cn("size-2 rounded-full", g === "overdue" ? "bg-danger" : g === "week" ? "bg-warning" : "bg-info")} />
                  {t(`admin.control.deadlines.groups.${g}`)}
                  <span className="rounded-full bg-fg/8 px-1.5 py-px font-mono text-[10px] text-ink-300">{rows.length}</span>
                  <span className="h-px flex-1 bg-line" />
                </h2>
                <ol className="relative">
                  <span aria-hidden className="absolute bottom-3 left-[19px] top-3 w-px bg-gradient-to-b from-line-strong via-line to-transparent sm:left-[91px]" />
                  <AnimatePresence initial={false}>
                    {(expanded[g] ? rows : rows.slice(0, CAP)).map((d, i) => (
                      <DeadlineRow key={`${d.kind}-${d.id}`} d={d} index={i} />
                    ))}
                  </AnimatePresence>
                </ol>
                {rows.length > CAP && (
                  <div className="pl-[52px] sm:pl-[124px]">
                    <Button variant="ghost" size="sm" onClick={() => setExpanded((e) => ({ ...e, [g]: !e[g] }))}>
                      {expanded[g] ? t("admin.control.deadlines.showLess") : t("admin.control.deadlines.showMore", { n: rows.length - CAP })}
                    </Button>
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
      {res.data && <p className="mt-6 text-center text-[11px] text-ink-500">{t("admin.control.updatedAt", { time: f.time(new Date()) })}</p>}
    </div>
  );
}

function KindChip({ icon: Icon, label, count, active, onClick }: { icon?: IconType; label: string; count: number | null; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition",
        active ? "border-gold-500/50 bg-gold-500/12 text-gold-200" : "border-line bg-ink-900 text-ink-300 hover:border-line-strong hover:text-stone-100",
      )}
    >
      {Icon && <Icon size={14} variant={active ? "Bold" : "Bulk"} className={active ? "text-gold-300" : "text-ink-400"} />}
      {label}
      {count != null && <span className={cn("rounded-full px-1.5 font-mono text-[10px]", active ? "bg-gold-500/20 text-gold-100" : "bg-fg/8 text-ink-300")}>{count}</span>}
    </button>
  );
}

function DeadlineRow({ d, index }: { d: Deadline; index: number }) {
  const { t } = useI18n();
  const tr = useTrSafe();
  const f = useFormat();
  const monthShort = useMonthShort();
  const reduce = useReducedMotion();
  const S = SEV[d.severity];
  const Icon = KIND_ICON[d.kind] ?? CalendarTick;
  const due = new Date(d.dueDate);
  return (
    <motion.li
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 12) * 0.03, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex items-stretch gap-3 pb-2 sm:gap-4"
    >
      {/* date column */}
      <div className="hidden w-14 shrink-0 flex-col items-center justify-center rounded-xl border border-line bg-ink-900 text-center sm:flex">
        <span className={cn("font-mono text-base font-semibold leading-none", d.severity === "overdue" ? "text-danger" : "text-stone-100")}>{due.getDate()}</span>
        <span className="mt-1 text-[10px] uppercase tracking-wider text-ink-400">{monthShort(due)}</span>
      </div>
      {/* node */}
      <span className={cn("relative z-[1] mt-2.5 grid size-10 shrink-0 place-items-center rounded-full border-2 bg-ink-900", S.ring)}>
        <Icon size={18} variant="Bulk" />
      </span>
      {/* card */}
      <Link
        href={d.link}
        className={cn(
          "group relative flex min-w-0 flex-1 items-center gap-3 overflow-hidden rounded-2xl border bg-ink-900 px-3.5 py-2.5 transition duration-300 hover:-translate-y-px hover:border-gold-500/35 hover:shadow-lift sm:px-4",
          d.severity === "overdue" ? "border-danger/25" : d.severity === "critical" ? "border-warning/25" : "border-line",
        )}
      >
        <span aria-hidden className={cn("absolute inset-y-0 left-0 w-[3px]", S.bar)} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center justify-between gap-2 sm:justify-start">
            <span className={cn("shrink-0 rounded-md border px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wider", S.ring)}>{t(`admin.control.deadlines.kinds.${d.kind}`)}</span>
            <span className="hidden min-w-0 truncate text-sm font-semibold text-stone-100 sm:block">{tr(d.title)}</span>
            <DaysBadge days={d.daysLeft} critical={7} className="sm:hidden" />
          </div>
          <div className="mt-1 line-clamp-2 text-sm font-semibold text-stone-100 sm:hidden">{tr(d.title)}</div>
          <div className="mt-0.5 truncate text-xs text-ink-400">
            <span className="sm:hidden">{f.date(d.dueDate)} · </span>
            {tr(d.subtitle)}
          </div>
        </div>
        <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
          <DaysBadge days={d.daysLeft} critical={7} />
          <span className="hidden text-[10.5px] text-ink-500 md:block">{f.date(d.dueDate)}</span>
        </div>
        <ArrowRight2 size={16} className="hidden shrink-0 text-ink-500 transition group-hover:translate-x-0.5 group-hover:text-gold-300 sm:block" aria-label={t("admin.control.deadlines.open")} />
      </Link>
    </motion.li>
  );
}
