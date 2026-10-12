"use client";
import * as React from "react";
import { COMPLAINT_CATEGORIES, COMPLAINT_STATUSES, type ComplaintStatus } from "@eka/shared";
import { motion } from "motion/react";
import type { Icon as IconType } from "iconsax-reactjs";
import { Clock, CloseCircle, DocumentText, Eye, Flag, MessageQuestion, Refresh, SearchStatus, Timer1, TickCircle, Warning2, Copy } from "iconsax-reactjs";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Field, Textarea } from "@/components/ui/input";
import { InfoRow, PageHeader } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/status-badge";
import { useI18n } from "@/i18n/client";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAdmin } from "./context";
import { useFormat } from "./format";
import { useApiList, useLatest, useListState } from "./hooks";
import { DetailSection, Dim, ErrorNotice, FilterSelect, ResetFilters, RowActions, SearchBox, Sheet, useConfirm } from "./primitives";
import { ExcelButton } from "@/components/control/ExportButton";
import { ArchiveTabs, archiveViewOf, archiveViewPatch, ControlBadges, useControlActions } from "./control";
import type { ComplaintRow } from "./types";

const FILTERS = ["status", "category", "archived"] as const;

const CATEGORY_META: Record<string, { icon: IconType; tone: "danger" | "warning" | "info" | "neutral" }> = {
  FRAUD: { icon: Warning2, tone: "danger" },
  FAKE_DOCUMENT: { icon: DocumentText, tone: "danger" },
  DOUBLE_SALE: { icon: Copy, tone: "danger" },
  DELAY: { icon: Timer1, tone: "warning" },
  QUALITY: { icon: SearchStatus, tone: "info" },
  OTHER: { icon: MessageQuestion, tone: "neutral" },
};

export function CategoryBadge({ category }: { category: string }) {
  const { label } = useI18n();
  const meta = CATEGORY_META[category] ?? CATEGORY_META.OTHER!;
  const Icon = meta.icon;
  return (
    <Badge tone={meta.tone}>
      <Icon variant="Bold" />
      {label("complaintCategory", category)}
    </Badge>
  );
}

export function ComplaintsView() {
  const { t, label, tr } = useI18n();
  const f = useFormat();
  const { refreshCounts } = useAdmin();
  const list = useListState(FILTERS);
  const data = useApiList<ComplaintRow>("/admin/complaints", list.apiQuery);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const open = data.items.find((c) => c.id === openId) ?? null;
  const shown = useLatest(open);
  const [confirm, confirmNode] = useConfirm();
  const control = useControlActions(confirm);
  const view = archiveViewOf(list.filters);

  const update = async (c: ComplaintRow, status: ComplaintStatus, resolution?: string) => {
    await api.patch(`/admin/complaints/${c.id}`, { status, resolution: resolution || undefined });
    data.mutate((items) => items.map((x) => (x.id === c.id ? { ...x, status, resolution: resolution ?? x.resolution } : x)));
    refreshCounts();
    toast.success(t("admin.complaints.updated"));
  };

  const quick = async (c: ComplaintRow, status: ComplaintStatus) => {
    try {
      await update(c, status);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const columns: Column<ComplaintRow>[] = [
    {
      key: "category",
      header: t("admin.complaints.columns.category"),
      exportValue: (c) => label("complaintCategory", c.category),
      cell: (c) => <CategoryBadge category={c.category} />,
    },
    {
      key: "message",
      header: t("admin.complaints.columns.message"),
      alwaysVisible: true,
      exportValue: (c) => c.message,
      cell: (c) => (
        <div className="min-w-60 max-w-md">
          <p className="line-clamp-2 text-sm text-ink-100">{c.message}</p>
          <ControlBadges row={c} className="mt-1 flex flex-wrap items-center gap-1 empty:hidden" />
        </div>
      ),
    },
    {
      key: "project",
      header: t("admin.complaints.columns.project"),
      hideOnMobile: true,
      exportValue: (c) => c.project?.name,
      cell: (c) =>
        c.project ? (
          <a href={`/projects/${c.project.slug}`} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()} className="line-clamp-1 max-w-44 text-ink-100 hover:text-gold-300">
            {tr(c.project.name)}
          </a>
        ) : (
          <span className="text-ink-500">—</span>
        ),
    },
    {
      key: "reporter",
      header: t("admin.complaints.columns.reporter"),
      hideOnMobile: true,
      exportValue: (c) => c.reporter?.fullName ?? c.contact,
      cell: (c) => (
        <div className="max-w-40">
          <div className="truncate text-sm text-ink-100">{c.reporter?.fullName ?? t("admin.complaints.anonymous")}</div>
          <div className="truncate font-mono text-[11px] text-ink-400">{c.reporter?.phone ?? c.contact ?? "—"}</div>
        </div>
      ),
    },
    {
      key: "status",
      header: t("admin.complaints.columns.status"),
      sortable: true,
      exportValue: (c) => label("complaintStatus", c.status),
      cell: (c) => <StatusBadge kind="complaintStatus" value={c.status} />,
    },
    {
      key: "createdAt",
      header: t("admin.complaints.columns.created"),
      sortable: true,
      exportValue: (c) => c.createdAt,
      cell: (c) => <span className="whitespace-nowrap text-xs text-ink-400" title={f.dateTime(c.createdAt)}>{f.relative(c.createdAt)}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      alwaysVisible: true,
      width: "56px",
      cell: (c) => (
        <RowActions
          actions={[
            { label: t("admin.common.details"), icon: Eye, onSelect: () => setOpenId(c.id) },
            { label: t("admin.complaints.take"), icon: Clock, tone: "gold", onSelect: () => quick(c, "IN_REVIEW"), hidden: c.status !== "OPEN", separatorBefore: true },
            { label: t("admin.complaints.resolve"), icon: TickCircle, tone: "success", onSelect: () => setOpenId(c.id), hidden: c.status === "RESOLVED" || c.status === "DISMISSED" },
            { label: t("admin.complaints.reopen"), icon: Refresh, onSelect: () => quick(c, "OPEN"), hidden: c.status === "OPEN" || c.status === "IN_REVIEW" },
            ...control.rowActions({
              archive: {
                entity: "complaints",
                row: c,
                name: label("complaintCategory", c.category),
                onDone: (patch) => {
                  data.mutate((items) => items.map((x) => (x.id === c.id ? { ...x, ...patch } : x)));
                  data.reload();
                  refreshCounts();
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
      <PageHeader eyebrow={t("admin.nav.moderation")} title={t("admin.complaints.title")} description={t("admin.complaints.description")} />
      <ErrorNotice error={data.error} onRetry={data.reload} />
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <ArchiveTabs value={view} onChange={(v) => list.update(archiveViewPatch(v))} />
      </div>
      <Dim active={data.refreshing}>
        <DataTable
          columns={columns}
          data={data.items}
          rowKey={(c) => c.id}
          loading={data.initialLoading}
          server={list.server(data.total)}
          initialSort={list.sort}
          onRowClick={(c) => setOpenId(c.id)}
          exportName="complaints"
          emptyTitle={t("admin.complaints.empty")}
          toolbar={
            <>
              <SearchBox value={list.q} onChange={(q) => list.update({ q })} />
              <FilterSelect
                value={list.filters.status}
                onChange={(v) => list.update({ status: v })}
                placeholder={t("admin.complaints.columns.status")}
                options={COMPLAINT_STATUSES.map((v) => ({ value: v, label: label("complaintStatus", v) }))}
              />
              <FilterSelect
                value={list.filters.category}
                onChange={(v) => list.update({ category: v })}
                placeholder={t("admin.complaints.filters.category")}
                options={COMPLAINT_CATEGORIES.map((v) => ({ value: v, label: label("complaintCategory", v) }))}
              />
              <ResetFilters count={list.activeFilters - (list.filters.archived ? 1 : 0)} onReset={() => list.update({ q: null, status: null, category: null })} />
              <ExcelButton area="admin" entity="complaints" filters={{ q: list.q, status: list.filters.status, archived: list.filters.archived }} className="sm:ml-auto" />
            </>
          }
        />
      </Dim>

      <ComplaintSheet complaint={shown} open={Boolean(open)} onClose={() => setOpenId(null)} onUpdate={update} />
      {confirmNode}
    </div>
  );
}

function ComplaintSheet({
  complaint,
  open,
  onClose,
  onUpdate,
}: {
  complaint: ComplaintRow | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (c: ComplaintRow, status: ComplaintStatus, resolution?: string) => Promise<void>;
}) {
  const { t, tr } = useI18n();
  const f = useFormat();
  const [resolution, setResolution] = React.useState("");
  const [busy, setBusy] = React.useState<ComplaintStatus | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const id = React.useId();

  React.useEffect(() => {
    setResolution(complaint?.resolution ?? "");
    setErr(null);
  }, [complaint?.id, complaint?.resolution]);

  const run = async (status: ComplaintStatus) => {
    if (!complaint) return;
    if ((status === "RESOLVED" || status === "DISMISSED") && !resolution.trim()) {
      setErr(t("admin.complaints.resolutionRequired"));
      return;
    }
    setBusy(status);
    try {
      await onUpdate(complaint, status, resolution.trim() || undefined);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const done = complaint?.status === "RESOLVED" || complaint?.status === "DISMISSED";

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={t("admin.complaints.detailTitle")}
      description={complaint ? f.dateTime(complaint.createdAt) : undefined}
      footer={
        complaint &&
        (done ? (
          <Button variant="secondary" onClick={() => run("OPEN")} loading={busy === "OPEN"}>
            <Refresh /> {t("admin.complaints.reopen")}
          </Button>
        ) : (
          <>
            {complaint.status === "OPEN" && (
              <Button variant="outline" onClick={() => run("IN_REVIEW")} loading={busy === "IN_REVIEW"}>
                <Clock /> {t("admin.complaints.take")}
              </Button>
            )}
            <Button variant="ghost" onClick={() => run("DISMISSED")} loading={busy === "DISMISSED"}>
              <CloseCircle /> {t("admin.complaints.dismiss")}
            </Button>
            <Button variant="gold" onClick={() => run("RESOLVED")} loading={busy === "RESOLVED"}>
              <TickCircle /> {t("admin.complaints.resolve")}
            </Button>
          </>
        ))
      }
    >
      {complaint && (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <CategoryBadge category={complaint.category} />
            <StatusBadge kind="complaintStatus" value={complaint.status} />
          </div>

          <DetailSection title={t("admin.complaints.workflow")}>
            <Workflow status={complaint.status} />
          </DetailSection>

          <DetailSection title={t("admin.complaints.message")}>
            <div className="relative rounded-2xl border border-line bg-ink-850 p-4">
              <Flag size={16} variant="Bulk" className="absolute right-4 top-4 text-ink-500" />
              <p className="whitespace-pre-line pr-6 text-sm leading-relaxed text-ink-100">{complaint.message}</p>
            </div>
          </DetailSection>

          <DetailSection>
            <InfoRow
              label={t("admin.complaints.columns.project")}
              value={
                complaint.project ? (
                  <a href={`/projects/${complaint.project.slug}`} target="_blank" rel="noopener" className="text-gold-300 hover:underline">
                    {tr(complaint.project.name)}
                  </a>
                ) : (
                  "—"
                )
              }
            />
            <InfoRow label={t("admin.complaints.columns.reporter")} value={complaint.reporter?.fullName ?? t("admin.complaints.anonymous")} />
            <InfoRow
              label={t("admin.complaints.contact")}
              value={
                complaint.reporter?.phone || complaint.contact ? (
                  <span className="font-mono">{complaint.reporter?.phone ?? complaint.contact}</span>
                ) : (
                  "—"
                )
              }
            />
          </DetailSection>

          <DetailSection>
            <Field label={t("admin.complaints.resolution")} htmlFor={id} error={err}>
              <Textarea
                id={id}
                value={resolution}
                onChange={(e) => {
                  setResolution(e.target.value);
                  setErr(null);
                }}
                aria-invalid={Boolean(err)}
                placeholder={t("admin.complaints.resolutionPlaceholder")}
                className="min-h-32"
              />
            </Field>
          </DetailSection>
        </>
      )}
    </Sheet>
  );
}

function Workflow({ status }: { status: ComplaintStatus }) {
  const { t, label } = useI18n();
  const idx = status === "OPEN" ? 0 : status === "IN_REVIEW" ? 1 : 2;
  const steps = [
    { key: "OPEN", label: t("admin.complaints.steps.OPEN") },
    { key: "IN_REVIEW", label: t("admin.complaints.steps.IN_REVIEW") },
    { key: "DONE", label: idx === 2 ? label("complaintStatus", status) : t("admin.complaints.steps.DONE") },
  ];
  return (
    <ol className="flex items-start">
      {steps.map((s, i) => {
        const reached = i <= idx;
        const current = i === idx;
        const dismissed = i === 2 && status === "DISMISSED";
        return (
          <li key={s.key} className="relative flex flex-1 flex-col items-center text-center">
            {i > 0 && (
              <span className="absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2 bg-line-strong">
                <motion.span
                  className="block h-full bg-gold-400"
                  initial={{ width: 0 }}
                  animate={{ width: reached ? "100%" : 0 }}
                  transition={{ duration: 0.5, delay: i * 0.12 }}
                />
              </span>
            )}
            <motion.span
              initial={false}
              animate={{ scale: current ? 1.08 : 1 }}
              className={cn(
                "relative z-10 grid size-8 place-items-center rounded-full border-2 text-xs font-bold transition-colors",
                reached ? (dismissed ? "border-ink-400 bg-ink-700 text-ink-200" : "border-gold-400 bg-gold-gradient text-onyx") : "border-line-strong bg-ink-850 text-ink-400",
                current && !dismissed && "shadow-glow",
              )}
            >
              {reached && i < idx ? <TickCircle size={14} variant="Bold" /> : i + 1}
            </motion.span>
            <span className={cn("mt-2 text-[11px] font-medium leading-tight", reached ? "text-stone-100" : "text-ink-400")}>{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
