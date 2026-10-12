"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { DocumentText } from "iconsax-reactjs";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/status-badge";
import { useI18n } from "@/i18n/client";
import type { PurchaseItem } from "@/lib/types";
import { asList, useApi } from "../hooks";
import { useFmt } from "../format";
import { ErrorState } from "../states";

type Row = PurchaseItem & { contract: NonNullable<PurchaseItem["contract"]> };

export function ContractsView() {
  const { t, label, tr } = useI18n();
  const fmt = useFmt();
  const router = useRouter();
  const { data, loading, error, reload } = useApi<PurchaseItem[]>("/purchases", undefined, { select: asList });
  const rows = React.useMemo(() => (data ?? []).filter((p): p is Row => Boolean(p.contract)), [data]);

  const columns: Column<Row>[] = [
    {
      key: "number",
      header: t("app.contracts.columns.number"),
      cell: (r) => (
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-gold-500/25 bg-gold-500/10 text-gold-300">
            <DocumentText size={16} variant="Bulk" />
          </span>
          <span className="font-mono text-xs text-gold-200">{r.contract.number}</span>
        </div>
      ),
      sortValue: (r) => r.contract.number,
      exportValue: (r) => r.contract.number,
      alwaysVisible: true,
    },
    {
      key: "project",
      header: t("app.contracts.columns.project"),
      cell: (r) => <span className="font-medium text-stone-100">{tr(r.project.name)}</span>,
      sortValue: (r) => r.project.name,
      exportValue: (r) => r.project.name,
    },
    {
      key: "subject",
      header: t("app.contracts.columns.subject"),
      cell: (r) => (
        <span className="text-sm text-ink-200">
          {r.unit ? t("app.common.unitShort", { section: r.unit.section, floor: r.unit.floor, number: r.unit.number }) : label("purchaseKind", r.kind)}
        </span>
      ),
      exportValue: (r) => (r.unit ? r.unit.number : label("purchaseKind", r.kind)),
      hideOnMobile: true,
    },
    {
      key: "amount",
      header: t("app.contracts.columns.amount"),
      align: "right",
      cell: (r) => <span className="whitespace-nowrap font-mono text-sm">{fmt.money(r.amount, r.currency)}</span>,
      sortValue: (r) => Number(r.amount),
      exportValue: (r) => r.amount,
    },
    {
      key: "status",
      header: t("app.contracts.columns.status"),
      cell: (r) => <StatusBadge kind="contractStatus" value={r.contract.status} />,
      sortValue: (r) => r.contract.status,
      exportValue: (r) => label("contractStatus", r.contract.status),
    },
    {
      key: "signedAt",
      header: t("app.contracts.columns.signedAt"),
      cell: (r) => <span className="text-xs text-ink-300">{fmt.date(r.contract.signedAt)}</span>,
      sortValue: (r) => (r.contract.signedAt ? new Date(r.contract.signedAt) : null),
      exportValue: (r) => r.contract.signedAt?.slice(0, 10) ?? "",
      hideOnMobile: true,
    },
    {
      key: "date",
      header: t("app.contracts.columns.date"),
      cell: (r) => <span className="text-xs text-ink-300">{fmt.date(r.createdAt)}</span>,
      sortValue: (r) => new Date(r.createdAt),
      exportValue: (r) => r.createdAt.slice(0, 10),
      hideOnMobile: true,
    },
  ];

  return (
    <div>
      <PageHeader eyebrow={t("app.shell.area")} title={t("app.contracts.title")} description={t("app.contracts.subtitle")} />
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !loading && rows.length === 0 ? (
        <EmptyState icon={DocumentText} title={t("app.contracts.empty")} description={t("app.contracts.emptyHint")} />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          loading={loading}
          rowKey={(r) => r.contract.id}
          onRowClick={(r) => router.push(`/app/contracts/${r.contract.id}`)}
          searchText={(r) => `${r.contract.number} ${r.project.name}`}
          searchPlaceholder={t("app.contracts.search")}
          exportName="contracts"
          initialSort={{ key: "date", dir: "desc" }}
        />
      )}
    </div>
  );
}
