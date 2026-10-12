"use client";
import * as React from "react";
import { DOCUMENT_TYPES, VERIFICATION_STATUSES, formatBytes } from "@eka/shared";
import { CloseCircle, DocumentDownload, Eye, Gallery, Lock1, TickCircle, DocumentText } from "iconsax-reactjs";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/status-badge";
import { useI18n } from "@/i18n/client";
import { api } from "@/lib/api";
import { ExcelButton } from "@/components/control/ExportButton";
import { useAdmin } from "./context";
import { ArchiveTabs, archiveViewOf, archiveViewPatch, ControlBadges, useControlActions } from "./control";
import { FilePreview } from "./FilePreview";
import { useFormat } from "./format";
import { settle, useApiList, useListState } from "./hooks";
import { Dim, ErrorNotice, FilterSelect, ResetFilters, RowActions, SearchBox, useConfirm } from "./primitives";
import type { DocRow } from "./types";

const FILTERS = ["status", "type", "archived"] as const;

export function DocumentsView() {
  const { t, label, tr } = useI18n();
  const f = useFormat();
  const { refreshCounts } = useAdmin();
  const list = useListState(FILTERS);
  const data = useApiList<DocRow>("/admin/documents", list.apiQuery);
  const [confirm, confirmNode] = useConfirm();
  const [previewId, setPreviewId] = React.useState<string | null>(null);
  const control = useControlActions(confirm);
  const view = archiveViewOf(list.filters);
  const preview = data.items.find((d) => d.id === previewId) ?? null;

  const apply = async (d: DocRow, status: "VERIFIED" | "REJECTED", rejectReason?: string) => {
    await api.patch(`/documents/${d.id}/verify`, { status, rejectReason: rejectReason || undefined });
    data.mutate((items) =>
      items.map((x) => (x.id === d.id ? { ...x, status, rejectReason: rejectReason ?? null, verifiedAt: status === "VERIFIED" ? new Date().toISOString() : x.verifiedAt } : x)),
    );
    refreshCounts();
  };

  const verify = (d: DocRow) =>
    confirm({
      title: t("admin.docs.verifyTitle"),
      description: t("admin.docs.verifyDesc", { title: tr(d.title) }),
      tone: "success",
      icon: TickCircle,
      confirmLabel: t("admin.docs.verify"),
      onConfirm: async () => {
        await apply(d, "VERIFIED");
        toast.success(t("admin.docs.verified"));
      },
    });

  const reject = (d: DocRow) =>
    confirm({
      title: t("admin.docs.rejectTitle"),
      description: t("admin.docs.rejectDesc", { title: tr(d.title) }),
      tone: "danger",
      icon: CloseCircle,
      confirmLabel: t("admin.docs.reject"),
      reason: { label: t("admin.common.reason"), placeholder: t("admin.common.reasonPlaceholder"), required: true },
      onConfirm: async (reason) => {
        await apply(d, "REJECTED", reason);
        toast.success(t("admin.docs.rejected"));
      },
    });

  const columns: Column<DocRow>[] = [
    {
      key: "title",
      header: t("admin.docs.columns.document"),
      alwaysVisible: true,
      sortable: true,
      exportValue: (d) => d.title,
      cell: (d) => (
        <div className="flex min-w-56 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-ink-850 text-gold-300">
            {d.file?.mime.startsWith("image/") ? <Gallery size={18} variant="Bulk" /> : <DocumentText size={18} variant="Bulk" />}
          </span>
          <div className="min-w-0">
            <div className="line-clamp-1 font-semibold text-stone-100">{tr(d.title)}</div>
            <div className="flex items-center gap-1.5 text-xs text-ink-400">
              {label("documentType", d.type)}
              {d.version > 1 && <span className="font-mono text-[10px] text-ink-500">· {t("admin.docs.version", { n: d.version })}</span>}
            </div>
            <ControlBadges row={d} className="mt-1 flex flex-wrap items-center gap-1 empty:hidden" />
          </div>
        </div>
      ),
    },
    {
      key: "project",
      header: t("admin.docs.columns.project"),
      exportValue: (d) => d.project?.name,
      cell: (d) =>
        d.project ? (
          <a href={`/projects/${d.project.slug}`} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()} className="line-clamp-1 max-w-44 text-ink-100 transition hover:text-gold-300">
            {tr(d.project.name)}
          </a>
        ) : (
          "—"
        ),
    },
    {
      key: "number",
      header: t("admin.docs.columns.number"),
      hideOnMobile: true,
      exportValue: (d) => [d.number, d.issuer].filter(Boolean).join(" · "),
      cell: (d) => (
        <div className="max-w-48">
          <div className="font-mono text-xs text-ink-200">{d.number ?? "—"}</div>
          {d.issuer && <div className="line-clamp-1 text-[11px] text-ink-400">{tr(d.issuer)}</div>}
          {d.expiresAt && <div className="text-[11px] text-ink-500">{t("admin.docs.expires", { date: f.date(d.expiresAt) })}</div>}
        </div>
      ),
    },
    {
      key: "access",
      header: t("admin.docs.columns.access"),
      hideOnMobile: true,
      exportValue: (d) => label("access", d.access),
      cell: (d) => (
        <Badge tone={d.access === "PUBLIC" ? "info" : d.access === "BUYERS" ? "gold" : "neutral"}>
          {d.access === "PRIVATE" && <Lock1 />}
          {label("access", d.access)}
        </Badge>
      ),
    },
    {
      key: "file",
      header: t("admin.docs.columns.file"),
      exportValue: (d) => d.file?.originalName,
      cell: (d) =>
        d.file ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPreviewId(d.id);
            }}
            className="group flex max-w-44 cursor-pointer items-center gap-2 text-left"
          >
            <Eye size={16} className="shrink-0 text-ink-400 transition group-hover:text-gold-300" />
            <span className="min-w-0">
              <span className="block truncate text-xs text-ink-200 group-hover:text-stone-100">{d.file.originalName}</span>
              <span className="font-mono text-[10px] text-ink-500">{formatBytes(d.file.size)}</span>
            </span>
          </button>
        ) : (
          <span className="text-xs text-ink-500">{t("admin.docs.noFile")}</span>
        ),
    },
    {
      key: "status",
      header: t("admin.docs.columns.status"),
      sortable: true,
      exportValue: (d) => label("verification", d.status),
      cell: (d) => (
        <div>
          <StatusBadge kind="verification" value={d.status} />
          {d.status === "REJECTED" && d.rejectReason && (
            <div className="mt-1 line-clamp-1 max-w-40 text-[11px] text-ink-400" title={d.rejectReason}>
              {d.rejectReason}
            </div>
          )}
        </div>
      ),
    },
    { key: "createdAt", header: t("admin.docs.columns.created"), sortable: true, hideOnMobile: true, exportValue: (d) => d.createdAt, cell: (d) => <span className="whitespace-nowrap text-xs text-ink-400">{f.date(d.createdAt)}</span> },
    {
      key: "actions",
      header: "",
      align: "right",
      alwaysVisible: true,
      width: "56px",
      cell: (d) => (
        <RowActions
          actions={[
            { label: t("admin.docs.preview"), icon: Eye, onSelect: () => setPreviewId(d.id), disabled: !d.file },
            { label: t("admin.docs.download"), icon: DocumentDownload, onSelect: () => d.file && window.open(`${d.file.url}?download=1`, "_blank"), disabled: !d.file },
            { label: t("admin.docs.verify"), icon: TickCircle, tone: "success", onSelect: () => verify(d), hidden: d.status === "VERIFIED", separatorBefore: true },
            { label: t("admin.docs.reject"), icon: CloseCircle, tone: "danger", onSelect: () => reject(d), hidden: d.status === "REJECTED" },
            ...control.rowActions({
              archive: {
                entity: "documents",
                row: d,
                name: tr(d.title),
                onDone: (patch) => {
                  data.mutate((items) => items.map((x) => (x.id === d.id ? { ...x, ...patch } : x)));
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
      <PageHeader eyebrow={t("admin.nav.moderation")} title={t("admin.docs.title")} description={t("admin.docs.description")} />
      <ErrorNotice error={data.error} onRetry={data.reload} />
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <ArchiveTabs value={view} onChange={(v) => list.update(archiveViewPatch(v))} />
      </div>
      <Dim active={data.refreshing}>
        <DataTable
          columns={columns}
          data={data.items}
          rowKey={(d) => d.id}
          loading={data.initialLoading}
          server={list.server(data.total)}
          initialSort={list.sort}
          onRowClick={(d) => d.file && setPreviewId(d.id)}
          selectable
          exportName="documents"
          emptyTitle={t("admin.docs.empty")}
          toolbar={
            <>
              <SearchBox value={list.q} onChange={(q) => list.update({ q })} />
              <FilterSelect
                value={list.filters.status}
                onChange={(v) => list.update({ status: v })}
                placeholder={t("admin.docs.columns.status")}
                options={VERIFICATION_STATUSES.map((v) => ({ value: v, label: label("verification", v) }))}
              />
              <FilterSelect
                value={list.filters.type}
                onChange={(v) => list.update({ type: v })}
                placeholder={t("admin.common.type")}
                options={DOCUMENT_TYPES.map((v) => ({ value: v, label: label("documentType", v) }))}
              />
              <ResetFilters count={list.activeFilters - (list.filters.archived ? 1 : 0)} onReset={() => list.update({ q: null, status: null, type: null })} />
              <ExcelButton area="admin" entity="documents" filters={{ q: list.q, status: list.filters.status, archived: list.filters.archived }} className="sm:ml-auto" />
            </>
          }
          bulkActions={(rows, clear) => {
            const pending = rows.filter((r) => r.status !== "VERIFIED");
            return (
              <Button
                size="sm"
                variant="success"
                disabled={!pending.length}
                onClick={() =>
                  confirm({
                    title: t("admin.docs.bulkVerifyTitle", { count: pending.length }),
                    tone: "success",
                    icon: TickCircle,
                    confirmLabel: t("admin.docs.verify"),
                    onConfirm: async () => {
                      const { ok, fail } = await settle(pending, (d) => apply(d, "VERIFIED"));
                      toast[fail ? "warning" : "success"](fail ? t("admin.common.bulkPartial", { ok, fail }) : t("admin.common.bulkDone", { ok }));
                      clear();
                    },
                  })
                }
              >
                <TickCircle /> {t("admin.common.approveSelected")}
              </Button>
            );
          }}
        />
      </Dim>

      <FilePreview
        open={Boolean(preview)}
        onOpenChange={(o) => !o && setPreviewId(null)}
        file={preview?.file ?? null}
        title={preview ? tr(preview.title) : undefined}
        actions={
          preview && (
            <>
              {preview.status !== "REJECTED" && (
                <Button variant="ghost" className="text-danger hover:text-danger" onClick={() => reject(preview)}>
                  <CloseCircle /> {t("admin.docs.reject")}
                </Button>
              )}
              {preview.status !== "VERIFIED" && (
                <Button variant="gold" onClick={() => verify(preview)}>
                  <TickCircle /> {t("admin.docs.verify")}
                </Button>
              )}
            </>
          )
        }
      />
      {confirmNode}
    </div>
  );
}
