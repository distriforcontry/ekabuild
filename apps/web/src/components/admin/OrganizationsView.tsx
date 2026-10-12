"use client";
import * as React from "react";
import { ORG_TYPES, VERIFICATION_STATUSES } from "@eka/shared";
import { CloseCircle, Eye, TickCircle } from "iconsax-reactjs";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { InfoRow, PageHeader } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/status-badge";
import { useI18n } from "@/i18n/client";
import { api } from "@/lib/api";
import { ExcelButton } from "@/components/control/ExportButton";
import { useAdmin } from "./context";
import { ArchiveTabs, archiveViewOf, archiveViewPatch, ControlBadges, useControlActions } from "./control";
import { useFormat } from "./format";
import { settle, useApiList, useLatest, useListState } from "./hooks";
import { Avatar, CopyChip, DetailSection, Dim, ErrorNotice, FilterSelect, ResetFilters, RowActions, SearchBox, Sheet, useConfirm } from "./primitives";
import type { OrgRow } from "./types";

const FILTERS = ["status", "type", "archived", "blocked"] as const;

export function OrganizationsView() {
  const { t, label, tr } = useI18n();
  const f = useFormat();
  const { refreshCounts } = useAdmin();
  const list = useListState(FILTERS);
  const data = useApiList<OrgRow>("/admin/organizations", list.apiQuery);
  const [confirm, confirmNode] = useConfirm();
  const [openId, setOpenId] = React.useState<string | null>(null);
  const current = data.items.find((o) => o.id === openId) ?? null;
  const open = useLatest(current);
  const control = useControlActions(confirm);
  const view = archiveViewOf(list.filters);
  const patchRow = (id: string, p: Partial<OrgRow>) => {
    data.mutate((items) => items.map((o) => (o.id === id ? { ...o, ...p } : o)));
    if ("archivedAt" in p || ("blockedAt" in p && view === "blocked")) data.reload();
  };

  const setStatus = async (org: OrgRow, status: "VERIFIED" | "REJECTED", rejectReason?: string) => {
    await api.patch(`/admin/organizations/${org.id}`, { status, rejectReason: rejectReason || undefined });
    data.mutate((items) =>
      items.map((o) => (o.id === org.id ? { ...o, status, rejectReason: rejectReason ?? null, verifiedAt: status === "VERIFIED" ? new Date().toISOString() : o.verifiedAt } : o)),
    );
    refreshCounts();
  };

  const approve = (org: OrgRow) =>
    confirm({
      title: t("admin.orgs.approveTitle"),
      description: t("admin.orgs.approveDesc", { name: org.name }),
      confirmLabel: t("common.actions.approve"),
      tone: "success",
      icon: TickCircle,
      onConfirm: async () => {
        await setStatus(org, "VERIFIED");
        toast.success(t("admin.orgs.approved"));
      },
    });

  const reject = (org: OrgRow) =>
    confirm({
      title: t("admin.orgs.rejectTitle"),
      description: t("admin.orgs.rejectDesc", { name: org.name }),
      confirmLabel: t("common.actions.reject"),
      tone: "danger",
      icon: CloseCircle,
      reason: { label: t("admin.common.reason"), placeholder: t("admin.common.reasonPlaceholder"), required: true },
      onConfirm: async (reason) => {
        await setStatus(org, "REJECTED", reason);
        toast.success(t("admin.orgs.rejected"));
      },
    });

  const columns: Column<OrgRow>[] = [
    {
      key: "name",
      header: t("admin.orgs.columns.name"),
      sortable: true,
      alwaysVisible: true,
      exportValue: (o) => o.name,
      cell: (o) => (
        <div className="flex min-w-52 items-center gap-3">
          <Avatar name={o.name} src={o.logoUrl} size={36} />
          <div className="min-w-0">
            <div className="truncate font-semibold text-stone-100">{tr(o.name)}</div>
            <div className="truncate text-xs text-ink-400">{o.legalName ? tr(o.legalName) : (o.director ?? "—")}</div>
            <ControlBadges row={o} className="mt-1 flex flex-wrap items-center gap-1 empty:hidden" />
          </div>
        </div>
      ),
    },
    { key: "tin", header: t("admin.orgs.columns.tin"), exportValue: (o) => o.tin, cell: (o) => <span className="font-mono text-xs text-ink-200">{o.tin}</span> },
    { key: "type", header: t("admin.orgs.columns.type"), exportValue: (o) => label("orgType", o.type), cell: (o) => <span className="text-ink-200">{label("orgType", o.type)}</span> },
    { key: "region", header: t("admin.orgs.columns.region"), hideOnMobile: true, exportValue: (o) => o.region, cell: (o) => <span className="text-ink-300">{o.region ? tr(o.region) : "—"}</span> },
    {
      key: "projectsCount",
      header: t("admin.orgs.columns.projects"),
      align: "right",
      hideOnMobile: true,
      sortable: true,
      exportValue: (o) => o.projectsCount ?? 0,
      cell: (o) => <span className="font-mono text-ink-200">{o.projectsCount ?? 0}</span>,
    },
    {
      key: "membersCount",
      header: t("admin.orgs.columns.members"),
      align: "right",
      hideOnMobile: true,
      exportValue: (o) => o.membersCount ?? 0,
      cell: (o) => <span className="font-mono text-ink-200">{o.membersCount ?? 0}</span>,
    },
    {
      key: "status",
      header: t("admin.orgs.columns.status"),
      sortable: true,
      exportValue: (o) => label("verification", o.status),
      cell: (o) => <StatusBadge kind="verification" value={o.status} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      alwaysVisible: true,
      width: "56px",
      cell: (o) => (
        <RowActions
          actions={[
            { label: t("admin.common.details"), icon: Eye, onSelect: () => setOpenId(o.id) },
            { label: t("common.actions.approve"), icon: TickCircle, tone: "success", onSelect: () => approve(o), hidden: o.status === "VERIFIED", separatorBefore: true },
            { label: t("common.actions.reject"), icon: CloseCircle, tone: "danger", onSelect: () => reject(o), hidden: o.status === "REJECTED" },
            ...control.rowActions({
              block: { kind: "org", row: o, name: tr(o.name), onDone: (p) => patchRow(o.id, p) },
              archive: { entity: "organizations", row: o, name: tr(o.name), onDone: (p) => patchRow(o.id, p) },
            }),
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader eyebrow={t("admin.nav.moderation")} title={t("admin.orgs.title")} description={t("admin.orgs.description")} />
      <ErrorNotice error={data.error} onRetry={data.reload} />
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <ArchiveTabs value={view} onChange={(v) => list.update(archiveViewPatch(v))} withBlocked />
      </div>
      <Dim active={data.refreshing}>
        <DataTable
          columns={columns}
          data={data.items}
          rowKey={(o) => o.id}
          loading={data.initialLoading}
          server={list.server(data.total)}
          initialSort={list.sort}
          pageSize={list.pageSize}
          onRowClick={(o) => setOpenId(o.id)}
          selectable
          exportName="organizations"
          emptyTitle={t("admin.orgs.empty")}
          toolbar={
            <>
              <SearchBox value={list.q} onChange={(q) => list.update({ q })} />
              <FilterSelect
                value={list.filters.status}
                onChange={(v) => list.update({ status: v })}
                placeholder={t("admin.orgs.columns.status")}
                options={VERIFICATION_STATUSES.map((v) => ({ value: v, label: label("verification", v) }))}
              />
              <FilterSelect
                value={list.filters.type}
                onChange={(v) => list.update({ type: v })}
                placeholder={t("admin.orgs.columns.type")}
                options={ORG_TYPES.map((v) => ({ value: v, label: label("orgType", v) }))}
              />
              <ResetFilters count={list.activeFilters - (list.filters.archived ? 1 : 0) - (list.filters.blocked ? 1 : 0)} onReset={() => list.update({ q: null, status: null, type: null })} />
              <ExcelButton area="admin" entity="organizations" filters={{ q: list.q, status: list.filters.status, archived: list.filters.archived }} className="sm:ml-auto" />
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
                    title: t("admin.orgs.bulkApproveTitle", { count: pending.length }),
                    description: t("admin.orgs.bulkApproveDesc"),
                    tone: "success",
                    icon: TickCircle,
                    confirmLabel: t("common.actions.approve"),
                    onConfirm: async () => {
                      const { ok, fail } = await settle(pending, (o) => setStatus(o, "VERIFIED"));
                      if (fail) toast.warning(t("admin.common.bulkPartial", { ok, fail }));
                      else toast.success(t("admin.common.bulkDone", { ok }));
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

      <Sheet
        open={Boolean(current)}
        onOpenChange={(o) => !o && setOpenId(null)}
        title={open ? tr(open.name) : ""}
        description={open ? label("orgType", open.type) : undefined}
        footer={
          open && (
            <>
              {open.status !== "REJECTED" && (
                <Button variant="ghost" className="text-danger hover:text-danger" onClick={() => reject(open)}>
                  <CloseCircle /> {t("common.actions.reject")}
                </Button>
              )}
              {open.status !== "VERIFIED" && (
                <Button variant="gold" onClick={() => approve(open)}>
                  <TickCircle /> {t("common.actions.approve")}
                </Button>
              )}
            </>
          )
        }
      >
        {open && (
          <>
            <div className="mb-6 flex items-center gap-4 rounded-2xl border border-line bg-ink-850 p-4">
              <Avatar name={open.name} src={open.logoUrl} size={56} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-semibold text-stone-100">{tr(open.legalName ?? open.name)}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <StatusBadge kind="verification" value={open.status} />
                  <ControlBadges row={open} />
                  <CopyChip value={open.tin} display={`${t("admin.orgs.columns.tin")} ${open.tin}`} />
                </div>
              </div>
            </div>
            {open.blockedAt && (
              <div className="mb-6 rounded-xl border border-danger/25 bg-danger/[0.06] p-3.5 text-sm">
                <div className="mb-1 flex items-center justify-between gap-2 text-xs font-semibold text-danger">
                  {t("admin.control.block.badge")}
                  <span className="font-normal text-ink-400">{t("admin.control.block.since", { date: f.date(open.blockedAt) })}</span>
                </div>
                <div className="text-ink-200">{open.blockReason ?? t("admin.control.block.noReason")}</div>
              </div>
            )}
            {open.status === "REJECTED" && open.rejectReason && (
              <div className="mb-6 rounded-xl border border-danger/25 bg-danger/[0.06] p-3.5 text-sm">
                <div className="mb-1 text-xs font-semibold text-danger">{t("admin.orgs.fields.rejectReason")}</div>
                <div className="text-ink-200">{open.rejectReason}</div>
              </div>
            )}
            <DetailSection title={t("admin.orgs.fields.requisites")}>
              <InfoRow label={t("admin.orgs.fields.legalName")} value={open.legalName ? tr(open.legalName) : "—"} />
              <InfoRow label={t("admin.orgs.columns.tin")} value={open.tin} mono />
              <InfoRow label={t("admin.orgs.fields.director")} value={open.director ?? "—"} />
              <InfoRow label={t("admin.orgs.fields.license")} value={open.licenseNumber ?? "—"} mono />
              <InfoRow label={t("admin.orgs.fields.founded")} value={open.foundedYear ?? "—"} mono />
              <InfoRow label={t("admin.orgs.fields.verifiedAt")} value={f.date(open.verifiedAt)} />
            </DetailSection>
            <DetailSection title={t("admin.orgs.fields.contacts")}>
              <InfoRow label={t("admin.orgs.fields.phone")} value={open.phone ? <a href={`tel:${open.phone}`} className="font-mono hover:text-gold-300">{open.phone}</a> : "—"} />
              <InfoRow label={t("admin.orgs.fields.email")} value={open.email ? <a href={`mailto:${open.email}`} className="hover:text-gold-300">{open.email}</a> : "—"} />
              <InfoRow
                label={t("admin.orgs.fields.website")}
                value={
                  open.website ? (
                    <a href={open.website.startsWith("http") ? open.website : `https://${open.website}`} target="_blank" rel="noopener noreferrer" className="text-gold-300 hover:underline">
                      {open.website.replace(/^https?:\/\//, "")}
                    </a>
                  ) : (
                    "—"
                  )
                }
              />
              <InfoRow label={t("admin.orgs.fields.region")} value={open.region ? tr(open.region) : "—"} />
              <InfoRow label={t("admin.orgs.fields.address")} value={open.address ? tr(open.address) : "—"} />
            </DetailSection>
            <DetailSection title={t("admin.orgs.fields.stats")}>
              <div className="grid grid-cols-2 gap-3">
                <MiniStat label={t("admin.orgs.columns.projects")} value={open.projectsCount ?? 0} />
                <MiniStat label={t("admin.orgs.columns.members")} value={open.membersCount ?? 0} />
              </div>
            </DetailSection>
            {open.description && (
              <DetailSection title={t("admin.orgs.fields.description")}>
                <p className="whitespace-pre-line text-sm leading-relaxed text-ink-200">{tr(open.description)}</p>
              </DetailSection>
            )}
          </>
        )}
      </Sheet>
      {confirmNode}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-ink-850 p-3.5">
      <div className="text-[11px] uppercase tracking-wider text-ink-400">{label}</div>
      <div className="mt-1 font-mono text-xl font-semibold text-stone-100">{value}</div>
    </div>
  );
}

