"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Clock, DocumentText, TickCircle } from "iconsax-reactjs";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { useI18n } from "@/i18n/client";
import { api } from "@/lib/api";
import type { PurchaseItem } from "@/lib/types";
import { isAdmin } from "@/lib/roles";
import { useCabinetUser } from "../CabinetContext";
import { asList } from "../hooks";
import { useFmt } from "../format";
import { AnimatedNumber, Kpi, PageHead, PanelEmpty } from "../kit";
import { ErrorState } from "../states";

type Side = "BUYER" | "SELLER";
type Row = PurchaseItem & { contract: NonNullable<PurchaseItem["contract"]>; side: Side };

/** Contracts I am a party to: as a buyer (/purchases) and — for developers — as the seller (/dev/purchases). */
function useMyContracts(seller: boolean) {
  const [state, setState] = React.useState<{ rows: Row[]; loading: boolean; error: unknown }>({ rows: [], loading: true, error: null });
  const load = React.useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    const [mine, sold] = await Promise.allSettled([api.get<unknown>("/purchases"), seller ? api.get<unknown>("/dev/purchases") : Promise.resolve([])]);
    if (mine.status === "rejected" && (!seller || sold.status === "rejected")) {
      setState({ rows: [], loading: false, error: mine.reason });
      return;
    }
    const rows = new Map<string, Row>();
    const add = (list: PurchaseItem[], side: Side) => {
      for (const p of list) if (p.contract && !rows.has(p.contract.id)) rows.set(p.contract.id, { ...p, contract: p.contract, side });
    };
    if (sold.status === "fulfilled") add(asList<PurchaseItem>(sold.value), "SELLER");
    if (mine.status === "fulfilled") add(asList<PurchaseItem>(mine.value), "BUYER");
    setState({ rows: [...rows.values()], loading: false, error: null });
  }, [seller]);
  React.useEffect(() => {
    void load();
  }, [load]);
  return { ...state, reload: load };
}

export function ContractsView() {
  const { t, label, tr } = useI18n();
  const fmt = useFmt();
  const router = useRouter();
  const { user } = useCabinetUser();
  const seller = user.role === "DEVELOPER" || isAdmin(user.role);
  const { rows, loading, error, reload } = useMyContracts(seller);
  const showSide = seller && rows.some((r) => r.side === "SELLER");
  const waiting = rows.filter((r) => r.contract.status === "PENDING" || r.contract.status === "PARTIALLY_SIGNED").length;
  const signed = rows.filter((r) => r.contract.status === "SIGNED").length;

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
    ...(showSide
      ? [
          {
            key: "side",
            header: t("app.contracts.columns.side"),
            cell: (r: Row) => <Badge tone={r.side === "SELLER" ? "gold" : "info"}>{label("signerRole", r.side)}</Badge>,
            sortValue: (r: Row) => r.side,
            exportValue: (r: Row) => label("signerRole", r.side),
          } satisfies Column<Row>,
        ]
      : []),
    {
      key: "project",
      header: t("app.contracts.columns.project"),
      cell: (r) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-stone-100">{tr(r.project.name)}</div>
          {r.side === "SELLER" && <div className="truncate text-xs text-ink-400">{r.buyerOrg ? tr(r.buyerOrg.name) : r.buyer.fullName}</div>}
        </div>
      ),
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
      hideOnMobile: true,
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
      cell: (r) => <span className="whitespace-nowrap text-xs text-ink-300">{fmt.date(r.contract.signedAt)}</span>,
      sortValue: (r) => (r.contract.signedAt ? new Date(r.contract.signedAt) : null),
      exportValue: (r) => r.contract.signedAt?.slice(0, 10) ?? "",
      hideOnMobile: true,
    },
    {
      key: "date",
      header: t("app.contracts.columns.date"),
      cell: (r) => <span className="whitespace-nowrap text-xs text-ink-300">{fmt.date(r.createdAt)}</span>,
      sortValue: (r) => new Date(r.createdAt),
      exportValue: (r) => r.createdAt.slice(0, 10),
      hideOnMobile: true,
    },
  ];

  return (
    <div>
      <PageHead
        icon={DocumentText}
        eyebrow={t("app.shell.area")}
        title={t("app.contracts.title")}
        description={seller ? t("app.contracts.subtitleSeller") : t("app.contracts.subtitle")}
      />
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !loading && rows.length === 0 ? (
        <PanelEmpty icon={DocumentText} title={t("app.contracts.empty")} hint={t("app.contracts.emptyHint")} />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-3 md:gap-4">
            <Kpi index={0} label={t("app.contracts.stats.total")} value={<AnimatedNumber value={rows.length} />} icon={DocumentText} />
            <Kpi index={1} label={t("app.contracts.stats.signed")} value={<AnimatedNumber value={signed} />} icon={TickCircle} />
            <Kpi index={2} label={t("app.contracts.stats.waiting")} value={<AnimatedNumber value={waiting} />} icon={Clock} accent={waiting > 0} />
          </div>
          <DataTable
            columns={columns}
            data={rows}
            loading={loading}
            rowKey={(r) => r.contract.id}
            onRowClick={(r) => router.push(`/app/contracts/${r.contract.id}`)}
            searchText={(r) => `${r.contract.number} ${r.project.name} ${r.buyer.fullName} ${r.buyerOrg?.name ?? ""}`}
            searchPlaceholder={t("app.contracts.search")}
            exportName="contracts"
            initialSort={{ key: "date", dir: "desc" }}
          />
        </div>
      )}
    </div>
  );
}
