"use client";
import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import type { Icon as IconType } from "iconsax-reactjs";
import {
  Activity,
  ArrowLeft,
  Bag2,
  Building4,
  Call,
  Calendar1,
  Clock,
  DocumentFilter,
  Heart,
  Lock1,
  Messages2,
  Mobile,
  Monitor,
  Receipt2,
  SearchNormal1,
  ShieldSearch,
  ShieldTick,
  Sms,
  Unlock,
  Verify,
  Eye,
  I3DRotate,
} from "iconsax-reactjs";
import { Block, SrTable, useMonthShort } from "@/components/control/ui";
import { useBreadcrumb } from "@/components/layout/Breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { formatMasked } from "@/components/ui/masked-input";
import { EmptyState } from "@/components/ui/misc";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tooltip } from "@/components/ui/tooltip";
import { useI18n } from "@/i18n/client";
import type { MessageKey } from "@/i18n/core";
import type { UserActivity } from "@/lib/types";
import { cn } from "@/lib/utils";
import { goldRamp } from "./charts";
import { useAdmin } from "./context";
import { useControlActions } from "./control";
import { useFormat } from "./format";
import { useApi } from "./hooks";
import { Avatar, CopyChip, ErrorNotice, useConfirm } from "./primitives";

const EASE = [0.16, 1, 0.3, 1] as const;

const EVENT_ICON: Record<string, IconType> = {
  project_view: Eye,
  model_open: I3DRotate,
  certificate_lookup: ShieldTick,
  file_check: DocumentFilter,
  favorite: Heart,
  search: SearchNormal1,
};

type Session = UserActivity["sessions"][number];

/** Very small UA parser: browser + OS + phone/desktop. */
export function parseUserAgent(ua: string | null | undefined) {
  if (!ua) return { browser: null, os: null, mobile: false };
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /YaBrowser/.test(ua)
        ? "Yandex"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Chrome\/|CriOS/.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua) && /Version\//.test(ua)
              ? "Safari"
              : /^curl\//.test(ua)
                ? "curl"
                : /HeadlessChrome|Playwright/.test(ua)
                  ? "Headless"
                  : (ua.split(/[\s/]/)[0] ?? null);
  const os = /Windows NT/.test(ua)
    ? "Windows"
    : /iPhone|iPad|iPod/.test(ua)
      ? "iOS"
      : /Mac OS X|Macintosh/.test(ua)
        ? "macOS"
        : /Android/.test(ua)
          ? "Android"
          : /Linux/.test(ua)
            ? "Linux"
            : null;
  return { browser, os, mobile: /Mobile|Android|iPhone|iPad/.test(ua) };
}

export function UserActivityView({ id }: { id: string }) {
  const { t, label, tr } = useI18n();
  const f = useFormat();
  const reduce = useReducedMotion();
  const { user: me } = useAdmin();
  const res = useApi<UserActivity>(`/admin/users/${id}/activity`);
  const [confirm, confirmNode] = useConfirm();
  const control = useControlActions(confirm);
  const d = res.data;
  useBreadcrumb(d?.user.fullName ?? null);

  if (!d) {
    return (
      <div>
        <BackLink />
        <ErrorNotice error={res.error} onRetry={res.reload} />
        {res.error && /404|topilmadi|not found/i.test(res.error) ? (
          <EmptyState icon={ShieldSearch} title={t("admin.control.activity.notFound")} />
        ) : (
          <div className={cn("space-y-4", res.error && "opacity-40")}>
            <Skeleton className="h-40 w-full rounded-2xl" />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-2xl" />
              ))}
            </div>
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        )}
      </div>
    );
  }

  const u = d.user;
  const blocked = u.status === "BLOCKED";
  const canEdit = u.id !== me.id && (me.role === "SUPERADMIN" || (u.role !== "ADMIN" && u.role !== "SUPERADMIN"));
  const kpis: { key: string; label: string; value: React.ReactNode; hint?: React.ReactNode; icon: IconType }[] = [
    { key: "lastSeen", label: t("admin.control.activity.kpi.lastSeen"), value: d.lastSeen ? f.relative(d.lastSeen) : "—", hint: d.lastSeen ? f.dateTime(d.lastSeen) : undefined, icon: Clock },
    {
      key: "active",
      label: t("admin.control.activity.kpi.activeDays"),
      value: (
        <>
          {d.activeDays90}
          <span className="text-base text-ink-500">/90</span>
        </>
      ),
      hint: t("admin.control.activity.kpi.activeDaysHint"),
      icon: Calendar1,
    },
    { key: "events", label: t("admin.control.activity.kpi.events"), value: f.number(d.totals.events), hint: t("admin.control.activity.kpi.eventsHint"), icon: Activity },
    { key: "purchases", label: t("admin.control.activity.kpi.purchases"), value: f.number(d.totals.purchases), icon: Bag2 },
    { key: "favorites", label: t("admin.control.activity.kpi.favorites"), value: f.number(d.totals.favorites), icon: Heart },
    { key: "support", label: t("admin.control.activity.kpi.support"), value: f.number(d.totals.supportThreads), icon: Messages2 },
  ];

  return (
    <div className="min-w-0">
      <BackLink />

      {/* profile header */}
      <motion.section
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className={cn(
          "relative overflow-hidden rounded-3xl border p-5 shadow-card md:p-7",
          blocked ? "border-danger/30 bg-gradient-to-br from-danger/[0.08] via-ink-900 to-ink-900" : "border-gold-500/20 bg-gradient-to-br from-gold-500/[0.07] via-ink-900 to-ink-900",
        )}
      >
        <div aria-hidden className="bg-blueprint absolute inset-0 opacity-40 [mask-image:linear-gradient(to_left,black,transparent_70%)]" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-center">
          <Avatar name={u.fullName} size={72} className="rounded-2xl shadow-glow" />
          <div className="min-w-0 flex-1">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-gold-400">{t("admin.control.activity.eyebrow")}</div>
            <h1 className="truncate text-2xl font-bold tracking-tight text-stone-100 md:text-3xl">{u.fullName}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone={u.role === "ADMIN" || u.role === "SUPERADMIN" ? "gold" : u.role === "DEVELOPER" ? "info" : u.role === "INSPECTOR" ? "success" : "neutral"}>{label("role", u.role)}</Badge>
              <Badge tone={blocked ? "danger" : "success"} dot>
                {t(`admin.users.status.${u.status}`)}
              </Badge>
              <CopyChip value={u.phone} display={formatMasked("phone", u.phone)} />
              {u.email && <CopyChip value={u.email} />}
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-4">
              <Meta label={t("admin.control.activity.profile.registered")} value={f.date(u.createdAt)} />
              <Meta label={t("admin.control.activity.profile.lastLogin")} value={u.lastLoginAt ? f.dateTime(u.lastLoginAt) : "—"} />
              <Meta
                label={t("admin.control.activity.profile.phoneVerified")}
                value={
                  u.phoneVerifiedAt ? (
                    <span className="inline-flex items-center gap-1 text-success">
                      <Verify size={13} variant="Bold" /> {f.date(u.phoneVerifiedAt)}
                    </span>
                  ) : (
                    <span className="text-warning">{t("admin.control.activity.profile.notVerified")}</span>
                  )
                }
              />
              <Meta label={t("admin.control.activity.profile.organization")} value={u.organization ? `${tr(u.organization.name)} · ${label("orgType", u.organization.type)}` : t("admin.users.individual")} />
            </dl>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 md:flex-col md:items-stretch">
            <Button asChild variant="secondary" size="sm">
              <a href={`tel:${u.phone}`}>
                <Call variant="Bulk" /> {t("admin.control.call")}
              </a>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <a href={`sms:${u.phone}`}>
                <Sms variant="Bulk" /> SMS
              </a>
            </Button>
            {canEdit && (
              <Button
                size="sm"
                variant={blocked ? "success" : "danger"}
                onClick={() => control.block("user", { id: u.id, status: u.status, blockReason: u.blockReason }, u.fullName, (p) => res.setData((x) => (x ? { ...x, user: { ...x.user, status: p.status ?? x.user.status, blockReason: p.blockReason ?? null }, sessions: p.status === "BLOCKED" ? x.sessions.map((s) => ({ ...s, active: false, revokedAt: s.revokedAt ?? new Date().toISOString() })) : x.sessions } : x)))}
              >
                {blocked ? <Unlock variant="Bold" /> : <Lock1 variant="Bold" />} {blocked ? t("admin.control.block.unblock") : t("admin.control.block.block")}
              </Button>
            )}
          </div>
        </div>
        {blocked && (
          <div className="relative mt-5 flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger/[0.07] p-3.5 text-sm">
            <Lock1 size={18} variant="Bulk" className="mt-0.5 shrink-0 text-danger" />
            <div>
              <div className="font-semibold text-danger">{t("admin.control.activity.blockedTitle")}</div>
              <div className="mt-0.5 text-ink-200">{u.blockReason ?? t("admin.control.block.noReason")}</div>
            </div>
          </div>
        )}
      </motion.section>

      {/* KPIs */}
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-6">
        {kpis.map((k, i) => (
          <motion.div
            key={k.key}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 + i * 0.04, ease: EASE }}
            className="group relative overflow-hidden rounded-2xl border border-line bg-ink-900 p-4 shadow-card"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase leading-snug tracking-[0.12em] text-ink-400">{k.label}</span>
              <k.icon size={18} variant="Bulk" className="shrink-0 text-gold-300" />
            </div>
            <div className={cn("mt-2 truncate font-mono font-semibold text-stone-100", k.key === "lastSeen" ? "text-base md:text-lg" : "text-xl md:text-2xl")}>{k.value}</div>
            {k.hint && <div className="mt-1 truncate text-[11px] text-ink-400">{k.hint}</div>}
          </motion.div>
        ))}
      </div>

      {/* heat-map + types */}
      <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-3">
        <Block icon={Calendar1} title={t("admin.control.activity.heatmap.title")} subtitle={t("admin.control.activity.heatmap.subtitle")} className="xl:col-span-2">
          <Heatmap days={d.daily} />
        </Block>
        <Block icon={Activity} title={t("admin.control.activity.types.title")} subtitle={t("admin.control.activity.types.subtitle")}>
          <TypeBars byType={d.totals.byType} />
        </Block>
      </div>

      {/* timeline + top projects */}
      <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-3">
        <Block icon={Clock} title={t("admin.control.activity.timeline.title")} subtitle={t("admin.control.activity.timeline.subtitle")} className="xl:col-span-2" bodyClassName="p-2 sm:p-3">
          <Timeline items={d.recent} />
        </Block>
        <div className="grid min-w-0 gap-4">
          <Block icon={Building4} title={t("admin.control.activity.top.title")} subtitle={t("admin.control.activity.top.subtitle")}>
            <TopProjects items={d.topProjects} />
          </Block>
          <Block icon={Receipt2} title={t("admin.control.activity.purchases.title")} subtitle={t("admin.control.activity.purchases.subtitle")} bodyClassName="p-2 sm:p-3">
            <Purchases items={d.purchases} />
          </Block>
        </div>
      </div>

      {/* sessions */}
      <section className="mt-6 min-w-0">
        <div className="mb-3">
          <h2 className="flex items-center gap-2 text-base font-semibold text-stone-100">
            <Monitor size={18} variant="Bulk" className="text-gold-300" /> {t("admin.control.activity.sessions.title")}
          </h2>
          <p className="text-sm text-ink-400">{t("admin.control.activity.sessions.subtitle")}</p>
        </div>
        <Sessions items={d.sessions} />
      </section>
      {confirmNode}
    </div>
  );
}

function BackLink() {
  const { t } = useI18n();
  return (
    <Link href="/admin/users" className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-400 transition hover:text-gold-300">
      <ArrowLeft size={16} /> {t("admin.control.activity.back")}
    </Link>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-ink-400">{label}</dt>
      <dd className="mt-0.5 truncate font-medium text-ink-100">{value}</dd>
    </div>
  );
}

/* ───────────────────────────── 90-day heat-map ───────────────────────────── */

function Heatmap({ days }: { days: UserActivity["daily"] }) {
  const { t } = useI18n();
  const f = useFormat();
  const monthShort = useMonthShort();
  const reduce = useReducedMotion();
  const max = Math.max(1, ...days.map((d) => d.count));
  // pad the first column so rows are weekdays (Mon → Sun)
  const first = days[0] ? new Date(`${days[0].date}T00:00:00`) : new Date();
  const lead = (first.getDay() + 6) % 7;
  const cells: ({ date: string; count: number } | null)[] = [...Array.from({ length: lead }, () => null), ...days];
  const weeks = Math.ceil(cells.length / 7);
  const weekdays = t("admin.control.activity.heatmap.weekdays").split(",");
  const level = (c: number) => (c === 0 ? 0 : Math.min(4, Math.ceil((c / max) * 4)));
  const ramp = [0, 0.25, 0.5, 0.75, 1];
  // month labels at the first column that starts a new month
  const months: { col: number; label: string }[] = [];
  for (let w = 0; w < weeks; w++) {
    const cell = cells.slice(w * 7, w * 7 + 7).find(Boolean);
    if (!cell) continue;
    const dt = new Date(`${cell.date}T00:00:00`);
    const lab = monthShort(dt);
    if (!months.length || months[months.length - 1]!.label !== lab) months.push({ col: w, label: lab });
  }

  return (
    <div className="min-w-0">
      <SrTable caption={t("admin.control.activity.heatmap.title")} head={["", "#"]} rows={days.filter((d) => d.count).map((d) => [d.date, d.count])} />
      <div className="flex gap-2" aria-hidden>
        <div className="grid shrink-0 grid-rows-7 gap-[4px] pt-5 text-[9px] leading-none text-ink-500 sm:text-[10px]">
          {weekdays.map((w, i) => (
            <span key={w} className={cn("flex items-center", i % 2 === 1 && "invisible sm:visible")}>
              {w}
            </span>
          ))}
        </div>
        <div className="inline-flex min-w-0 max-w-full flex-col">
          <div className="relative mb-1 h-4 text-[10px] text-ink-400">
            {months.map((m) => (
              <span key={`${m.col}-${m.label}`} className="absolute top-0 capitalize" style={{ left: `${(m.col / weeks) * 100}%` }}>
                {m.label}
              </span>
            ))}
          </div>
          <div className="grid grid-flow-col grid-rows-7 gap-[4px]" style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 26px))` }}>
            {cells.map((c, i) =>
              c ? (
                <Tooltip key={c.date} content={c.count ? t("admin.control.activity.heatmap.cell", { date: f.date(c.date), n: c.count }) : t("admin.control.activity.heatmap.none", { date: f.date(c.date) })}>
                  <motion.span
                    initial={reduce ? false : { opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: reduce ? 0 : Math.floor(i / 7) * 0.025 }}
                    className="block aspect-square w-full rounded-[4px] border border-line"
                    style={{ background: c.count ? goldRamp(ramp[level(c.count)]!) : "var(--color-ink-850)" }}
                  />
                </Tooltip>
              ) : (
                <span key={`pad-${i}`} />
              ),
            )}
          </div>
        </div>
      </div>
      <HeatStats days={days} />
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-ink-400" aria-hidden>
        {t("admin.control.activity.heatmap.less")}
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className="size-3 rounded-[3px] border border-line" style={{ background: l ? goldRamp(ramp[l]!) : "var(--color-ink-850)" }} />
        ))}
        {t("admin.control.activity.heatmap.more")}
      </div>
    </div>
  );
}

function HeatStats({ days }: { days: UserActivity["daily"] }) {
  const { t } = useI18n();
  const f = useFormat();
  const active = days.filter((d) => d.count > 0);
  const peak = active.reduce<UserActivity["daily"][number] | null>((m, d) => (!m || d.count > m.count ? d : m), null);
  let streak = 0;
  let run = 0;
  for (const d of days) {
    run = d.count > 0 ? run + 1 : 0;
    streak = Math.max(streak, run);
  }
  const avg = active.length ? active.reduce((s, d) => s + d.count, 0) / active.length : 0;
  const items = [
    { label: t("admin.control.activity.heatmap.peak"), value: peak ? t("admin.control.activity.heatmap.actions", { n: peak.count }) : "—", hint: peak ? f.date(peak.date) : null },
    { label: t("admin.control.activity.heatmap.avg"), value: avg ? avg.toFixed(1) : "—", hint: null },
    { label: t("admin.control.activity.heatmap.streak"), value: t("admin.control.activity.heatmap.streakDays", { n: streak }), hint: null },
  ];
  return (
    <dl className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line">
      {items.map((i) => (
        <div key={i.label} className="bg-ink-900 px-3 py-2.5">
          <dt className="truncate text-[10.5px] uppercase tracking-wider text-ink-400">{i.label}</dt>
          <dd className="mt-0.5 font-mono text-sm font-semibold text-stone-100">{i.value}</dd>
          {i.hint && <dd className="truncate text-[10.5px] text-ink-500">{i.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}

/* ───────────────────────────── breakdowns ───────────────────────────── */

function TypeBars({ byType }: { byType: Record<string, number> }) {
  const { t } = useI18n();
  const f = useFormat();
  const reduce = useReducedMotion();
  const rows = Object.entries(byType).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...rows.map((r) => r[1]));
  const total = rows.reduce((s, r) => s + r[1], 0);
  if (!rows.length) return <p className="py-8 text-center text-sm text-ink-400">{t("admin.control.activity.types.empty")}</p>;
  const typeLabel = (k: string) => {
    const v = t(`admin.control.activity.types.${k}` as MessageKey);
    return v.startsWith("admin.") ? k : v;
  };
  return (
    <ul className="space-y-3.5">
      {rows.map(([k, n], i) => {
        const Icon = EVENT_ICON[k] ?? Activity;
        return (
          <li key={k}>
            <div className="mb-1.5 flex items-center gap-2 text-sm">
              <Icon size={15} variant="Bulk" className="shrink-0 text-gold-300" />
              <span className="min-w-0 flex-1 truncate text-ink-200">{typeLabel(k)}</span>
              <span className="font-mono text-xs text-ink-400">{Math.round((n / total) * 100)}%</span>
              <span className="w-10 text-right font-mono text-sm font-semibold text-stone-100">{f.number(n)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-fg/8">
              <motion.div className="h-full rounded-full bg-gold-gradient" initial={reduce ? false : { width: 0 }} animate={{ width: `${(n / max) * 100}%` }} transition={{ duration: 0.9, delay: i * 0.06, ease: EASE }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function TopProjects({ items }: { items: UserActivity["topProjects"] }) {
  const { t, tr } = useI18n();
  if (!items.length) return <p className="py-6 text-center text-sm text-ink-400">{t("admin.control.activity.top.empty")}</p>;
  const max = Math.max(1, ...items.map((p) => p.count));
  return (
    <ol className="space-y-2.5">
      {items.map((p, i) => (
        <li key={p.id} className="flex items-center gap-3">
          <span className="grid size-6 shrink-0 place-items-center rounded-full border border-gold-500/30 bg-gold-500/10 font-mono text-[11px] text-gold-200">{i + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm text-ink-100">{tr(p.name)}</div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-fg/8">
              <div className="h-full rounded-full bg-gold-400/80" style={{ width: `${(p.count / max) * 100}%` }} />
            </div>
          </div>
          <span className="shrink-0 font-mono text-xs text-ink-300">{t("admin.control.activity.top.views", { n: p.count })}</span>
        </li>
      ))}
    </ol>
  );
}

function Timeline({ items }: { items: UserActivity["recent"] }) {
  const { t, tr } = useI18n();
  const f = useFormat();
  const reduce = useReducedMotion();
  if (!items.length) return <p className="py-10 text-center text-sm text-ink-400">{t("admin.control.activity.timeline.empty")}</p>;
  const typeLabel = (k: string) => {
    const v = t(`admin.control.activity.types.${k}` as MessageKey);
    return v.startsWith("admin.") ? k : v;
  };
  return (
    <ol className="relative max-h-[520px] overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin]">
      {items.map((e, i) => {
        const audit = e.kind === "audit";
        const Icon = audit ? ShieldSearch : (EVENT_ICON[e.type] ?? Activity);
        return (
          <motion.li
            key={`${e.at}-${i}`}
            initial={reduce ? false : { opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i, 14) * 0.025, duration: 0.35 }}
            className="relative flex items-start gap-3 rounded-xl px-2.5 py-2 transition hover:bg-fg/[0.03]"
          >
            {i < items.length - 1 && <span aria-hidden className="absolute left-[25px] top-10 h-[calc(100%-24px)] w-px bg-line" />}
            <span className={cn("relative grid size-8 shrink-0 place-items-center rounded-full border", audit ? "border-info/30 bg-info/10 text-info" : "border-gold-500/30 bg-gold-500/10 text-gold-300")}>
              <Icon size={15} variant="Bulk" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {audit ? <span className="rounded-md bg-fg/5 px-1.5 py-0.5 font-mono text-[11px] text-gold-200">{e.type}</span> : <span className="text-sm text-ink-100">{typeLabel(e.type)}</span>}
                {e.projectName && <span className="truncate text-sm font-medium text-stone-100">· {tr(e.projectName)}</span>}
                {audit && e.entity && <span className="text-xs text-ink-400">{e.entity}</span>}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-ink-400">
                <span title={f.dateTime(e.at)}>{f.relative(e.at)}</span>
                <span className={cn("rounded px-1 text-[9.5px] font-bold uppercase tracking-wider", audit ? "bg-info/10 text-info" : "bg-gold-500/10 text-gold-300")}>
                  {audit ? t("admin.control.activity.timeline.audit") : t("admin.control.activity.timeline.event")}
                </span>
                {e.ip && <span className="font-mono">{e.ip}</span>}
              </div>
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}

function Purchases({ items }: { items: UserActivity["purchases"] }) {
  const { t, tr } = useI18n();
  const f = useFormat();
  if (!items.length) return <p className="py-6 text-center text-sm text-ink-400">{t("admin.control.activity.purchases.empty")}</p>;
  return (
    <ul className="divide-y divide-line">
      {items.map((p) => (
        <li key={p.id}>
          <Link href={`/admin/purchases?q=${encodeURIComponent(p.number)}`} className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition hover:bg-fg/[0.03]">
            <div className="min-w-0 flex-1">
              <div className="font-mono text-xs font-semibold text-gold-200">{p.number}</div>
              <div className="truncate text-xs text-ink-400">
                {tr(p.project.name)} · {f.date(p.createdAt)}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="font-mono text-sm font-semibold text-stone-100">{f.compactMoney(p.amount)}</span>
              <StatusBadge kind="purchaseStatus" value={p.status} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Sessions({ items }: { items: Session[] }) {
  const { t } = useI18n();
  const f = useFormat();
  const columns: Column<Session>[] = [
    {
      key: "device",
      header: t("admin.control.activity.sessions.device"),
      alwaysVisible: true,
      cell: (s) => {
        const ua = parseUserAgent(s.userAgent);
        const Icon = ua.mobile ? Mobile : Monitor;
        return (
          <div className="flex min-w-48 items-center gap-3">
            <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl border", s.active ? "border-success/30 bg-success/10 text-success" : "border-line bg-ink-850 text-ink-400")}>
              <Icon size={17} variant="Bulk" />
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-stone-100">
                {ua.browser || ua.os ? t("admin.control.activity.sessions.on", { browser: ua.browser ?? "—", os: ua.os ?? "—" }) : t("admin.control.activity.sessions.unknown")}
              </div>
              <div className="max-w-64 truncate font-mono text-[10.5px] text-ink-500" title={s.userAgent ?? undefined}>
                {s.userAgent ?? "—"}
              </div>
            </div>
          </div>
        );
      },
    },
    { key: "ip", header: t("admin.control.activity.sessions.ip"), cell: (s) => <span className="font-mono text-xs text-ink-200">{s.ip ?? "—"}</span> },
    { key: "createdAt", header: t("admin.control.activity.sessions.created"), sortValue: (s) => s.createdAt, cell: (s) => <span className="whitespace-nowrap text-xs text-ink-300">{f.dateTime(s.createdAt)}</span> },
    { key: "expiresAt", header: t("admin.control.activity.sessions.expires"), hideOnMobile: true, cell: (s) => <span className="whitespace-nowrap text-xs text-ink-400">{f.date(s.expiresAt)}</span> },
    {
      key: "status",
      header: t("admin.control.activity.sessions.status"),
      cell: (s) =>
        s.active ? (
          <Badge tone="success" dot>
            {t("admin.control.activity.sessions.active")}
          </Badge>
        ) : s.revokedAt ? (
          <Tooltip content={f.dateTime(s.revokedAt)}>
            <span tabIndex={0} className="inline-flex">
              <Badge tone="danger" dot>
                {t("admin.control.activity.sessions.revoked")}
              </Badge>
            </span>
          </Tooltip>
        ) : (
          <Badge dot>{t("admin.control.activity.sessions.expired")}</Badge>
        ),
    },
  ];
  return <DataTable columns={columns} data={items} rowKey={(s) => s.id} dense pageSize={10} emptyTitle={t("admin.control.activity.sessions.empty")} initialSort={{ key: "createdAt", dir: "desc" }} />;
}
