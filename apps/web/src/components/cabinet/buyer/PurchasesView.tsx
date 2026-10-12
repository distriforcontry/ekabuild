"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bag2, Buildings } from "iconsax-reactjs";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { useI18n } from "@/i18n/client";
import type { PurchaseItem } from "@/lib/types";
import { asList, useApi } from "../hooks";
import { useFmt } from "../format";
import { ErrorState } from "../states";
import { ProjectCover } from "../ui";
import { PageHead, PanelEmpty as EmptyState } from "../kit";

export function PurchasesView() {
  const { t, label, tr } = useI18n();
  const fmt = useFmt();
  const router = useRouter();
  const { data, loading, error, reload } = useApi<PurchaseItem[]>("/purchases", undefined, { select: asList });

  const columns: Column<PurchaseItem>[] = [
    {
      key: "number",
      header: t("app.purchases.columns.number"),
      cell: (p) => <span className="font-mono text-xs text-gold-200">{p.number}</span>,
      sortValue: (p) => p.number,
      exportValue: (p) => p.number,
      alwaysVisible: true,
    },
    {
      key: "project",
      header: t("app.purchases.columns.project"),
      cell: (p) => (
        <div className="flex items-center gap-3">
          <span className="size-10 shrink-0 overflow-hidden rounded-lg border border-line">
            <ProjectCover src={p.project.coverUrl} alt={tr(p.project.name)} iconSize={16} />
          </span>
          <div className="min-w-0">
            <div className="truncate font-medium text-stone-100">{tr(p.project.name)}</div>
            <div className="max-w-56 truncate text-xs text-ink-400">{tr(p.project.address)}</div>
          </div>
        </div>
      ),
      sortValue: (p) => p.project.name,
      exportValue: (p) => p.project.name,
    },
    {
      key: "unit",
      header: t("app.purchases.columns.unit"),
      cell: (p) =>
        p.unit ? (
          <div className="text-sm">
            <div className="text-stone-100">№ {p.unit.number}</div>
            <div className="text-xs text-ink-400">
              {t("app.common.roomsCount", { n: p.unit.rooms })} · {fmt.area(p.unit.area)}
            </div>
          </div>
        ) : (
          <span className="text-ink-400">—</span>
        ),
      exportValue: (p) => p.unit?.number ?? "",
      hideOnMobile: true,
    },
    {
      key: "kind",
      header: t("app.purchases.columns.kind"),
      cell: (p) => <span className="text-sm text-ink-200">{label("purchaseKind", p.kind)}</span>,
      exportValue: (p) => label("purchaseKind", p.kind),
      hideOnMobile: true,
    },
    {
      key: "amount",
      header: t("app.purchases.columns.amount"),
      align: "right",
      cell: (p) => <span className="whitespace-nowrap font-mono text-sm text-stone-100">{fmt.money(p.amount, p.currency)}</span>,
      sortValue: (p) => Number(p.amount),
      exportValue: (p) => p.amount,
    },
    {
      key: "status",
      header: t("app.purchases.columns.status"),
      cell: (p) => <StatusBadge kind="purchaseStatus" value={p.status} />,
      sortValue: (p) => p.status,
      exportValue: (p) => label("purchaseStatus", p.status),
    },
    {
      key: "contract",
      header: t("app.purchases.columns.contract"),
      cell: (p) => (p.contract ? <StatusBadge kind="contractStatus" value={p.contract.status} /> : <span className="text-ink-400">—</span>),
      exportValue: (p) => (p.contract ? label("contractStatus", p.contract.status) : ""),
      hideOnMobile: true,
    },
    {
      key: "date",
      header: t("app.purchases.columns.date"),
      cell: (p) => <span className="whitespace-nowrap text-xs text-ink-300">{fmt.date(p.createdAt)}</span>,
      sortValue: (p) => new Date(p.createdAt),
      exportValue: (p) => p.createdAt.slice(0, 10),
      hideOnMobile: true,
    },
  ];

  return (
    <div>
      <PageHead icon={Bag2}
        eyebrow={t("app.shell.area")}
        title={t("app.purchases.title")}
        description={t("app.purchases.subtitle")}
        actions={
          <Button asChild variant="gold">
            <Link href="/projects">
              <Buildings size={18} variant="Bulk" /> {t("app.dashboard.browse")}
            </Link>
          </Button>
        }
      />
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !loading && (data ?? []).length === 0 ? (
        <EmptyState
          icon={Bag2}
          title={t("app.purchases.empty")}
          description={t("app.purchases.emptyHint")}
          action={
            <Button asChild variant="outline">
              <Link href="/projects">{t("app.dashboard.browse")}</Link>
            </Button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={data ?? []}
          loading={loading}
          rowKey={(p) => p.id}
          onRowClick={(p) => router.push(`/app/purchases/${p.id}`)}
          searchText={(p) => `${p.number} ${p.project.name} ${p.unit?.number ?? ""}`}
          searchPlaceholder={t("app.purchases.search")}
          exportName="purchases"
          initialSort={{ key: "date", dir: "desc" }}
        />
      )}
    </div>
  );
}
