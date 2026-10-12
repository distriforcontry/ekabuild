"use client";
import * as React from "react";
import { PURCHASE_KINDS, PURCHASE_STATUSES, formatArea } from "@eka/shared";
import { DocumentText, ExportSquare, Receipt2 } from "iconsax-reactjs";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/status-badge";
import { useI18n } from "@/i18n/client";
import type { PurchaseItem } from "@/lib/types";
import { ContractDialog } from "./ContractDialog";
import { useFormat } from "./format";
import { useApiList, useListState } from "./hooks";
import { Avatar, Dim, ErrorNotice, FilterSelect, ResetFilters, RowActions, SearchBox } from "./primitives";

const FILTERS = ["status", "kind"] as const;

export function PurchasesView() {
  const { t, label, tr } = useI18n();
  const f = useFormat();
  const list = useListState(FILTERS, { sort: { key: "createdAt", dir: "desc" } });
  const data = useApiList<PurchaseItem>("/admin/purchases", list.apiQuery);
  const [contractId, setContractId] = React.useState<string | null>(null);

  const pageSum = data.items.filter((p) => p.status !== "CANCELLED").reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const columns: Column<PurchaseItem>[] = [
    {
      key: "number",
      header: t("admin.purchases.columns.number"),
      alwaysVisible: true,
      sortable: true,
      exportValue: (p) => p.number,
      cell: (p) => <span className="whitespace-nowrap font-mono text-sm font-semibold text-stone-100">{p.number}</span>,
    },
    {
      key: "project",
      header: t("admin.purchases.columns.project"),
      exportValue: (p) => p.project?.name,
      cell: (p) => (
        <div className="flex min-w-52 items-center gap-3">
          <div className="size-10 shrink-0 overflow-hidden rounded-lg border border-line bg-ink-800">
            {p.project?.coverUrl ? <img src={p.project.coverUrl} alt="" className="size-full object-cover" loading="lazy" /> : <div className="bg-blueprint size-full" />}
          </div>
          <div className="min-w-0">
            <a href={`/projects/${p.project?.slug}`} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()} className="block truncate text-sm font-medium text-stone-100 hover:text-gold-300">
              {tr(p.project?.name)}
            </a>
            <div className="truncate text-xs text-ink-400">
              {p.unit
                ? t("admin.purchases.unitLine", { number: p.unit.number, floor: p.unit.floor, area: formatArea(p.unit.area) })
                : t("admin.purchases.package")}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "buyer",
      header: t("admin.purchases.columns.buyer"),
      exportValue: (p) => [p.buyer?.fullName, p.buyerOrg?.name].filter(Boolean).join(" / "),
      cell: (p) => (
        <div className="flex min-w-44 items-center gap-2.5">
          <Avatar name={p.buyer?.fullName} size={30} />
          <div className="min-w-0">
            <div className="truncate text-sm text-ink-100">{p.buyer?.fullName ?? "—"}</div>
            <div className="truncate text-[11px] text-ink-400">{p.buyerOrg ? `${tr(p.buyerOrg.name)} · ${p.buyerOrg.tin}` : <span className="font-mono">{p.buyer?.phone}</span>}</div>
          </div>
        </div>
      ),
    },
    { key: "kind", header: t("admin.purchases.columns.kind"), hideOnMobile: true, exportValue: (p) => label("purchaseKind", p.kind), cell: (p) => <span className="text-xs text-ink-300">{label("purchaseKind", p.kind)}</span> },
    {
      key: "amount",
      header: t("admin.purchases.columns.amount"),
      align: "right",
      sortable: true,
      exportValue: (p) => p.amount,
      cell: (p) => <span className="whitespace-nowrap font-mono text-sm font-semibold text-stone-100">{f.money(p.amount, p.currency)}</span>,
    },
    {
      key: "status",
      header: t("admin.purchases.columns.status"),
      sortable: true,
      exportValue: (p) => label("purchaseStatus", p.status),
      cell: (p) => (
        <div>
          <StatusBadge kind="purchaseStatus" value={p.status} />
          {p.paidAt && <div className="mt-1 text-[10px] text-ink-500">{f.date(p.paidAt)}</div>}
        </div>
      ),
    },
    {
      key: "contract",
      header: t("admin.purchases.columns.contract"),
      exportValue: (p) => p.contract?.number,
      cell: (p) =>
        p.contract ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setContractId(p.contract!.id);
            }}
            className="group flex cursor-pointer items-center gap-2 text-left"
          >
            <DocumentText size={16} className="text-ink-400 transition group-hover:text-gold-300" />
            <span>
              <span className="block font-mono text-xs text-ink-100 group-hover:text-gold-200">{p.contract.number}</span>
              <span className="text-[10px] text-ink-400">{label("contractStatus", p.contract.status)}</span>
            </span>
          </button>
        ) : (
          <span className="text-xs text-ink-500">{t("admin.purchases.contract.none")}</span>
        ),
    },
    {
      key: "createdAt",
      header: t("admin.purchases.columns.created"),
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
            { label: t("admin.purchases.contract.open"), icon: DocumentText, onSelect: () => p.contract && setContractId(p.contract.id), disabled: !p.contract },
            { label: t("admin.common.openPublic"), icon: ExportSquare, onSelect: () => window.open(`/projects/${p.project?.slug}`, "_blank", "noopener") },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={t("admin.nav.sales")}
        title={t("admin.purchases.title")}
        description={t("admin.purchases.description")}
        actions={
          data.items.length > 0 && (
            <div className="flex items-center gap-3 rounded-2xl border border-line bg-ink-900 px-4 py-2.5">
              <span className="grid size-9 place-items-center rounded-xl border border-gold-500/25 bg-gold-500/10 text-gold-300">
                <Receipt2 size={18} variant="Bulk" />
              </span>
              <div className="leading-tight">
                <div className="text-[11px] uppercase tracking-wider text-ink-400">{t("admin.purchases.pageTotal")}</div>
                <div className="font-mono text-base font-semibold text-stone-100">{f.money(pageSum)}</div>
              </div>
            </div>
          )
        }
      />
      <ErrorNotice error={data.error} onRetry={data.reload} />
      <Dim active={data.refreshing}>
        <DataTable
          columns={columns}
          data={data.items}
          rowKey={(p) => p.id}
          loading={data.initialLoading}
          server={list.server(data.total)}
          initialSort={list.sort}
          onRowClick={(p) => p.contract && setContractId(p.contract.id)}
          exportName="purchases"
          emptyTitle={t("admin.purchases.empty")}
          toolbar={
            <>
              <SearchBox value={list.q} onChange={(q) => list.update({ q })} />
              <FilterSelect
                value={list.filters.status}
                onChange={(v) => list.update({ status: v })}
                placeholder={t("admin.purchases.columns.status")}
                options={PURCHASE_STATUSES.map((v) => ({ value: v, label: label("purchaseStatus", v) }))}
              />
              <FilterSelect
                value={list.filters.kind}
                onChange={(v) => list.update({ kind: v })}
                placeholder={t("admin.purchases.filters.kind")}
                options={PURCHASE_KINDS.map((v) => ({ value: v, label: label("purchaseKind", v) }))}
              />
              <ResetFilters count={list.activeFilters} onReset={list.resetFilters} />
            </>
          }
        />
      </Dim>
      <ContractDialog contractId={contractId} onClose={() => setContractId(null)} />
    </div>
  );
}
