"use client";
import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Add, ArrowRight2, Buildings2, Chart, Clock, DollarCircle, Home2, ReceiptText, ShieldTick, TickCircle } from "iconsax-reactjs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, StatCard } from "@/components/ui/misc";
import { Progress } from "@/components/ui/progress";
import { CountUp, Reveal } from "@/components/ui/reveal";
import { StatusBadge } from "@/components/ui/status-badge";
import { useI18n } from "@/i18n/client";
import type { ProjectCard, PurchaseItem } from "@/lib/types";
import { useCabinetUser } from "../CabinetContext";
import { asList, useApi } from "../hooks";
import { useFmt } from "../format";
import { ErrorState, ListSkeleton, StatCardsSkeleton } from "../states";
import { ProjectCover } from "../ui";

export type DevStats = { projects: number; unitsSold: number; unitsAvailable: number; revenue: string | number; pendingSignatures: number; avgTrust: number };
export type DevProject = ProjectCard & { published: boolean };

export function DevDashboardView() {
  const { t, tr } = useI18n();
  const fmt = useFmt();
  const { user } = useCabinetUser();
  const stats = useApi<DevStats>("/dev/stats");
  const projects = useApi<DevProject[]>("/dev/projects", undefined, { select: asList });
  const sales = useApi<PurchaseItem[]>("/dev/purchases", undefined, { select: asList });

  const s = stats.data;
  const totalUnits = s ? s.unitsSold + s.unitsAvailable : 0;
  const share = totalUnits ? Math.round((s!.unitsSold / totalUnits) * 100) : 0;

  return (
    <div>
      <PageHeader
        eyebrow={user.organization ? tr(user.organization.name) : t("app.shell.sections.developer")}
        title={t("app.developer.dashboard.title")}
        description={t("app.developer.dashboard.subtitle")}
        actions={
          <Button asChild variant="gold">
            <Link href="/app/developer/projects/new">
              <Add size={18} /> {t("app.developer.dashboard.newProject")}
            </Link>
          </Button>
        }
      />

      {user.organization && user.organization.status !== "VERIFIED" && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-warning/25 bg-warning/[0.06] px-4 py-3 text-sm text-ink-200">
          <Clock size={18} variant="Bulk" className="mt-px shrink-0 text-warning" />
          {user.organization.status === "REJECTED" ? t("app.settings.organization.rejected") : t("app.settings.organization.pending")}
        </div>
      )}

      {stats.loading ? (
        <StatCardsSkeleton count={6} />
      ) : stats.error ? (
        <ErrorState error={stats.error} onRetry={stats.reload} compact />
      ) : s ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 2xl:grid-cols-6">
          {[
            { label: t("app.developer.dashboard.stats.projects"), value: <CountUp value={s.projects} duration={1} />, icon: Buildings2 },
            { label: t("app.developer.dashboard.stats.unitsSold"), value: <CountUp value={s.unitsSold} duration={1} />, icon: TickCircle },
            { label: t("app.developer.dashboard.stats.unitsAvailable"), value: <CountUp value={s.unitsAvailable} duration={1} />, icon: Home2 },
            { label: t("app.developer.dashboard.stats.revenue"), value: fmt.compact(s.revenue), icon: DollarCircle },
            { label: t("app.developer.dashboard.stats.pendingSignatures"), value: <CountUp value={s.pendingSignatures} duration={1} />, icon: Clock },
            { label: t("app.developer.dashboard.stats.avgTrust"), value: <CountUp value={Math.round(s.avgTrust)} duration={1} />, icon: ShieldTick },
          ].map((x, i) => (
            <Reveal key={x.label} delay={i * 0.05} y={12}>
              <StatCard label={x.label} value={x.value} icon={x.icon} className="h-full" />
            </Reveal>
          ))}
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("app.developer.dashboard.projects.title")}</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/app/developer/projects">
                {t("app.developer.dashboard.viewAll")} <ArrowRight2 size={14} />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {projects.loading ? (
              <ListSkeleton rows={3} />
            ) : projects.error ? (
              <ErrorState error={projects.error} onRetry={projects.reload} compact />
            ) : !(projects.data ?? []).length ? (
              <div className="flex flex-col items-center rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center">
                <Buildings2 size={28} variant="Bulk" className="text-gold-300" />
                <div className="mt-3 font-semibold text-stone-100">{t("app.developer.dashboard.projects.empty")}</div>
                <p className="mt-1 max-w-sm text-sm text-ink-400">{t("app.developer.dashboard.projects.emptyHint")}</p>
                <Button asChild variant="gold" size="sm" className="mt-4">
                  <Link href="/app/developer/projects/new">
                    <Add size={16} /> {t("app.developer.dashboard.newProject")}
                  </Link>
                </Button>
              </div>
            ) : (
              <ul className="-mx-2 space-y-1">
                {(projects.data ?? []).slice(0, 5).map((p, i) => (
                  <motion.li key={p.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                    <Link href={`/app/developer/projects/${p.id}`} className="group flex items-center gap-4 rounded-xl px-2 py-2.5 transition hover:bg-fg/[0.04]">
                      <span className="size-14 shrink-0 overflow-hidden rounded-xl border border-line">
                        <ProjectCover src={p.coverUrl} alt={tr(p.name)} iconSize={20} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-stone-100">{tr(p.name)}</span>
                          {p.published ? <Badge tone="success">{t("app.developer.projects.published")}</Badge> : <Badge>{t("app.developer.projects.draft")}</Badge>}
                        </span>
                        <span className="mt-1.5 flex items-center gap-3">
                          <Progress value={p.progress} className="max-w-40" />
                          <span className="font-mono text-[11px] text-ink-400">{p.progress}%</span>
                        </span>
                      </span>
                      <span className="hidden flex-col items-end gap-1 sm:flex">
                        <StatusBadge kind="projectStatus" value={p.status} />
                        <StatusBadge kind="verification" value={p.verificationStatus} />
                      </span>
                    </Link>
                  </motion.li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="relative overflow-hidden">
            <div className="bg-blueprint pointer-events-none absolute inset-0 opacity-50" />
            <CardContent className="relative">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-ink-400">{t("app.developer.dashboard.salesShare")}</span>
                <Chart size={18} variant="Bulk" className="text-gold-300" />
              </div>
              <div className="mt-3 font-mono text-4xl font-semibold text-stone-100">
                <CountUp value={share} duration={1.2} />%
              </div>
              <Progress value={share} className="mt-4 h-2" />
              <div className="mt-3 flex justify-between text-xs text-ink-400">
                <span>
                  {t("app.developer.dashboard.stats.unitsSold")}: <span className="font-mono text-ink-200">{s?.unitsSold ?? 0}</span>
                </span>
                <span>
                  {t("app.developer.dashboard.stats.unitsAvailable")}: <span className="font-mono text-ink-200">{s?.unitsAvailable ?? 0}</span>
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>{t("app.developer.dashboard.sales.title")}</CardTitle>
                <CardDescription>{t("app.developer.sales.subtitle")}</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {sales.loading ? (
                <ListSkeleton rows={3} />
              ) : sales.error ? (
                <ErrorState error={sales.error} onRetry={sales.reload} compact />
              ) : !(sales.data ?? []).length ? (
                <div className="py-6 text-center text-sm text-ink-400">
                  <ReceiptText size={24} variant="Bulk" className="mx-auto mb-2 text-gold-300" />
                  {t("app.developer.dashboard.sales.empty")}
                </div>
              ) : (
                <ul className="space-y-2">
                  {(sales.data ?? []).slice(0, 5).map((p) => (
                    <li key={p.id}>
                      <Link
                        href={p.contract ? `/app/contracts/${p.contract.id}` : "/app/developer/sales"}
                        className="flex items-center gap-3 rounded-xl border border-line bg-ink-850/40 px-3 py-2.5 transition hover:border-line-strong"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-stone-100">{p.buyerOrg ? tr(p.buyerOrg.name) : p.buyer.fullName}</span>
                          <span className="block truncate text-xs text-ink-400">
                            {tr(p.project.name)}
                            {p.unit ? ` · № ${p.unit.number}` : ""}
                          </span>
                        </span>
                        <span className="text-right">
                          <span className="block font-mono text-xs text-stone-100">{fmt.compact(p.amount)}</span>
                          <StatusBadge kind="purchaseStatus" value={p.status} className="mt-1" />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
