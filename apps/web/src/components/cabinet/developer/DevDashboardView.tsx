"use client";
import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  Add,
  ArrowRight,
  Buildings2,
  Chart,
  Clock,
  DollarCircle,
  Edit2,
  FingerScan,
  Home2,
  ChartCircle as PieIcon,
  ReceiptText,
  ShieldTick,
  TickCircle,
  Verify,
} from "iconsax-reactjs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/status-badge";
import { useI18n } from "@/i18n/client";
import type { ProjectCard, PurchaseItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useCabinetUser } from "../CabinetContext";
import { asList, useApi } from "../hooks";
import { useFmt } from "../format";
import { AnimatedNumber, Kpi, PageHead, Panel, PanelEmpty, SeeAll } from "../kit";
import { ErrorState, ListSkeleton, StatCardsSkeleton } from "../states";
import { ProjectCover } from "../ui";
import { SalesByMonthChart, TrustBars, UnitsDonut, useMonthlySales } from "./DevCharts";

export type DevStats = {
  projects: number;
  unitsSold: number;
  unitsAvailable: number;
  unitsReserved?: number;
  unitsTotal?: number;
  /** collected payments */
  revenue: string | number;
  /** total value of contracts */
  contracted?: string | number;
  pendingSignatures: number;
  avgTrust: number;
};
export type DevProject = ProjectCard & { published: boolean };

export function DevDashboardView() {
  const { t, tr } = useI18n();
  const fmt = useFmt();
  const { user } = useCabinetUser();
  const stats = useApi<DevStats>("/dev/stats");
  const projects = useApi<DevProject[]>("/dev/projects", undefined, { select: asList });
  const sales = useApi<PurchaseItem[]>("/dev/purchases", undefined, { select: asList });
  const org = user.organization;

  // contracts waiting for the seller's signature (canSign comes with the list DTO)
  const toSign = React.useMemo(
    () => (sales.data ? sales.data.filter((p) => p.contract?.canSign) : null),
    [sales.data],
  );

  const s = stats.data;
  const monthly = useMonthlySales(sales.data ?? []);
  const donut = s ? { sold: s.unitsSold, reserved: s.unitsReserved ?? 0, available: s.unitsAvailable } : null;
  const trust = (projects.data ?? []).map((p) => ({ name: tr(p.name), score: p.trustScore })).sort((a, b) => b.score - a.score);
  const salesTotal = monthly.reduce((x, m) => x + m.amount, 0);

  return (
    <div className="space-y-6 md:space-y-8">
      <PageHead
        eyebrow={org ? tr(org.name) : t("app.shell.sections.developer")}
        icon={org?.status === "VERIFIED" ? Verify : Buildings2}
        title={t("app.developer.dashboard.title")}
        description={t("app.developer.dashboard.subtitle")}
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href="/app/developer/sales">
                <ReceiptText size={18} variant="Bulk" className="text-gold-300" /> {t("app.shell.nav.devSales")}
              </Link>
            </Button>
            <Button asChild variant="gold">
              <Link href="/app/developer/projects/new">
                <Add size={18} /> {t("app.developer.dashboard.newProject")}
              </Link>
            </Button>
          </>
        }
      />

      {org && org.status !== "VERIFIED" && (
        <div className="flex items-start gap-3 rounded-2xl border border-warning/25 bg-warning/[0.06] px-4 py-3 text-sm text-ink-200">
          <Clock size={18} variant="Bulk" className="mt-px shrink-0 text-warning" />
          {org.status === "REJECTED" ? t("app.settings.organization.rejected") : t("app.settings.organization.pending")}
        </div>
      )}

      {stats.loading ? (
        <StatCardsSkeleton count={6} />
      ) : stats.error ? (
        <ErrorState error={stats.error} onRetry={stats.reload} compact />
      ) : s ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 2xl:grid-cols-6">
          <Kpi index={0} href="/app/developer/projects" label={t("app.developer.dashboard.stats.projects")} value={<AnimatedNumber value={s.projects} />} icon={Buildings2} />
          <Kpi index={1} label={t("app.developer.dashboard.stats.unitsSold")} value={<AnimatedNumber value={s.unitsSold} />} icon={TickCircle} />
          <Kpi index={2} label={t("app.developer.dashboard.stats.unitsAvailable")} value={<AnimatedNumber value={s.unitsAvailable} />} icon={Home2} />
          <Kpi
            index={3}
            href="/app/developer/sales"
            label={t("app.developer.dashboard.stats.revenue")}
            value={<AnimatedNumber value={Number(s.revenue) || 0} duration={1.4} format={(n) => fmt.compact(Math.round(n))} />}
            hint={s.contracted != null ? t("app.developer.dashboard.stats.contractedHint", { v: fmt.compact(s.contracted) }) : undefined}
            icon={DollarCircle}
          />
          <Kpi
            index={4}
            href="/app/developer/sales"
            label={t("app.developer.dashboard.stats.pendingSignatures")}
            value={<AnimatedNumber value={s.pendingSignatures} />}
            icon={Clock}
            accent={s.pendingSignatures > 0}
          />
          <Kpi index={5} label={t("app.developer.dashboard.stats.avgTrust")} value={<AnimatedNumber value={Math.round(s.avgTrust)} />} hint="/ 100" icon={ShieldTick} />
        </div>
      ) : null}

      {/* charts */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel
          icon={Chart}
          title={t("app.developer.dashboard.charts.salesTitle")}
          subtitle={t("app.developer.dashboard.charts.salesSubtitle")}
          action={
            <span className="rounded-lg border border-line bg-ink-850/60 px-2.5 py-1 font-mono text-xs font-semibold text-stone-100">{fmt.compact(salesTotal)}</span>
          }
        >
          {sales.loading ? <div className="skeleton h-64 rounded-xl" /> : sales.error ? <ErrorState error={sales.error} onRetry={sales.reload} compact /> : <SalesByMonthChart data={monthly} />}
        </Panel>
        <Panel icon={PieIcon} title={t("app.developer.dashboard.charts.unitsTitle")} subtitle={t("app.developer.dashboard.charts.unitsSubtitle")}>
          {!donut ? <div className="skeleton mx-auto size-44 rounded-full" /> : <UnitsDonut {...donut} />}
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* pending seller signatures */}
        <Panel
          icon={FingerScan}
          title={t("app.developer.dashboard.signatures.title")}
          subtitle={t("app.developer.dashboard.signatures.subtitle")}
          action={(toSign?.length ?? 0) > 0 ? <span className="grid h-6 min-w-6 place-items-center rounded-full bg-gold-gradient px-2 font-mono text-[11px] font-bold text-onyx">{toSign!.length}</span> : undefined}
          className={cn((toSign?.length ?? 0) > 0 && "border-gold-500/25")}
        >
          {sales.error ? (
            <ErrorState error={sales.error} onRetry={sales.reload} compact />
          ) : sales.loading || toSign === null ? (
            <ListSkeleton rows={2} />
          ) : (
            <div className="space-y-5">
              {toSign.length === 0 ? (
                <div className="flex items-center gap-3 rounded-xl border border-success/20 bg-success/[0.06] p-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-success/15 text-success">
                    <TickCircle size={22} variant="Bulk" />
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-stone-100">{t("app.developer.dashboard.signatures.empty")}</div>
                    <div className="text-xs text-ink-400">{t("app.developer.dashboard.signatures.emptyHint")}</div>
                  </div>
                </div>
              ) : (
                <ul className="space-y-2">
                  {toSign.slice(0, 6).map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/app/contracts/${p.contract!.id}`}
                        className="group flex items-center gap-3 rounded-xl border border-line bg-ink-850/60 p-3 transition hover:-translate-y-0.5 hover:border-gold-500/40"
                      >
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gold-gradient text-onyx shadow-glow">
                          <FingerScan size={18} variant="Bold" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-stone-100">{p.buyerOrg ? tr(p.buyerOrg.name) : p.buyer.fullName}</span>
                          <span className="block truncate text-xs text-ink-400">
                            {p.contract!.number} · {tr(p.project.name)}
                            {p.unit ? ` · №${p.unit.number}` : ""}
                          </span>
                        </span>
                        <span className="hidden text-right sm:block">
                          <span className="block font-mono text-xs font-semibold text-stone-100">{fmt.compact(p.amount)}</span>
                          <StatusBadge kind="contractStatus" value={p.contract!.status} className="mt-1" />
                        </span>
                        <span className="shrink-0 rounded-lg border border-gold-500/30 px-2 py-1 text-[11px] font-semibold text-gold-300 transition group-hover:bg-gold-500/10">
                          {t("app.developer.sales.sign")}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {toSign.length > 6 && (
                <Link href="/app/developer/sales" className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-gold-500/30 py-2 text-xs font-semibold text-gold-300 transition hover:bg-gold-500/5">
                  {t("app.developer.dashboard.signatures.more", { n: toSign.length - 6 })} <ArrowRight size={14} />
                </Link>
              )}
              {(sales.data ?? []).length > 0 && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-400">{t("app.developer.dashboard.sales.title")}</span>
                    <SeeAll href="/app/developer/sales">{t("app.developer.dashboard.viewAll")}</SeeAll>
                  </div>
                  <ul className="divide-y divide-line">
                    {[...(sales.data ?? [])]
                      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
                      .slice(0, 4)
                      .map((p) => (
                        <li key={p.id}>
                          <Link href={p.contract ? `/app/contracts/${p.contract.id}` : "/app/developer/sales"} className="flex items-center gap-3 py-2.5 transition hover:opacity-80">
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-medium text-stone-100">{p.buyerOrg ? tr(p.buyerOrg.name) : p.buyer.fullName}</span>
                              <span className="block truncate text-[11px] text-ink-400">
                                {tr(p.project.name)}
                                {p.unit ? ` · №${p.unit.number}` : ""} · {fmt.short(p.createdAt)}
                              </span>
                            </span>
                            <span className="font-mono text-xs text-stone-100">{fmt.compact(p.amount)}</span>
                            <StatusBadge kind="purchaseStatus" value={p.status} />
                          </Link>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Panel>

        <Panel icon={ShieldTick} title={t("app.developer.dashboard.charts.trustTitle")} subtitle={t("app.developer.dashboard.charts.trustSubtitle")}>
          {projects.loading ? (
            <div className="skeleton h-40 rounded-xl" />
          ) : projects.error ? (
            <ErrorState error={projects.error} onRetry={projects.reload} compact />
          ) : trust.length ? (
            <TrustBars data={trust} />
          ) : (
            <PanelEmpty icon={ShieldTick} title={t("app.developer.dashboard.projects.empty")} className="py-8" />
          )}
        </Panel>
      </div>

      {/* projects & moderation */}
      <Panel
        icon={Buildings2}
        title={t("app.developer.dashboard.moderation.title")}
        subtitle={t("app.developer.dashboard.moderation.subtitle")}
        action={(projects.data ?? []).length > 0 ? <SeeAll href="/app/developer/projects">{t("app.developer.dashboard.viewAll")}</SeeAll> : undefined}
      >
        {projects.loading ? (
          <ListSkeleton rows={3} />
        ) : projects.error ? (
          <ErrorState error={projects.error} onRetry={projects.reload} compact />
        ) : !(projects.data ?? []).length ? (
          <PanelEmpty
            icon={Buildings2}
            title={t("app.developer.dashboard.projects.empty")}
            hint={t("app.developer.dashboard.projects.emptyHint")}
            action={
              <Button asChild variant="gold" size="sm">
                <Link href="/app/developer/projects/new">
                  <Add size={16} /> {t("app.developer.dashboard.newProject")}
                </Link>
              </Button>
            }
          />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {(projects.data ?? []).slice(0, 6).map((p, i) => (
              <ProjectModerationCard key={p.id} project={p} index={i} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function moderationKey(p: DevProject): "published" | "pending" | "rejected" | "draft" | "approved" {
  if (p.verificationStatus === "REJECTED") return "rejected";
  if (p.verificationStatus === "VERIFIED") return p.published ? "published" : "approved";
  return p.published ? "pending" : "draft";
}

function ProjectModerationCard({ project: p, index }: { project: DevProject; index: number }) {
  const { t, tr } = useI18n();
  const key = moderationKey(p);
  const tone = key === "published" ? "success" : key === "rejected" ? "danger" : key === "pending" ? "warning" : "neutral";
  return (
    <motion.li
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-ink-850/40 transition-all duration-300 hover:-translate-y-0.5 hover:border-gold-500/25 hover:shadow-lift"
    >
      <Link href={`/app/developer/projects/${p.id}`} className="absolute inset-0 z-10" aria-label={tr(p.name)} />
      <div className="relative h-28 overflow-hidden">
        <div className="size-full transition-transform duration-700 group-hover:scale-105">
          <ProjectCover src={p.coverUrl} alt={tr(p.name)} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/30 to-transparent" />
        <div className="absolute left-3 top-3">
          <StatusBadge kind="projectStatus" value={p.status} className="bg-ink-950/70 backdrop-blur" />
        </div>
        <span className="absolute right-3 top-3 rounded-full bg-ink-950/70 px-2 py-0.5 font-mono text-[11px] font-semibold text-gold-300 backdrop-blur">
          {p.trustScore}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <h3 className="min-w-0 flex-1 truncate font-semibold text-stone-100">{tr(p.name)}</h3>
          {p.verificationStatus === "VERIFIED" && <Verify size={16} variant="Bold" className="shrink-0 text-gold-400" />}
        </div>
        <div className="flex items-center gap-3">
          <Progress value={p.progress} className="flex-1" />
          <span className="font-mono text-[11px] text-ink-300">{p.progress}%</span>
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3">
          <Badge tone={tone} dot>
            {t(`app.developer.dashboard.moderation.states.${key}`)}
          </Badge>
          <span className="relative z-20 inline-flex items-center gap-1 text-xs font-semibold text-ink-300 transition group-hover:text-gold-300">
            {key === "rejected" || key === "draft" ? <Edit2 size={14} /> : <ArrowRight size={14} />}
            {key === "rejected" || key === "draft" ? t("app.developer.dashboard.moderation.fix") : t("app.developer.dashboard.moderation.open")}
          </span>
        </div>
      </div>
    </motion.li>
  );
}
