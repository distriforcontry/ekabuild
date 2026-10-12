"use client";
import * as React from "react";
import { PROJECT_STATUSES, VERIFICATION_STATUSES } from "@eka/shared";
import { motion } from "motion/react";
import { CloseCircle, ExportSquare, Global, Refresh2, TickCircle } from "iconsax-reactjs";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/misc";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/status-badge";
import { TrustRing } from "@/components/ui/trust-ring";
import { useI18n } from "@/i18n/client";
import { api, errorMessage } from "@/lib/api";
import { ExcelButton } from "@/components/control/ExportButton";
import { useAdmin } from "./context";
import { ArchiveTabs, archiveViewOf, archiveViewPatch, ControlBadges, useControlActions } from "./control";
import { useFormat } from "./format";
import { settle, useApiList, useListState } from "./hooks";
import { Dim, ErrorNotice, FilterSelect, OptimisticSwitch, ResetFilters, RowActions, SearchBox, useConfirm } from "./primitives";
import type { ProjectRow, TrustResult } from "./types";

const FILTERS = ["verification", "status", "archived"] as const;

export function ProjectsView() {
  const { t, label, tr } = useI18n();
  const f = useFormat();
  const { refreshCounts } = useAdmin();
  const list = useListState(FILTERS);
  const data = useApiList<ProjectRow>("/admin/projects", list.apiQuery);
  const [confirm, confirmNode] = useConfirm();
  const control = useControlActions(confirm);
  const view = archiveViewOf(list.filters);
  const [trust, setTrust] = React.useState<{ project: ProjectRow; previous: number; result: TrustResult | null; loading: boolean } | null>(null);

  const patch = async (p: ProjectRow, body: Partial<Pick<ProjectRow, "published" | "featured" | "verificationStatus">>) => {
    await api.patch(`/admin/projects/${p.id}`, body);
    data.mutate((items) => items.map((x) => (x.id === p.id ? { ...x, ...body } : x)));
  };

  const setVerification = (p: ProjectRow, status: "VERIFIED" | "REJECTED") =>
    confirm({
      title: status === "VERIFIED" ? t("admin.projects.approveTitle") : t("admin.projects.rejectTitle"),
      description: status === "VERIFIED" ? t("admin.projects.approveDesc", { name: tr(p.name) }) : t("admin.projects.rejectDesc", { name: tr(p.name) }),
      tone: status === "VERIFIED" ? "success" : "danger",
      icon: status === "VERIFIED" ? TickCircle : CloseCircle,
      confirmLabel: status === "VERIFIED" ? t("common.actions.approve") : t("common.actions.reject"),
      onConfirm: async () => {
        await patch(p, { verificationStatus: status });
        refreshCounts();
        toast.success(status === "VERIFIED" ? t("admin.projects.approved") : t("admin.projects.rejected"));
      },
    });

  const recalc = async (p: ProjectRow) => {
    setTrust({ project: p, previous: p.trustScore, result: null, loading: true });
    try {
      const result = await api.post<TrustResult>(`/admin/projects/${p.id}/recalculate-trust`);
      setTrust({ project: p, previous: p.trustScore, result, loading: false });
      data.mutate((items) => items.map((x) => (x.id === p.id ? { ...x, trustScore: result.trustScore } : x)));
    } catch (e) {
      setTrust(null);
      toast.error(t("admin.projects.recalcFailed"), { description: errorMessage(e) });
    }
  };

  const columns: Column<ProjectRow>[] = [
    {
      key: "name",
      header: t("admin.projects.columns.project"),
      sortable: true,
      alwaysVisible: true,
      exportValue: (p) => p.name,
      cell: (p) => (
        <div className="flex min-w-60 items-center gap-3">
          <div className="relative size-11 shrink-0 overflow-hidden rounded-xl border border-line bg-ink-800">
            {p.coverUrl ? <img src={p.coverUrl} alt="" className="size-full object-cover" loading="lazy" /> : <div className="bg-blueprint size-full" />}
          </div>
          <div className="min-w-0">
            <a
              href={`/projects/${p.slug}`}
              target="_blank"
              rel="noopener"
              onClick={(e) => e.stopPropagation()}
              className="block truncate font-semibold text-stone-100 transition hover:text-gold-300"
            >
              {tr(p.name)}
            </a>
            <div className="truncate text-xs text-ink-400">
              {tr(p.developer?.name)} · {t("admin.projects.units", { available: p.unitsAvailable ?? 0, total: p.unitsTotal ?? 0 })}
            </div>
            <ControlBadges row={p} className="mt-1 flex flex-wrap items-center gap-1 empty:hidden" />
          </div>
        </div>
      ),
    },
    { key: "region", header: t("admin.projects.columns.region"), hideOnMobile: true, exportValue: (p) => p.region, cell: (p) => <span className="text-ink-300">{tr(p.region)}</span> },
    {
      key: "status",
      header: t("admin.projects.columns.status"),
      exportValue: (p) => label("projectStatus", p.status),
      cell: (p) => (
        <div className="min-w-32">
          <StatusBadge kind="projectStatus" value={p.status} />
          <div className="mt-1.5 flex items-center gap-2">
            <Progress value={p.progress} className="h-1 w-16" />
            <span className="font-mono text-[10px] text-ink-400">{p.progress}%</span>
          </div>
        </div>
      ),
    },
    {
      key: "verificationStatus",
      header: t("admin.projects.columns.verification"),
      sortable: true,
      exportValue: (p) => label("verification", p.verificationStatus),
      cell: (p) => <StatusBadge kind="verification" value={p.verificationStatus} />,
    },
    {
      key: "trustScore",
      header: t("admin.projects.columns.trust"),
      sortable: true,
      align: "center",
      exportValue: (p) => p.trustScore,
      cell: (p) => <TrustRing score={p.trustScore} size={40} stroke={4} />,
    },
    {
      key: "published",
      header: t("admin.projects.columns.published"),
      align: "center",
      exportValue: (p) => (p.published ? 1 : 0),
      cell: (p) => (
        <OptimisticSwitch
          checked={p.published}
          aria-label={t("admin.projects.columns.published")}
          onChange={(v) => patch(p, { published: v })}
          successText={(v) => (v ? t("admin.projects.publishedOn") : t("admin.projects.publishedOff"))}
        />
      ),
    },
    {
      key: "featured",
      header: t("admin.projects.columns.featured"),
      align: "center",
      hideOnMobile: true,
      exportValue: (p) => (p.featured ? 1 : 0),
      cell: (p) => (
        <OptimisticSwitch
          checked={p.featured}
          aria-label={t("admin.projects.columns.featured")}
          onChange={(v) => patch(p, { featured: v })}
          successText={(v) => (v ? t("admin.projects.featuredOn") : t("admin.projects.featuredOff"))}
        />
      ),
    },
    {
      key: "createdAt",
      header: t("admin.projects.columns.created"),
      sortable: true,
      hideOnMobile: true,
      exportValue: (p) => p.createdAt,
      cell: (p) => <span className="whitespace-nowrap text-xs text-ink-400">{f.date(p.createdAt)}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      alwaysVisible: true,
      width: "56px",
      cell: (p) => (
        <RowActions
          actions={[
            { label: t("admin.projects.approve"), icon: TickCircle, tone: "success", onSelect: () => setVerification(p, "VERIFIED"), hidden: p.verificationStatus === "VERIFIED" },
            { label: t("admin.projects.reject"), icon: CloseCircle, tone: "danger", onSelect: () => setVerification(p, "REJECTED"), hidden: p.verificationStatus === "REJECTED" },
            { label: t("admin.projects.recalc"), icon: Refresh2, tone: "gold", onSelect: () => recalc(p), separatorBefore: true },
            { label: t("admin.common.openPublic"), icon: ExportSquare, onSelect: () => window.open(`/projects/${p.slug}`, "_blank", "noopener") },
            ...control.rowActions({
              archive: {
                entity: "projects",
                row: p,
                name: tr(p.name),
                onDone: (patch) => {
                  data.mutate((items) => items.map((x) => (x.id === p.id ? { ...x, ...patch } : x)));
                  data.reload();
                },
              },
            }),
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader eyebrow={t("admin.nav.moderation")} title={t("admin.projects.title")} description={t("admin.projects.description")} />
      <ErrorNotice error={data.error} onRetry={data.reload} />
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <ArchiveTabs value={view} onChange={(v) => list.update(archiveViewPatch(v))} />
      </div>
      <Dim active={data.refreshing}>
        <DataTable
          columns={columns}
          data={data.items}
          rowKey={(p) => p.id}
          loading={data.initialLoading}
          server={list.server(data.total)}
          initialSort={list.sort}
          selectable
          exportName="projects"
          emptyTitle={t("admin.projects.empty")}
          toolbar={
            <>
              <SearchBox value={list.q} onChange={(q) => list.update({ q })} />
              <FilterSelect
                value={list.filters.verification}
                onChange={(v) => list.update({ verification: v })}
                placeholder={t("admin.projects.filters.verification")}
                options={VERIFICATION_STATUSES.map((v) => ({ value: v, label: label("verification", v) }))}
              />
              <FilterSelect
                value={list.filters.status}
                onChange={(v) => list.update({ status: v })}
                placeholder={t("admin.projects.filters.status")}
                options={PROJECT_STATUSES.map((v) => ({ value: v, label: label("projectStatus", v) }))}
              />
              <ResetFilters count={list.activeFilters - (list.filters.archived ? 1 : 0)} onReset={() => list.update({ q: null, verification: null, status: null })} />
              <ExcelButton area="admin" entity="projects" filters={{ q: list.q, status: list.filters.status, archived: list.filters.archived }} className="sm:ml-auto" />
            </>
          }
          bulkActions={(rows, clear) => {
            const unverified = rows.filter((r) => r.verificationStatus !== "VERIFIED");
            const unpublished = rows.filter((r) => !r.published);
            return (
              <>
                <Button
                  size="sm"
                  variant="success"
                  disabled={!unverified.length}
                  onClick={() =>
                    confirm({
                      title: t("admin.projects.bulkApproveTitle", { count: unverified.length }),
                      tone: "success",
                      icon: TickCircle,
                      confirmLabel: t("common.actions.approve"),
                      onConfirm: async () => {
                        const { ok, fail } = await settle(unverified, (p) => patch(p, { verificationStatus: "VERIFIED" }));
                        refreshCounts();
                        toast[fail ? "warning" : "success"](fail ? t("admin.common.bulkPartial", { ok, fail }) : t("admin.common.bulkDone", { ok }));
                        clear();
                      },
                    })
                  }
                >
                  <TickCircle /> {t("admin.common.approveSelected")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!unpublished.length}
                  onClick={() =>
                    confirm({
                      title: t("admin.projects.bulkPublishTitle", { count: unpublished.length }),
                      icon: Global,
                      confirmLabel: t("admin.projects.publish"),
                      onConfirm: async () => {
                        const { ok, fail } = await settle(unpublished, (p) => patch(p, { published: true }));
                        toast[fail ? "warning" : "success"](fail ? t("admin.common.bulkPartial", { ok, fail }) : t("admin.common.bulkDone", { ok }));
                        clear();
                      },
                    })
                  }
                >
                  <Global /> {t("admin.projects.publish")}
                </Button>
              </>
            );
          }}
        />
      </Dim>

      <TrustDialog state={trust} onClose={() => setTrust(null)} />
      {confirmNode}
    </div>
  );
}

function TrustDialog({
  state,
  onClose,
}: {
  state: { project: ProjectRow; previous: number; result: TrustResult | null; loading: boolean } | null;
  onClose: () => void;
}) {
  const { t, tr } = useI18n();
  const delta = state?.result ? state.result.trustScore - state.previous : 0;
  return (
    <Dialog open={Boolean(state)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{t("admin.projects.recalcTitle")}</DialogTitle>
          <DialogDescription>{state ? tr(state.project.name) : ""}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          {!state?.result ? (
            <div className="flex flex-col items-center py-8">
              <div className="relative grid size-24 place-items-center">
                <span className="absolute inset-0 animate-spin rounded-full border-2 border-line-strong border-t-gold-400" />
                <span className="font-mono text-2xl text-ink-400">{state?.previous ?? "—"}</span>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center gap-3 py-2 text-center">
                <TrustRing score={state.result.trustScore} size={120} stroke={9} />
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-ink-400">{t("admin.projects.previous", { score: state.previous })}</span>
                  {delta !== 0 && (
                    <motion.span
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.8 }}
                      className={delta > 0 ? "font-mono font-semibold text-success" : "font-mono font-semibold text-danger"}
                    >
                      {delta > 0 ? `+${delta}` : delta}
                    </motion.span>
                  )}
                </div>
                <p className="max-w-sm text-xs text-ink-400">{t("admin.projects.recalcDesc")}</p>
              </div>
              {state.result.trustBreakdown?.length > 0 && (
                <div className="mt-5 border-t border-line pt-4">
                  <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-ink-400">{t("admin.projects.breakdown")}</div>
                  <ul className="space-y-3">
                    {state.result.trustBreakdown.map((b, i) => (
                      <motion.li key={b.key} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.05 }}>
                        <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                          <span className="text-ink-200">{tr(b.label)}</span>
                          <span className="font-mono text-xs text-stone-100">
                            {b.score}
                            <span className="text-ink-500"> / {b.max}</span>
                          </span>
                        </div>
                        <Progress value={b.max ? (b.score / b.max) * 100 : 0} tone={b.score >= b.max ? "success" : "gold"} />
                        {b.note && <div className="mt-1 text-xs text-ink-400">{tr(b.note)}</div>}
                      </motion.li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </DialogBody>
        <DialogFooter>
          {state && (
            <Button variant="ghost" asChild>
              <a href={`/projects/${state.project.slug}`} target="_blank" rel="noopener">
                <ExportSquare /> {t("admin.common.openPublic")}
              </a>
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            {t("common.actions.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
