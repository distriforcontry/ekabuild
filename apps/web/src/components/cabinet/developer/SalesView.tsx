"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowRight, Calendar, DollarCircle, FingerScan, ReceiptText } from "iconsax-reactjs";
import { Sheet } from "@/components/admin/primitives";
import { ExcelButton } from "@/components/control/ExportButton";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { useI18n } from "@/i18n/client";
import type { PurchaseItem } from "@/lib/types";
import { formatPhone } from "@/components/auth/auth-utils";
import { asList, useApi } from "../hooks";
import { useFmt } from "../format";
import { ErrorState } from "../states";
import { AnimatedNumber, Kpi, PageHead, PanelEmpty as EmptyState } from "../kit";
import { DealDocuments, PaymentSchedule } from "../DealFinance";

export function SalesView() {
  const { t, label, tr } = useI18n();
  const fmt = useFmt();
  const { data, loading, error, reload } = useApi<PurchaseItem[]>("/dev/purchases", undefined, { select: asList });
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [lastOpen, setLastOpen] = React.useState<PurchaseItem | null>(null);
  const open = (data ?? []).find((p) => p.id === openId) ?? null;
  React.useEffect(() => {
    if (open) setLastOpen(open);
  }, [open]);
  const sheet = open ?? lastOpen;
  // deep links from Finance / Deadlines: /app/developer/sales?q=P-2026-…
  const [initialQ, setInitialQ] = React.useState<string | null>(null);
  React.useEffect(() => setInitialQ(new URLSearchParams(window.location.search).get("q") ?? ""), []);

  // the list DTO says whether *I* (the seller) can sign right now
  const canSign = (p: PurchaseItem) => Boolean(p.contract?.canSign);
  const toSign = (data ?? []).filter(canSign).length;

  const columns: Column<PurchaseItem>[] = [
    {
      key: "number",
      header: t("app.developer.sales.columns.number"),
      alwaysVisible: true,
      cell: (p) => <span className="whitespace-nowrap font-mono text-xs text-gold-200">{p.number}</span>,
      sortValue: (p) => p.number,
      exportValue: (p) => p.number,
    },
    {
      key: "project",
      header: t("app.developer.sales.columns.project"),
      cell: (p) => (
        <div className="min-w-40 max-w-60">
          <div className="truncate font-medium text-stone-100">{tr(p.project.name)}</div>
          <div className="truncate text-xs text-ink-400">{p.unit ? t("app.common.unitShort", { section: p.unit.section, floor: p.unit.floor, number: p.unit.number }) : label("purchaseKind", p.kind)}</div>
        </div>
      ),
      sortValue: (p) => p.project.name,
      exportValue: (p) => `${p.project.name} ${p.unit?.number ?? ""}`,
    },
    {
      key: "buyer",
      header: t("app.developer.sales.columns.buyer"),
      cell: (p) => (
        <div className="min-w-0 max-w-56">
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
      cell: (p) => (
        <div className="whitespace-nowrap">
          <div className="font-mono text-sm">{fmt.money(p.amount, p.currency)}</div>
          {p.kind === "UNIT" && p.planType && (
            <div className="text-[11px] text-ink-400">
              {label("paymentPlan", p.planType)}
              {p.planType === "INSTALLMENT" ? ` · ${p.downPercent}% + ${p.months}` : ""}
            </div>
          )}
        </div>
      ),
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
          <div className="flex items-center gap-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
            <StatusBadge kind="contractStatus" value={p.contract.status} />
            <Button size="icon-sm" variant="ghost" onClick={() => setOpenId(p.id)} aria-label={t("app.finance.seller.schedule")} title={t("app.finance.seller.schedule")}>
              <Calendar variant="Bulk" className="text-gold-300" />
            </Button>
            <Button asChild size="sm" variant={canSign(p) ? "gold" : "ghost"}>
              <Link href={`/app/contracts/${p.contract.id}`}>
                {canSign(p) ? (
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
      cell: (p) => <span className="whitespace-nowrap text-xs text-ink-300">{fmt.date(p.createdAt)}</span>,
      sortValue: (p) => new Date(p.createdAt),
      exportValue: (p) => p.createdAt.slice(0, 10),
      hideOnMobile: true,
    },
  ];

  return (
    <div>
      <PageHead
        icon={ReceiptText}
        eyebrow={t("app.shell.sections.developer")}
        title={t("app.developer.sales.title")}
        description={t("app.developer.sales.subtitle")}
        actions={
          <>
            <ExcelButton area="dev" entity="purchases" size="md" />
            <Button asChild variant="secondary">
              <Link href="/app/developer/finance">
                <DollarCircle size={16} variant="Bulk" className="text-gold-300" /> {t("app.finance.nav.finance")}
              </Link>
            </Button>
          </>
        }
      />
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !loading && !(data ?? []).length ? (
        <EmptyState icon={ReceiptText} title={t("app.developer.sales.empty")} description={t("app.developer.sales.emptyHint")} />
      ) : (
        <div className="space-y-6">
          {!loading && (
            <div className="grid grid-cols-3 gap-3 md:gap-4">
              <Kpi index={0} label={t("app.developer.sales.stats.total")} value={<AnimatedNumber value={(data ?? []).length} />} icon={ReceiptText} />
              <Kpi index={1} label={t("app.developer.sales.stats.toSign")} value={<AnimatedNumber value={toSign} />} icon={FingerScan} accent={toSign > 0} />
              <Kpi
                index={2}
                label={t("app.developer.sales.stats.amount")}
                value={<AnimatedNumber value={(data ?? []).filter((p) => p.status !== "CANCELLED").reduce((x, p) => x + Number(p.amount || 0), 0)} format={(n) => fmt.compact(Math.round(n))} />}
                icon={DollarCircle}
              />
            </div>
          )}
        {initialQ !== null && (
        <DataTable
          key={initialQ}
          initialQuery={initialQ}
          columns={columns}
          data={data ?? []}
          loading={loading}
          rowKey={(p) => p.id}
          onRowClick={(p) => setOpenId(p.id)}
          searchText={(p) => `${p.number} ${p.project.name} ${p.buyer.fullName} ${p.buyerOrg?.name ?? ""}`}
          searchPlaceholder={t("app.developer.sales.search")}
          exportName="sales"
          initialSort={{ key: "date", dir: "desc" }}
        />
        )}
        </div>
      )}
      <Sheet
        open={Boolean(open)}
        onOpenChange={(o) => !o && setOpenId(null)}
        title={sheet ? t("app.finance.seller.title", { number: sheet.number }) : ""}
        description={sheet ? `${tr(sheet.project.name)}${sheet.unit ? ` · ${t("app.common.unitShort", { section: sheet.unit.section, floor: sheet.unit.floor, number: sheet.unit.number })}` : ""}` : undefined}
        width="max-w-2xl"
        footer={
          sheet?.contract && (
            <Button asChild variant="gold">
              <Link href={`/app/contracts/${sheet.contract.id}`}>
                {t("app.finance.seller.contract")} <ArrowRight size={16} />
              </Link>
            </Button>
          )
        }
      >
        {sheet && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-ink-850 p-4">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wider text-ink-400">{t("app.finance.seller.buyer")}</div>
                <div className="truncate font-semibold text-stone-100">{sheet.buyerOrg ? tr(sheet.buyerOrg.name) : sheet.buyer.fullName}</div>
                <a href={`tel:${sheet.buyer.phone}`} className="font-mono text-xs text-ink-300 hover:text-gold-300">
                  {formatPhone(sheet.buyer.phone)}
                </a>
              </div>
              <div className="text-right">
                <div className="font-mono text-lg font-semibold text-stone-100">{fmt.money(sheet.amount, sheet.currency)}</div>
                <StatusBadge kind="purchaseStatus" value={sheet.status} />
              </div>
            </div>
            {sheet.status !== "CANCELLED" && <PaymentSchedule key={sheet.id} purchase={sheet} mode="seller" />}
            <DealDocuments key={`d-${sheet.id}`} purchase={sheet} />
          </div>
        )}
      </Sheet>
    </div>
  );
}
