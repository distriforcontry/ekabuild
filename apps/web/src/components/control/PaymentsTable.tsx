"use client";
import * as React from "react";
import Link from "next/link";
import { PAYMENT_STATUSES } from "@eka/shared";
import { Call, MoneyTick, ReceiptText, TickCircle, WalletCheck } from "iconsax-reactjs";
import { toast } from "sonner";
import { Avatar, Dim, ErrorNotice, FilterSelect, ResetFilters, RowActions, SearchBox } from "@/components/admin/primitives";
import { useFormat } from "@/components/admin/format";
import { useApi, useListState } from "@/components/admin/hooks";
import { formatMasked } from "@/components/ui/masked-input";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { DataTable, type Column } from "@/components/ui/data-table";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { useI18n } from "@/i18n/client";
import { api, errorMessage } from "@/lib/api";
import type { DuePayment, PaymentsPage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { apiBase, dealHref, type Area } from "./area";
import { ExcelButton } from "./ExportButton";
import { DaysBadge, useSeqLabel } from "./ui";

const FILTERS = ["status", "from", "to"] as const;
const METHODS = ["bank", "cash", "click", "payme", "uzum"] as const;
type Method = (typeof METHODS)[number];

/** Payments registry (GET /{area}/payments): search, status, due-date range, server sort, Σ in the footer, manual reconciliation. */
export function PaymentsTable({ area, onChanged }: { area: Area; onChanged?: () => void }) {
  const { t, label, tr } = useI18n();
  const f = useFormat();
  const seqLabel = useSeqLabel();
  const list = useListState(FILTERS);
  const page = useApi<PaymentsPage>(`${apiBase(area)}/payments`, list.apiQuery);
  const [marking, setMarking] = React.useState<DuePayment | null>(null);
  const items = page.data?.items ?? [];
  const total = page.data?.total ?? 0;
  const initialLoading = page.loading && !page.data;
  const refreshing = page.loading && Boolean(page.data);

  const columns: Column<DuePayment>[] = [
    {
      key: "deal",
      header: t("admin.control.payments.columns.deal"),
      alwaysVisible: true,
      exportValue: (p) => p.purchase.number,
      cell: (p) => (
        <div className="min-w-32 max-w-52">
          <Link href={dealHref(area, p.purchase)} onClick={(e) => e.stopPropagation()} className="font-mono text-xs font-semibold text-gold-200 transition hover:text-gold-100 hover:underline">
            {p.purchase.number}
          </Link>
          <div className="truncate text-xs text-ink-400">{tr(p.purchase.projectName)}</div>
        </div>
      ),
    },
    {
      key: "buyer",
      header: t("admin.control.payments.columns.buyer"),
      hideOnMobile: true,
      exportValue: (p) => p.purchase.buyerName,
      cell: (p) => (
        <div className="flex min-w-36 max-w-52 items-center gap-2.5">
          <Avatar name={p.purchase.buyerName} size={30} />
          <div className="min-w-0">
            <div className="truncate text-sm text-stone-100">{p.purchase.buyerName}</div>
            <a href={`tel:${p.purchase.buyerPhone}`} onClick={(e) => e.stopPropagation()} className="whitespace-nowrap font-mono text-[11px] text-ink-400 transition hover:text-gold-300">
              {formatMasked("phone", p.purchase.buyerPhone)}
            </a>
          </div>
        </div>
      ),
    },
    {
      key: "seq",
      header: t("admin.control.payments.columns.seq"),
      exportValue: (p) => seqLabel(p.seq, p.purchase.planType),
      cell: (p) => (
        <span className="whitespace-nowrap text-sm text-ink-100" title={p.purchase.planType ? label("paymentPlan", p.purchase.planType) : undefined}>
          {seqLabel(p.seq, p.purchase.planType)}
        </span>
      ),
    },
    {
      key: "dueDate",
      header: t("admin.control.payments.columns.dueDate"),
      sortable: true,
      exportValue: (p) => p.dueDate,
      cell: (p) => (
        <div className="whitespace-nowrap">
          <div className="text-sm text-ink-100">{f.date(p.dueDate)}</div>
          {(p.status === "PENDING" || p.status === "OVERDUE") && <DaysBadge days={p.daysLeft} className="mt-1" />}
        </div>
      ),
    },
    {
      key: "amount",
      header: t("admin.control.payments.columns.amount"),
      sortable: true,
      align: "right",
      exportValue: (p) => p.amount,
      cell: (p) => <span className={cn("whitespace-nowrap font-mono text-sm font-semibold", p.status === "OVERDUE" ? "text-danger" : "text-stone-100")}>{f.money(p.amount)}</span>,
    },
    {
      key: "status",
      header: t("admin.control.payments.columns.status"),
      sortable: true,
      exportValue: (p) => label("paymentStatus", p.status),
      cell: (p) => <StatusBadge kind="paymentStatus" value={p.status} />,
    },
    {
      key: "paidAt",
      header: t("admin.control.payments.columns.paidAt"),
      sortable: true,
      hideOnMobile: true,
      exportValue: (p) => p.paidAt ?? "",
      cell: (p) =>
        p.paidAt ? (
          <div className="whitespace-nowrap">
            <div className="text-xs text-ink-200">{f.date(p.paidAt)}</div>
            <div className="max-w-36 truncate font-mono text-[10.5px] text-ink-400" title={p.reference ?? undefined}>
              {p.method ? methodLabel(t, p.method) : ""}
              {p.reference ? ` · ${p.reference}` : ""}
            </div>
          </div>
        ) : (
          <span className="text-ink-500">—</span>
        ),
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
            { label: t("admin.control.payments.markPaid"), icon: MoneyTick, tone: "success", onSelect: () => setMarking(p), hidden: p.status !== "PENDING" && p.status !== "OVERDUE" },
            { label: t("admin.control.openDeal"), icon: ReceiptText, onSelect: () => (window.location.href = dealHref(area, p.purchase)), separatorBefore: p.status === "PENDING" || p.status === "OVERDUE" },
            { label: t("admin.control.call"), icon: Call, onSelect: () => (window.location.href = `tel:${p.purchase.buyerPhone}`) },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <ErrorNotice error={page.error} onRetry={page.reload} />
      <Dim active={refreshing}>
        <DataTable
          columns={columns}
          data={items}
          rowKey={(p) => p.id}
          loading={initialLoading}
          server={list.server(total)}
          initialSort={list.sort}
          dense
          emptyTitle={t("admin.control.payments.empty")}
          emptyHint={t("admin.control.payments.emptyHint")}
          toolbar={
            <>
              <SearchBox value={list.q} onChange={(q) => list.update({ q })} placeholder={t("admin.control.payments.search")} className="sm:w-72" />
              <FilterSelect
                value={list.filters.status}
                onChange={(v) => list.update({ status: v })}
                placeholder={t("admin.control.payments.filters.status")}
                options={PAYMENT_STATUSES.map((v) => ({ value: v, label: label("paymentStatus", v) }))}
                className="sm:w-40"
              />
              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
                <DatePicker
                  value={list.filters.from}
                  onChange={(v) => list.update({ from: v })}
                  max={list.filters.to ?? undefined}
                  placeholder={t("admin.control.payments.filters.from")}
                  aria-label={t("admin.control.payments.filters.from")}
                  className="sm:w-40 [&_input]:h-9"
                />
                <DatePicker
                  value={list.filters.to}
                  onChange={(v) => list.update({ to: v })}
                  min={list.filters.from ?? undefined}
                  placeholder={t("admin.control.payments.filters.to")}
                  aria-label={t("admin.control.payments.filters.to")}
                  className="sm:w-40 [&_input]:h-9"
                />
              </div>
              <ResetFilters count={list.activeFilters} onReset={list.resetFilters} />
              <ExcelButton area={area} entity="payments" filters={{ q: list.q, status: list.filters.status, from: list.filters.from, to: list.filters.to }} className="sm:ml-auto" />
            </>
          }
          footer={
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-400">
                <WalletCheck size={16} variant="Bulk" className="text-gold-300" />
                {t("admin.control.payments.total")}
                <span className="font-mono normal-case tracking-normal text-ink-500">· {t("admin.control.payments.totalCount", { n: f.number(total) })}</span>
              </span>
              <span className="font-mono text-base font-semibold text-stone-100">{page.data ? f.money(page.data.sum) : "—"}</span>
            </div>
          }
        />
      </Dim>

      <MarkPaidDialog
        area={area}
        payment={marking}
        onClose={() => setMarking(null)}
        onDone={(id, body) => {
          page.setData((d) =>
            d
              ? {
                  ...d,
                  items: d.items.map((x) =>
                    x.id === id ? { ...x, status: "PAID", paidAt: body.paidAt ?? new Date().toISOString(), method: body.method, reference: body.reference } : x,
                  ),
                }
              : d,
          );
          onChanged?.();
        }}
      />
    </div>
  );
}

function methodLabel(t: ReturnType<typeof useI18n>["t"], m: string) {
  return (METHODS as readonly string[]).includes(m) || m === "demo" ? t(`admin.control.payments.methods.${m as Method | "demo"}`) : m;
}

/** POST /{area}/payments/:id/mark-paid — reference (required), method, date. */
export function MarkPaidDialog({
  area,
  payment,
  onClose,
  onDone,
}: {
  area: Area;
  payment: DuePayment | null;
  onClose: () => void;
  onDone: (id: string, body: { reference: string; method: Method; paidAt?: string }) => void;
}) {
  const { t, tr } = useI18n();
  const f = useFormat();
  const seqLabel = useSeqLabel();
  const [reference, setReference] = React.useState("");
  const [method, setMethod] = React.useState<Method>("bank");
  const [paidAt, setPaidAt] = React.useState<string | null>(null);
  const [touched, setTouched] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const last = React.useRef(payment);
  if (payment) last.current = payment;
  const p = payment ?? last.current;

  React.useEffect(() => {
    if (payment) {
      setReference("");
      setMethod("bank");
      setPaidAt(null);
      setTouched(false);
    }
  }, [payment]);

  const invalid = reference.trim().length < 3;
  const today = new Date().toISOString().slice(0, 10);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!p || invalid) return;
    setBusy(true);
    try {
      const body = { reference: reference.trim(), method, ...(paidAt ? { paidAt } : {}) };
      await api.post(`${apiBase(area)}/payments/${p.id}/mark-paid`, body);
      toast.success(t("admin.control.payments.mark.success"), { description: `${p.purchase.number} · ${f.money(p.amount)}` });
      onDone(p.id, body);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={Boolean(payment)} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent size="md">
        <form onSubmit={submit} noValidate>
          <DialogHeader className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-success/30 bg-success/10 text-success">
              <MoneyTick size={22} variant="Bulk" />
            </span>
            <div className="min-w-0">
              <DialogTitle>{t("admin.control.payments.mark.title")}</DialogTitle>
              <DialogDescription>{t("admin.control.payments.mark.description")}</DialogDescription>
            </div>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {p && (
              <div className="flex items-center gap-3 rounded-2xl border border-line bg-ink-850 p-3.5">
                <Avatar name={p.purchase.buyerName} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-stone-100">{p.purchase.buyerName}</div>
                  <div className="truncate text-xs text-ink-400">
                    <span className="font-mono text-gold-200">{p.purchase.number}</span> · {tr(p.purchase.projectName)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-base font-semibold text-stone-100">{f.money(p.amount)}</div>
                  <div className="text-[11px] text-ink-400">
                    {seqLabel(p.seq, p.purchase.planType)} · {f.date(p.dueDate)}
                  </div>
                </div>
              </div>
            )}
            <Field
              label={
                <>
                  {t("admin.control.payments.mark.reference")} <span className="text-danger">*</span>
                </>
              }
              htmlFor="mp-ref"
              error={touched && invalid ? t("admin.control.payments.mark.referenceError") : undefined}
            >
              <Input
                id="mp-ref"
                autoFocus
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder={t("admin.control.payments.mark.referencePlaceholder")}
                aria-invalid={touched && invalid}
                aria-required
                maxLength={64}
                className="font-mono"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("admin.control.payments.mark.method")}>
                <Combobox
                  value={method}
                  onChange={(v) => v && setMethod(v as Method)}
                  options={METHODS.map((m) => ({ value: m, label: t(`admin.control.payments.methods.${m}`) }))}
                  clearable={false}
                  searchable={false}
                  aria-label={t("admin.control.payments.mark.method")}
                />
              </Field>
              <Field label={t("admin.control.payments.mark.paidAt")} hint={t("admin.control.payments.mark.paidAtHint")}>
                <DatePicker value={paidAt} onChange={setPaidAt} max={today} aria-label={t("admin.control.payments.mark.paidAt")} />
              </Field>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
              {t("common.actions.cancel")}
            </Button>
            <Button type="submit" variant="success" loading={busy}>
              {!busy && <TickCircle variant="Bold" />} {t("admin.control.payments.mark.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
