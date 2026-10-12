"use client";
import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import type { Icon as IconType } from "iconsax-reactjs";
import { ArrowRight, ClipboardTick, DocumentText, Map1, SearchStatus, ShieldTick, TaskSquare, Timer1, Verify, Warning2 } from "iconsax-reactjs";
import type { InspectionResult, InspectionType } from "@eka/shared";
import { StatusBadge } from "@/components/ui/status-badge";
import { useI18n } from "@/i18n/client";
import { api } from "@/lib/api";
import type { InspectionItem, ProjectCard, ProjectDetail } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useCabinetUser } from "../CabinetContext";
import { asList } from "../hooks";
import { useFmt } from "../format";
import { AnimatedNumber, Kpi, PageHead, Panel, PanelEmpty, SeeAll } from "../kit";
import { ErrorState, ListSkeleton, StatCardsSkeleton } from "../states";
import { InspectorQueue, isExpired, useInspectorQueue } from "./InspectorQueue";

type RecentInspection = InspectionItem & { project: { slug: string; name: string } };

/**
 * There is no "my inspections" endpoint yet, so recent inspections are collected from the newest projects' public detail
 * (each carries its inspection acts) — mine are highlighted.
 */
function useRecentInspections() {
  const [state, setState] = React.useState<{ items: RecentInspection[]; loading: boolean; error: unknown }>({ items: [], loading: true, error: null });
  const load = React.useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const list = asList<ProjectCard>(await api.get<unknown>("/projects", { query: { sort: "new", pageSize: 12 } }));
      const details = await Promise.allSettled(list.map((p) => api.get<ProjectDetail>(`/projects/${p.slug}`)));
      const items: RecentInspection[] = [];
      for (const r of details) {
        if (r.status !== "fulfilled") continue;
        for (const i of r.value.inspections ?? []) items.push({ ...i, project: { slug: r.value.slug, name: r.value.name } });
      }
      items.sort((a, b) => +new Date(b.date) - +new Date(a.date));
      setState({ items: items.slice(0, 6), loading: false, error: null });
    } catch (e) {
      setState({ items: [], loading: false, error: e });
    }
  }, []);
  React.useEffect(() => {
    void load();
  }, [load]);
  return { ...state, reload: load };
}

export function InspectorDashboardView() {
  const { t } = useI18n();
  const queue = useInspectorQueue();
  const recent = useRecentInspections();
  const certs = queue.data?.certificates ?? [];
  const docs = queue.data?.documents ?? [];
  const expired = certs.filter(isExpired).length;

  return (
    <div className="space-y-6 md:space-y-8">
      <PageHead
        eyebrow={t("app.shell.sections.inspector")}
        icon={ShieldTick}
        title={t("app.inspector.dashboard.title")}
        description={t("app.inspector.dashboard.subtitle")}
      />

      <div className="grid gap-3 md:grid-cols-3 md:gap-4">
        <QuickCard index={0} href="/app/inspector/inspections/new" icon={ClipboardTick} title={t("app.inspector.dashboard.quick.inspection")} text={t("app.inspector.dashboard.quick.inspectionHint")} primary />
        <QuickCard index={1} href="/app/inspector/queue" icon={TaskSquare} title={t("app.inspector.dashboard.quick.queue")} text={t("app.inspector.dashboard.quick.queueHint")} />
        <QuickCard index={2} href="/app/inspector/cadastre" icon={Map1} title={t("app.inspector.dashboard.quick.cadastre")} text={t("app.inspector.dashboard.quick.cadastreHint")} />
      </div>

      {queue.loading ? (
        <StatCardsSkeleton count={4} />
      ) : queue.error ? null : (
        <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
          <Kpi index={0} href="/app/inspector/queue" label={t("app.inspector.dashboard.stats.certificates")} value={<AnimatedNumber value={certs.length} />} icon={Verify} accent={certs.length > 0} />
          <Kpi index={1} href="/app/inspector/queue?tab=documents" label={t("app.inspector.dashboard.stats.documents")} value={<AnimatedNumber value={docs.length} />} icon={DocumentText} accent={docs.length > 0} />
          <Kpi index={2} label={t("app.inspector.dashboard.stats.expired")} value={<AnimatedNumber value={expired} />} hint={t("app.inspector.dashboard.stats.expiredHint")} icon={Timer1} />
          <Kpi index={3} label={t("app.inspector.dashboard.stats.total")} value={<AnimatedNumber value={certs.length + docs.length} />} hint={t("app.inspector.dashboard.stats.totalHint")} icon={TaskSquare} />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
        <Panel
          icon={TaskSquare}
          title={t("app.inspector.dashboard.queueTitle")}
          subtitle={t("app.inspector.dashboard.queueSubtitle")}
          action={<SeeAll href="/app/inspector/queue">{t("common.actions.seeAll")}</SeeAll>}
          className="min-w-0"
        >
          {queue.error ? <ErrorState error={queue.error} onRetry={queue.reload} /> : <InspectorQueue state={queue} compact />}
        </Panel>
        <RecentInspections {...recent} />
      </div>
    </div>
  );
}

const RESULT_ICON: Record<InspectionResult, IconType> = { PASSED: ShieldTick, ISSUES: Warning2, FAILED: Warning2 };

function RecentInspections({ items, loading, error, reload }: { items: RecentInspection[]; loading: boolean; error: unknown; reload: () => void }) {
  const { t, label, tr } = useI18n();
  const fmt = useFmt();
  const { user } = useCabinetUser();
  return (
    <Panel icon={SearchStatus} title={t("app.inspector.dashboard.recent.title")} subtitle={t("app.inspector.dashboard.recent.subtitle")}>
      {loading ? (
        <ListSkeleton rows={4} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} compact />
      ) : !items.length ? (
        <PanelEmpty icon={SearchStatus} title={t("app.inspector.dashboard.recent.empty")} className="py-8" />
      ) : (
        <ol className="relative space-y-3 before:absolute before:bottom-3 before:left-[19px] before:top-3 before:w-px before:bg-line">
          {items.map((i, idx) => {
            const Icon = RESULT_ICON[i.result] ?? ShieldTick;
            const mine = i.inspector?.id === user.id;
            const open = i.violations?.filter((v) => !v.resolved).length ?? 0;
            return (
              <motion.li
                key={i.id}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: idx * 0.05 }}
                className="relative flex gap-3"
              >
                <span
                  className={cn(
                    "relative z-10 grid size-10 shrink-0 place-items-center rounded-xl border bg-ink-900",
                    i.result === "PASSED" ? "border-success/30 text-success" : i.result === "ISSUES" ? "border-warning/30 text-warning" : "border-danger/30 text-danger",
                  )}
                >
                  <Icon size={18} variant="Bulk" />
                </span>
                <Link href={`/projects/${i.project.slug}`} className="group min-w-0 flex-1 rounded-xl border border-line bg-ink-850/40 px-3 py-2.5 transition hover:border-gold-500/25">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-stone-100 group-hover:text-gold-300">{tr(i.project.name)}</span>
                    <StatusBadge kind="inspectionResult" value={i.result} />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink-400">
                    <span>{label("inspectionType", i.type as InspectionType)}</span>
                    <span>·</span>
                    <span>{fmt.date(i.date)}</span>
                    {open > 0 && <span className="text-warning">· {t("app.inspector.dashboard.recent.violations", { n: open })}</span>}
                  </div>
                  <div className="mt-1 truncate text-[11px] text-ink-400">
                    {mine ? <span className="font-semibold text-gold-300">{t("app.inspector.dashboard.recent.mine")}</span> : i.inspector?.fullName}
                  </div>
                </Link>
              </motion.li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}

function QuickCard({ href, icon: Icon, title, text, primary, index }: { href: string; icon: IconType; title: string; text: string; primary?: boolean; index: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}>
      <Link
        href={href}
        className={cn(
          "group relative flex h-full items-center gap-4 overflow-hidden rounded-2xl border bg-ink-900/80 p-4 shadow-card transition-all duration-300 hover:-translate-y-0.5 md:p-5",
          primary ? "border-gold-500/30 hover:border-gold-500/50" : "border-line hover:border-gold-500/30",
        )}
      >
        <div aria-hidden className={cn("bg-blueprint pointer-events-none absolute inset-0 transition-opacity duration-500 group-hover:opacity-60", primary ? "opacity-40" : "opacity-0")} />
        <span
          className={cn(
            "relative grid size-12 shrink-0 place-items-center rounded-xl transition-transform duration-500 group-hover:-rotate-6",
            primary ? "bg-gold-gradient text-onyx shadow-glow" : "border border-gold-500/25 bg-gold-500/10 text-gold-300",
          )}
        >
          <Icon size={22} variant={primary ? "Bold" : "Bulk"} />
        </span>
        <span className="relative min-w-0 flex-1">
          <span className="block font-semibold text-stone-100">{title}</span>
          <span className="mt-0.5 line-clamp-2 block text-sm text-ink-400">{text}</span>
        </span>
        <ArrowRight size={18} className="relative shrink-0 text-ink-400 transition group-hover:translate-x-1 group-hover:text-gold-300" />
      </Link>
    </motion.div>
  );
}
