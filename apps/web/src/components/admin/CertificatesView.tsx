"use client";
import * as React from "react";
import { CERTIFICATE_STATUSES } from "@eka/shared";
import { CloseCircle, Copy, ExportSquare, ShieldCross, TickCircle, Warning2 } from "iconsax-reactjs";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/status-badge";
import { useI18n } from "@/i18n/client";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAdmin } from "./context";
import { copyText, daysUntil, siteOrigin, useFormat } from "./format";
import { settle, useApiList, useListState } from "./hooks";
import { Dim, ErrorNotice, FilterSelect, ResetFilters, RowActions, SearchBox, useConfirm } from "./primitives";
import type { CertRow } from "./types";

const FILTERS = ["status"] as const;
type Decision = "VERIFIED" | "REJECTED" | "REVOKED";

export function CertificatesView() {
  const { t, label, tr } = useI18n();
  const f = useFormat();
  const { refreshCounts } = useAdmin();
  const list = useListState(FILTERS);
  const data = useApiList<CertRow>("/admin/certificates", list.apiQuery);
  const [confirm, confirmNode] = useConfirm();

  const apply = async (c: CertRow, status: Decision, note?: string) => {
    await api.patch(`/certificates/${c.id}/verify`, { status, note: note || undefined });
    data.mutate((items) =>
      items.map((x) => (x.id === c.id ? { ...x, status, note: note || x.note, verifiedAt: status === "VERIFIED" ? new Date().toISOString() : x.verifiedAt } : x)),
    );
    refreshCounts();
  };

  const decide = (c: CertRow, status: Decision) =>
    confirm({
      title: t(`admin.certs.dialog.${status}.title`),
      description: t(`admin.certs.dialog.${status}.desc`, { number: c.number }),
      tone: status === "VERIFIED" ? "success" : "danger",
      icon: status === "VERIFIED" ? TickCircle : status === "REVOKED" ? ShieldCross : CloseCircle,
      confirmLabel: status === "VERIFIED" ? t("admin.certs.verify") : status === "REVOKED" ? t("admin.certs.revoke") : t("admin.certs.reject"),
      reason: { label: t("admin.common.note"), placeholder: status === "VERIFIED" ? t("admin.common.notePlaceholder") : t("admin.common.reasonPlaceholder"), required: status !== "VERIFIED" },
      onConfirm: async (note) => {
        await apply(c, status, note);
        toast.success(t(`admin.certs.done.${status}`));
      },
    });

  const copyLink = async (c: CertRow) => {
    const ok = await copyText(`${siteOrigin()}/verify/${c.code}`);
    if (ok) toast.success(t("admin.common.linkCopied"));
  };

  const columns: Column<CertRow>[] = [
    {
      key: "number",
      header: t("admin.certs.columns.code"),
      alwaysVisible: true,
      sortable: true,
      exportValue: (c) => `${c.code} ${c.number}`,
      cell: (c) => (
        <div className="min-w-40">
          <div className="font-mono text-sm font-semibold text-stone-100">{c.number}</div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              copyLink(c);
            }}
            className="mt-0.5 inline-flex cursor-pointer items-center gap-1 font-mono text-[11px] text-gold-300/80 transition hover:text-gold-200"
            title={t("admin.certs.copyLink")}
          >
            /verify/{c.code} <Copy size={11} />
          </button>
        </div>
      ),
    },
    {
      key: "type",
      header: t("admin.certs.columns.type"),
      exportValue: (c) => label("certificateType", c.type),
      cell: (c) => <span className="text-ink-200">{label("certificateType", c.type)}</span>,
    },
    {
      key: "project",
      header: t("admin.certs.columns.project"),
      exportValue: (c) => c.project?.name,
      cell: (c) =>
        c.project ? (
          <a
            href={`/projects/${c.project.slug}`}
            target="_blank"
            rel="noopener"
            onClick={(e) => e.stopPropagation()}
            className="line-clamp-1 max-w-48 text-ink-100 transition hover:text-gold-300"
          >
            {tr(c.project.name)}
          </a>
        ) : (
          "—"
        ),
    },
    { key: "issuer", header: t("admin.certs.columns.issuer"), hideOnMobile: true, exportValue: (c) => c.issuer, cell: (c) => <span className="line-clamp-2 max-w-48 text-xs text-ink-300">{tr(c.issuer)}</span> },
    { key: "issuedAt", header: t("admin.certs.columns.issued"), sortable: true, hideOnMobile: true, exportValue: (c) => c.issuedAt, cell: (c) => <span className="whitespace-nowrap text-xs text-ink-300">{f.date(c.issuedAt)}</span> },
    {
      key: "validUntil",
      header: t("admin.certs.columns.validUntil"),
      sortable: true,
      exportValue: (c) => c.validUntil,
      cell: (c) => <Expiry validUntil={c.validUntil} status={c.status} />,
    },
    {
      key: "status",
      header: t("admin.certs.columns.status"),
      sortable: true,
      exportValue: (c) => label("certificateStatus", c.status),
      cell: (c) => (
        <div>
          <StatusBadge kind="certificateStatus" value={c.status} />
          {c.note && <div className="mt-1 line-clamp-1 max-w-40 text-[11px] text-ink-400" title={c.note}>{c.note}</div>}
        </div>
      ),
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
            { label: t("admin.certs.verify"), icon: TickCircle, tone: "success", onSelect: () => decide(c, "VERIFIED"), hidden: c.status === "VERIFIED" },
            { label: t("admin.certs.reject"), icon: CloseCircle, tone: "danger", onSelect: () => decide(c, "REJECTED"), hidden: c.status !== "PENDING" },
            { label: t("admin.certs.revoke"), icon: ShieldCross, tone: "danger", onSelect: () => decide(c, "REVOKED"), hidden: c.status === "REVOKED" || c.status === "PENDING" || c.status === "REJECTED" },
            { label: t("admin.certs.copyLink"), icon: Copy, onSelect: () => copyLink(c), separatorBefore: true },
            { label: t("admin.certs.openVerify"), icon: ExportSquare, onSelect: () => window.open(`/verify/${c.code}`, "_blank", "noopener") },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader eyebrow={t("admin.nav.moderation")} title={t("admin.certs.title")} description={t("admin.certs.description")} />
      <ErrorNotice error={data.error} onRetry={data.reload} />
      <Dim active={data.refreshing}>
        <DataTable
          columns={columns}
          data={data.items}
          rowKey={(c) => c.id}
          loading={data.initialLoading}
          server={list.server(data.total)}
          initialSort={list.sort}
          selectable
          exportName="certificates"
          emptyTitle={t("admin.certs.empty")}
          toolbar={
            <>
              <SearchBox value={list.q} onChange={(q) => list.update({ q })} />
              <FilterSelect
                value={list.filters.status}
                onChange={(v) => list.update({ status: v })}
                placeholder={t("admin.certs.columns.status")}
                options={CERTIFICATE_STATUSES.map((v) => ({ value: v, label: label("certificateStatus", v) }))}
              />
              <ResetFilters count={list.activeFilters} onReset={list.resetFilters} />
            </>
          }
          bulkActions={(rows, clear) => {
            const pending = rows.filter((r) => r.status === "PENDING");
            return (
              <Button
                size="sm"
                variant="success"
                disabled={!pending.length}
                onClick={() =>
                  confirm({
                    title: t("admin.certs.bulkVerifyTitle", { count: pending.length }),
                    tone: "success",
                    icon: TickCircle,
                    confirmLabel: t("admin.certs.verify"),
                    onConfirm: async () => {
                      const { ok, fail } = await settle(pending, (c) => apply(c, "VERIFIED"));
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
      {confirmNode}
    </div>
  );
}

function Expiry({ validUntil, status }: { validUntil: string | null; status: string }) {
  const { t } = useI18n();
  const f = useFormat();
  if (!validUntil) return <span className="text-xs text-ink-400">{t("admin.certs.noExpiry")}</span>;
  const days = daysUntil(validUntil);
  const expired = days != null && days < 0;
  const soon = days != null && days >= 0 && days <= 30;
  return (
    <div className="whitespace-nowrap">
      <div className={cn("text-xs", expired ? "text-danger" : soon ? "text-warning" : "text-ink-300")}>{f.date(validUntil)}</div>
      {(expired || soon) && status !== "REVOKED" && (
        <Badge tone={expired ? "danger" : "warning"} className="mt-1">
          <Warning2 variant="Bold" />
          {expired ? t("admin.certs.expired") : t("admin.certs.expiresIn", { days: days! })}
        </Badge>
      )}
    </div>
  );
}
