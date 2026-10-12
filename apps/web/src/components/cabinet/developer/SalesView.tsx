"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FingerScan, ReceiptText } from "iconsax-reactjs";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/status-badge";
import { useI18n } from "@/i18n/client";
import type { PurchaseItem } from "@/lib/types";
import { formatPhone } from "@/components/auth/auth-utils";
import { asList, useApi } from "../hooks";
import { useFmt } from "../format";
import { ErrorState } from "../states";

export function SalesView() {
  const { t, label, tr } = useI18n();
  const fmt = useFmt();
  const router = useRouter();
  const { data, loading, error, reload } = useApi<PurchaseItem[]>("/dev/purchases", undefined, { select: asList });

  const columns: Column<PurchaseItem>[] = [
    {
      key: "number",
      header: t("app.developer.sales.columns.number"),
      alwaysVisible: true,
      cell: (p) => <span className="font-mono text-xs text-gold-200">{p.number}</span>,
      sortValue: (p) => p.number,
      exportValue: (p) => p.number,
    },
    {
      key: "project",
      header: t("app.developer.sales.columns.project"),
      cell: (p) => (
        <div>
          <div className="font-medium text-stone-100">{tr(p.project.name)}</div>
          <div className="text-xs text-ink-400">{p.unit ? t("app.common.unitShort", { section: p.unit.section, floor: p.unit.floor, number: p.unit.number }) : label("purchaseKind", p.kind)}</div>
        </div>
      ),
      sortValue: (p) => p.project.name,
      exportValue: (p) => `${p.project.name} ${p.unit?.number ?? ""}`,
    },
    {
      key: "buyer",
      header: t("app.developer.sales.columns.buyer"),
      cell: (p) => (
        <div className="min-w-0">
          <div className="truncate text-sm text-stone-100">{p.buyerOrg ? tr(p.buyerOrg.name) : p.buyer.fullName}</div>
          <div className="truncate font-mono text-[11px] text-ink-400">{p.buyerOrg ? `${p.buyerOrg.tin} · ${p.buyer.fullName}` : formatPhone(p.buyer.phone)}</div>
        </div>
      ),
      sortValue: (p) => p.buyerOrg?.name ?? p.buyer.fullName,
      exportValue: (p) => p.buyerOrg?.name ?? p.buyer.fullName,
      hideOnMobile: true,
    },
    {
      key: "amount",
      header: t("app.developer.sales.columns.amount"),
      align: "right",
      cell: (p) => <span className="whitespace-nowrap font-mono text-sm">{fmt.money(p.amount, p.currency)}</span>,
      sortValue: (p) => Number(p.amount),
      exportValue: (p) => p.amount,
    },
    {
      key: "status",
      header: t("app.developer.sales.columns.status"),
      cell: (p) => <StatusBadge kind="purchaseStatus" value={p.status} />,
      sortValue: (p) => p.status,
      exportValue: (p) => label("purchaseStatus", p.status),
    },
    {
      key: "contract",
      header: t("app.developer.sales.columns.contract"),
      cell: (p) =>
        p.contract ? (
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <StatusBadge kind="contractStatus" value={p.contract.status} />
            <Button asChild size="sm" variant={p.contract.status === "PENDING" || p.contract.status === "PARTIALLY_SIGNED" ? "gold" : "ghost"}>
              <Link href={`/app/contracts/${p.contract.id}`}>
                {p.contract.status === "PENDING" || p.contract.status === "PARTIALLY_SIGNED" ? (
                  <>
                    <FingerScan size={14} variant="Bold" /> {t("app.developer.sales.sign")}
                  </>
                ) : (
                  t("app.developer.sales.open")
                )}
              </Link>
            </Button>
          </div>
        ) : (
          <span className="text-ink-400">—</span>
        ),
      exportValue: (p) => (p.contract ? label("contractStatus", p.contract.status) : ""),
    },
    {
      key: "date",
      header: t("app.developer.sales.columns.date"),
      cell: (p) => <span className="text-xs text-ink-300">{fmt.date(p.createdAt)}</span>,
      sortValue: (p) => new Date(p.createdAt),
      exportValue: (p) => p.createdAt.slice(0, 10),
      hideOnMobile: true,
    },
  ];

  return (
    <div>
      <PageHeader eyebrow={t("app.shell.sections.developer")} title={t("app.developer.sales.title")} description={t("app.developer.sales.subtitle")} />
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !loading && !(data ?? []).length ? (
        <EmptyState icon={ReceiptText} title={t("app.developer.sales.empty")} description={t("app.developer.sales.emptyHint")} />
      ) : (
        <DataTable
          columns={columns}
          data={data ?? []}
          loading={loading}
          rowKey={(p) => p.id}
          onRowClick={(p) => p.contract && router.push(`/app/contracts/${p.contract.id}`)}
          searchText={(p) => `${p.number} ${p.project.name} ${p.buyer.fullName} ${p.buyerOrg?.name ?? ""}`}
          searchPlaceholder={t("app.developer.sales.search")}
          exportName="sales"
          initialSort={{ key: "date", dir: "desc" }}
        />
      )}
    </div>
  );
}
