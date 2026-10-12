"use client";
import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import type { Icon as IconType } from "iconsax-reactjs";
import {
  ArrowRight,
  Award,
  Chart,
  Buildings2,
  Building4,
  DocumentText,
  Flag,
  MoneyRecive,
  People,
  Receipt2,
  Refresh,
  ShieldSearch,
  TickCircle,
} from "iconsax-reactjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, StatCard } from "@/components/ui/misc";
import { CountUp } from "@/components/ui/reveal";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { PurchasesAreaChart, RegionBars, StatusDonut, TrustHistogram } from "./charts";
import { useFormat, shortHash } from "./format";
import { useApi } from "./hooks";
import { ErrorNotice } from "./primitives";
import type { AdminStats } from "./types";

const RU_MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const UZ_MONTHS = ["yan", "fev", "mar", "apr", "may", "iyun", "iyul", "avg", "sen", "okt", "noy", "dek"];

export function AdminDashboard() {
  const { t, label, locale, tr } = useI18n();
  const f = useFormat();
  const { data, loading, error, reload } = useApi<AdminStats>("/admin/stats");
  const [metric, setMetric] = React.useState<"count" | "amount">("count");
  const [loadedAt, setLoadedAt] = React.useState<Date | null>(null);

  React.useEffect(() => {
    if (data) setLoadedAt(new Date());
  }, [data]);

  const k = data?.kpi;
  const monthLabel = React.useCallback(
    (m: string) => {
      // "2026-03" → "mar 26"
      const [y, mm] = m.split("-");
      const idx = Number(mm) - 1;
      if (!y || Number.isNaN(idx) || idx < 0 || idx > 11) return m;
      const name = locale === "ru" ? RU_MONTHS[idx] : tr(UZ_MONTHS[idx]!);
      return `${name} ${y.slice(2)}`;
    },
    [locale, tr],
  );

  const purchases = React.useMemo(
    () => (data?.purchasesByMonth ?? []).map((p) => ({ month: p.month, count: Number(p.count) || 0, amount: Number(p.amount) || 0 })),
    [data],
  );

  const kpis: { key: string; label: string; value: React.ReactNode; hint: string; icon: IconType; href?: string }[] = k
    ? [
        { key: "users", label: t("admin.dashboard.kpi.users"), value: <CountUp value={k.users} />, hint: t("admin.dashboard.kpi.usersHint"), icon: People, href: "/admin/users" },
        { key: "orgs", label: t("admin.dashboard.kpi.organizations"), value: <CountUp value={k.organizations} />, hint: t("admin.dashboard.kpi.organizationsHint"), icon: Buildings2, href: "/admin/organizations" },
        { key: "projects", label: t("admin.dashboard.kpi.projects"), value: <CountUp value={k.projects} />, hint: t("admin.dashboard.kpi.projectsHint"), icon: Building4, href: "/admin/projects" },
        { key: "purchases", label: t("admin.dashboard.kpi.purchases"), value: <CountUp value={k.purchases} />, hint: t("admin.dashboard.kpi.purchasesHint"), icon: Receipt2, href: "/admin/purchases" },
        { key: "revenue", label: t("admin.dashboard.kpi.revenue"), value: f.compactMoney(k.revenue), hint: t("admin.dashboard.kpi.revenueHint"), icon: MoneyRecive, href: "/admin/purchases?status=PAID" },
        { key: "complaints", label: t("admin.dashboard.kpi.openComplaints"), value: <CountUp value={k.openComplaints} />, hint: t("admin.dashboard.kpi.complaintsHint"), icon: Flag, href: "/admin/complaints?status=OPEN" },
      ]
    : [];

  const attention: { key: string; label: string; count: number; icon: IconType; href: string }[] = k
    ? [
        { key: "orgs", label: t("admin.dashboard.attention.pendingOrgs"), count: k.pendingOrgs, icon: Buildings2, href: "/admin/organizations?status=PENDING" },
        { key: "projects", label: t("admin.dashboard.attention.pendingProjects"), count: k.pendingProjects, icon: Building4, href: "/admin/projects?verification=PENDING" },
        { key: "certs", label: t("admin.dashboard.attention.pendingCertificates"), count: k.pendingCertificates, icon: Award, href: "/admin/certificates?status=PENDING" },
        { key: "docs", label: t("admin.dashboard.attention.pendingDocuments"), count: k.pendingDocuments, icon: DocumentText, href: "/admin/documents?status=PENDING" },
      ]
    : [];

  return (
    <div>
      <PageHeader
        eyebrow={t("admin.dashboard.eyebrow")}
        title={t("admin.dashboard.title")}
        description={t("admin.dashboard.description")}
        actions={
          <div className="flex items-center gap-3">
            {loadedAt && <span className="hidden text-xs text-ink-400 sm:inline">{t("admin.common.updatedAt", { time: f.time(loadedAt) })}</span>}
            <Button variant="secondary" size="sm" onClick={reload} loading={loading && Boolean(data)}>
              {!(loading && data) && <Refresh />} {t("admin.common.refresh")}
            </Button>
          </div>
        }
      />

      <ErrorNotice error={error} onRetry={reload} />

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-6">
        {!k
          ? Array.from({ length: 6 }).map((_, i) => <KpiSkeleton key={i} dim={Boolean(error)} />)
          : kpis.map((kpi, i) => (
              <motion.div key={kpi.key} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}>
                <Link href={kpi.href ?? "#"} className="block h-full rounded-2xl transition hover:-translate-y-0.5 focus-visible:outline-2">
                  <StatCard label={kpi.label} value={kpi.value} hint={kpi.hint} icon={kpi.icon} className="h-full" />
                </Link>
              </motion.div>
            ))}
      </div>

      {/* Requires attention */}
      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-stone-100">{t("admin.dashboard.attention.title")}</h2>
            <p className="text-sm text-ink-400">{t("admin.dashboard.attention.subtitle")}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {!k
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className={cn("h-[104px] rounded-2xl", error && "opacity-40")} />)
            : attention.map(({ key, ...a }, i) => <AttentionCard key={key} {...a} index={i} />)}
        </div>
      </section>

      {/* Charts */}
      <div className="mt-8 grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader className="flex-col gap-3 sm:flex-row sm:items-start">
            <div>
              <CardTitle>{t("admin.dashboard.charts.purchases")}</CardTitle>
              <CardDescription>{t("admin.dashboard.charts.purchasesHint")}</CardDescription>
            </div>
            <Segmented
              value={metric}
              onChange={setMetric}
              options={[
                { value: "count", label: t("admin.dashboard.charts.count") },
                { value: "amount", label: t("admin.dashboard.charts.amount") },
              ]}
            />
          </CardHeader>
          <CardContent>
            {!data ? (
              <ChartSkeleton height={280} dim={Boolean(error)} />
            ) : purchases.length === 0 ? (
              <NoData />
            ) : (
              <>
                <SrTable
                  caption={t("admin.dashboard.charts.purchases")}
                  head={[t("admin.dashboard.charts.month"), metric === "count" ? t("admin.dashboard.charts.count") : t("admin.dashboard.charts.amount")]}
                  rows={purchases.map((p) => [monthLabel(p.month), metric === "count" ? f.number(p.count) : f.money(p.amount)])}
                />
                <PurchasesAreaChart
                  data={purchases}
                  metric={metric}
                  seriesLabel={metric === "count" ? t("admin.dashboard.charts.count") : t("admin.dashboard.charts.amount")}
                  format={(v) => (metric === "amount" ? f.compactMoney(v) : f.number(v))}
                  secondary={
                    metric === "count"
                      ? { label: t("admin.dashboard.charts.amount"), format: (v) => f.compactMoney(v) }
                      : { label: t("admin.dashboard.charts.count"), format: (v) => f.number(v) }
                  }
                  formatLabel={monthLabel}
                />
              </>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>{t("admin.dashboard.charts.byStatus")}</CardTitle>
              <CardDescription>{t("admin.dashboard.charts.byStatusHint")}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {!data ? (
              <ChartSkeleton height={220} round dim={Boolean(error)} />
            ) : !data.projectsByStatus?.length ? (
              <NoData />
            ) : (
              <StatusDonut
                data={data.projectsByStatus}
                labelFor={(s) => label("projectStatus", s)}
                totalLabel={t("admin.dashboard.charts.total")}
                unit={t("admin.dashboard.charts.projectsUnit")}
              />
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-3">
          <CardHeader>
            <div>
              <CardTitle>{t("admin.dashboard.charts.byRegion")}</CardTitle>
              <CardDescription>{t("admin.dashboard.charts.byRegionHint")}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {!data ? (
              <ChartSkeleton height={260} dim={Boolean(error)} />
            ) : !data.projectsByRegion?.length ? (
              <NoData />
            ) : (
              <>
                <SrTable
                  caption={t("admin.dashboard.charts.byRegion")}
                  head={[t("admin.dashboard.charts.region"), t("admin.dashboard.charts.byRegionHint")]}
                  rows={data.projectsByRegion.map((r) => [tr(r.region), String(r.count)])}
                />
                <RegionBars data={data.projectsByRegion} unit={t("admin.dashboard.charts.projectsUnit")} labelFor={tr} />
              </>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>{t("admin.dashboard.charts.trust")}</CardTitle>
              <CardDescription>{t("admin.dashboard.charts.trustHint")}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {!data ? (
              <ChartSkeleton height={240} dim={Boolean(error)} />
            ) : !data.trustDistribution?.length ? (
              <NoData />
            ) : (
              <>
                <SrTable
                  caption={t("admin.dashboard.charts.trust")}
                  head={[t("admin.dashboard.charts.bucket"), t("admin.dashboard.charts.byRegionHint")]}
                  rows={data.trustDistribution.map((r) => [r.bucket, String(r.count)])}
                />
                <TrustHistogram data={data.trustDistribution} unit={t("admin.dashboard.charts.projectsUnit")} />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent audit */}
      <Card className="mt-4">
        <CardHeader>
          <div>
            <CardTitle>{t("admin.dashboard.audit.title")}</CardTitle>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/audit">
              {t("admin.dashboard.audit.viewAll")} <ArrowRight />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="pt-3 md:pt-4">
          {!data ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className={cn("h-12 w-full", error && "opacity-40")} />
              ))}
            </div>
          ) : !data.recentAudit?.length ? (
            <p className="py-8 text-center text-sm text-ink-400">{t("admin.dashboard.audit.empty")}</p>
          ) : (
            <ol className="relative">
              {data.recentAudit.slice(0, 8).map((a, i) => (
                <motion.li
                  key={a.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.4 }}
                  className="relative flex items-start gap-4 border-b border-line py-3 pl-6 last:border-0"
                >
                  <span className="absolute left-[5px] top-0 h-full w-px bg-line-strong" aria-hidden />
                  <span className="absolute left-0 top-[18px] size-[11px] rounded-full border-2 border-ink-900 bg-gold-400" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="rounded-md bg-fg/5 px-1.5 py-0.5 font-mono text-[11px] text-gold-200">{a.action}</span>
                      <span className="text-ink-200">{entityLabel(t, a.entity)}</span>
                      {a.entityId && <span className="font-mono text-[11px] text-ink-400">#{a.entityId.slice(-8)}</span>}
                    </div>
                    <div className="mt-1 text-xs text-ink-400">
                      {a.actor?.fullName ?? t("admin.audit.system")} · {f.relative(a.createdAt)}
                    </div>
                  </div>
                  <span className="hidden items-center gap-1 font-mono text-[11px] text-ink-500 sm:inline-flex" title={a.hash}>
                    <ShieldSearch size={12} /> {shortHash(a.hash)}
                  </span>
                </motion.li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function entityLabel(t: ReturnType<typeof useI18n>["t"], entity: string) {
  const v = t(`admin.audit.entities.${entity}` as Parameters<typeof t>[0]);
  return v.startsWith("admin.audit.entities.") ? entity : v;
}

function AttentionCard({ label, count, icon: Icon, href, index }: { label: string; count: number; icon: IconType; href: string; index: number }) {
  const { t } = useI18n();
  const clear = !count;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + index * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
      <Link
        href={href}
        className={cn(
          "group relative flex items-center gap-4 overflow-hidden rounded-2xl border p-4 transition duration-300 hover:-translate-y-0.5",
          clear ? "border-line bg-ink-900 hover:border-line-strong" : "border-gold-500/25 bg-gradient-to-br from-gold-500/[0.09] to-transparent hover:border-gold-500/50 hover:shadow-glow",
        )}
      >
        <span
          className={cn(
            "grid size-12 shrink-0 place-items-center rounded-2xl border",
            clear ? "border-success/25 bg-success/10 text-success" : "border-gold-500/30 bg-gold-500/10 text-gold-300",
          )}
        >
          {clear ? <TickCircle size={22} variant="Bulk" /> : <Icon size={22} variant="Bulk" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-ink-200">{label}</div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            {clear ? (
              <span className="text-sm text-ink-400">{t("admin.dashboard.attention.clear")}</span>
            ) : (
              <>
                  <span className="font-mono text-2xl font-semibold text-stone-100">{count}</span>
                  <span className="text-xs text-ink-400">{t("admin.dashboard.attention.waiting")}</span>
              </>
            )}
          </div>
        </div>
        {!clear && (
          <span className="flex items-center gap-1 text-xs font-semibold text-gold-300 opacity-80 transition group-hover:opacity-100">
            <span className="hidden sm:inline">{t("admin.dashboard.attention.review")}</span>
            <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
          </span>
        )}
      </Link>
    </motion.div>
  );
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  const id = React.useId();
  return (
    <div role="radiogroup" className="inline-flex shrink-0 rounded-xl border border-line bg-ink-850 p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn("relative h-7 cursor-pointer rounded-lg px-3 text-xs font-semibold transition", active ? "text-onyx" : "text-ink-300 hover:text-stone-100")}
          >
            {active && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-lg bg-gold-gradient" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function KpiSkeleton({ dim }: { dim?: boolean }) {
  return (
    <div className={cn("rounded-2xl border border-line bg-ink-900 p-5", dim && "opacity-50")}>
      <div className="flex items-start justify-between">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="size-9 rounded-xl" />
      </div>
      <Skeleton className="mt-4 h-7 w-24" />
      <Skeleton className="mt-2 h-3 w-16" />
    </div>
  );
}

function ChartSkeleton({ height, round, dim }: { height: number; round?: boolean; dim?: boolean }) {
  if (round)
    return (
      <div className={cn("flex items-center gap-6", dim && "opacity-40")} style={{ height }}>
        <div className="relative size-[200px] shrink-0">
          <Skeleton className="size-full rounded-full" />
          <div className="absolute inset-[18%] rounded-full bg-ink-900" />
        </div>
        <div className="hidden flex-1 space-y-3 sm:block">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      </div>
    );
  return (
    <div className={cn("flex items-end gap-2", dim && "opacity-40")} style={{ height }}>
      {BAR_HEIGHTS.map((h, i) => (
        <div key={i} className="flex-1" style={{ height: `${h}%` }}>
          <Skeleton className="h-full w-full rounded-md" />
        </div>
      ))}
    </div>
  );
}

const BAR_HEIGHTS = [35, 52, 44, 68, 58, 74, 62, 80, 70, 88, 76, 92];

function NoData() {
  const { t } = useI18n();
  return <EmptyState icon={Chart} title={t("admin.dashboard.charts.noData")} className="border-0 py-10" />;
}

/** Visually hidden table twin of a chart for screen readers */
function SrTable({ caption, head, rows }: { caption: string; head: [string, string]; rows: [string, string][] }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">{head[0]}</th>
          <th scope="col">{head[1]}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([a, b]) => (
          <tr key={a}>
            <th scope="row">{a}</th>
            <td>{b}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
