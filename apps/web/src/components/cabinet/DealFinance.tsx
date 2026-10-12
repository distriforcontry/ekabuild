"use client";
import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowDown2, ArrowUp2, Calendar, DocumentDownload, DocumentText1, Lock1, TickCircle, Timer1, Wallet2, Warning2 } from "iconsax-reactjs";
import { toast } from "sonner";
import { DaysBadge, useSeqLabel } from "@/components/control/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { useI18n } from "@/i18n/client";
import { API_BASE, api, errorMessage } from "@/lib/api";
import type { AnnexItem, PaymentItem, PurchaseItem, PurchasePayments } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useFmt } from "./format";
import { asList, useApi } from "./hooks";
import { SuccessBurst } from "./SuccessBurst";
import { ConfirmDialog } from "./ui";

const EASE = [0.16, 1, 0.3, 1] as const;
const daysTo = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);

/* ───────────────────────────── progress ring ───────────────────────────── */

export function ProgressRing({ value, size = 128, stroke = 10, children }: { value: number; size?: number; stroke?: number; children?: React.ReactNode }) {
  const reduce = useReducedMotion();
  const id = React.useId().replace(/:/g, "");
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id={`ring-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-gold-300)" />
            <stop offset="100%" stopColor="var(--color-gold-600)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-line-strong)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#ring-${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={reduce ? false : { strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - v / 100) }}
          transition={{ duration: 1.2, ease: EASE }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

/* ───────────────────────────── payment schedule ───────────────────────────── */

const VISIBLE = 6;

/**
 * Payment schedule of a deal (GET /purchases/:id/payments): paid / balance ring, next instalment with days left,
 * overdue warning, full schedule table. Buyers pay the next due instalment (POST /purchases/:id/pay).
 */
export function PaymentSchedule({
  purchase,
  mode = "buyer",
  onPaid,
  className,
}: {
  purchase: Pick<PurchaseItem, "id" | "status" | "currency" | "kind">;
  mode?: "buyer" | "seller";
  onPaid?: () => void;
  className?: string;
}) {
  const { t, label } = useI18n();
  const fmt = useFmt();
  const seqLabel = useSeqLabel();
  const reduce = useReducedMotion();
  const res = useApi<PurchasePayments>(`/purchases/${purchase.id}/payments`);
  const [all, setAll] = React.useState(false);
  const [payOpen, setPayOpen] = React.useState(false);
  const [paidOpen, setPaidOpen] = React.useState(false);
  const d = res.data;
  const cur = purchase.currency;
  const canPay = mode === "buyer" && (purchase.status === "SIGNED" || purchase.status === "PAID") && Boolean(d?.next);
  const locked = mode === "buyer" && Boolean(d?.next) && (purchase.status === "PENDING_SIGNATURES" || purchase.status === "DRAFT");

  const pay = async () => {
    try {
      await api.post(`/purchases/${purchase.id}/pay`);
      setPayOpen(false);
      setPaidOpen(true);
      await res.reload();
      onPaid?.();
    } catch (e) {
      toast.error(errorMessage(e, t("common.errors.generic")));
    }
  };

  if (res.loading && !d) {
    return (
      <section className={cn("rounded-2xl border border-line bg-ink-900 p-5 md:p-6", className)}>
        <Skeleton className="h-5 w-40" />
        <div className="mt-5 flex items-center gap-6">
          <Skeleton className="size-32 rounded-full" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
        <Skeleton className="mt-6 h-40 w-full" />
      </section>
    );
  }
  if (res.error || !d) {
    return (
      <section className={cn("rounded-2xl border border-line bg-ink-900 p-5 text-sm text-ink-300 md:p-6", className)}>
        <div className="flex items-center justify-between gap-3">
          <span>{t("app.finance.schedule.error")}</span>
          <Button size="sm" variant="secondary" onClick={() => res.reload()}>
            {t("common.actions.retry")}
          </Button>
        </div>
      </section>
    );
  }

  const items = d.items;
  const nextIdx = d.next ? items.findIndex((x) => x.id === d.next!.id) : -1;
  const shown = all || items.length <= VISIBLE + 1 ? items : items.slice(0, Math.max(VISIBLE, nextIdx + 2));
  const subtitle = d.planType === "INSTALLMENT" ? t("app.finance.schedule.subtitleInstallment", { down: d.downPercent, months: d.months }) : t("app.finance.schedule.subtitleFull");
  const nextLabel = d.next ? seqLabel(d.next.seq, d.planType) : "";

  return (
    <section className={cn("@container relative overflow-hidden rounded-2xl border border-line bg-ink-900/80 shadow-card backdrop-blur-sm", className)} aria-labelledby={`sched-${purchase.id}`}>
      <header className="flex items-center gap-3 px-5 pt-5 md:px-6 md:pt-6">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-gold-500/20 bg-gold-500/10 text-gold-300">
          <Calendar size={18} variant="Bulk" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={`sched-${purchase.id}`} className="text-[15px] font-semibold tracking-tight text-stone-100">
            {t("app.finance.schedule.title")}
          </h2>
          <p className="mt-0.5 text-xs text-ink-400">{subtitle}</p>
        </div>
        <Badge tone={d.planType === "INSTALLMENT" ? "gold" : "neutral"} className="shrink-0">
          {label("paymentPlan", d.planType)}
        </Badge>
      </header>

      <div className="p-5 md:p-6">
        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line-strong px-4 py-8 text-center text-sm text-ink-400">{t("app.finance.schedule.empty")}</p>
        ) : (
          <>
            {/* overdue warning */}
            {d.overdue > 0 && (
              <motion.div
                initial={reduce ? false : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                role="alert"
                className="mb-5 flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/[0.07] px-4 py-3 text-sm"
              >
                <Warning2 size={18} variant="Bulk" className="mt-px shrink-0 text-danger" />
                <div>
                  <div className="font-semibold text-danger">{t("app.finance.schedule.overdueWarning", { n: d.overdue })}</div>
                  <div className="mt-0.5 text-xs text-ink-300">{t("app.finance.schedule.overdueHint")}</div>
                </div>
              </motion.div>
            )}

            {/* summary: ring + numbers + next (container-query layout: works in the page and in the seller drawer) */}
            <div className="grid gap-5 @3xl:grid-cols-[auto_1fr] @3xl:items-center">
              <div className="flex items-center gap-5">
                <ProgressRing value={d.progress}>
                  <div>
                    <div className="font-mono text-2xl font-semibold text-stone-100">{d.progress}%</div>
                    <div className="mt-0.5 text-[10px] uppercase tracking-wider text-ink-400">{t("app.finance.schedule.paid")}</div>
                  </div>
                </ProgressRing>
                <dl className="min-w-0 flex-1 space-y-2.5 @3xl:hidden">
                  <Stat label={t("app.finance.schedule.paid")} value={fmt.money(d.paid, cur)} compact={fmt.compact(d.paid)} tone="success" />
                  <Stat label={t("app.finance.schedule.balance")} value={fmt.money(d.balance, cur)} compact={fmt.compact(d.balance)} />
                  <Stat label={t("app.finance.schedule.total")} value={fmt.money(d.total, cur)} compact={fmt.compact(d.total)} muted />
                </dl>
              </div>
              <div className="grid gap-3 @3xl:grid-cols-2">
                <dl className="hidden space-y-2.5 rounded-xl border border-line bg-ink-850/60 p-3.5 @3xl:block">
                  <Stat label={t("app.finance.schedule.paid")} value={fmt.money(d.paid, cur)} tone="success" />
                  <Stat label={t("app.finance.schedule.balance")} value={fmt.money(d.balance, cur)} />
                  <Stat label={t("app.finance.schedule.total")} value={fmt.money(d.total, cur)} muted />
                </dl>
                {d.next ? (
                  <div
                    className={cn(
                      "relative overflow-hidden rounded-xl border p-3.5",
                      d.next.status === "OVERDUE" ? "border-danger/35 bg-danger/[0.06]" : "border-gold-500/35 bg-gradient-to-br from-gold-500/[0.1] to-transparent shadow-glow",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">{t("app.finance.schedule.next")}</span>
                      <DaysBadge days={daysTo(d.next.dueDate)} />
                    </div>
                    <div className={cn("mt-1.5 font-mono text-xl font-semibold", d.next.status === "OVERDUE" ? "text-danger" : "text-stone-100")}>{fmt.money(d.next.amount, cur)}</div>
                    <div className="mt-0.5 text-xs text-ink-400">
                      {nextLabel} · {t("app.finance.schedule.nextDue", { date: fmt.date(d.next.dueDate) })}
                    </div>
                    {canPay && (
                      <Button variant="gold" size="sm" className="mt-3 w-full" onClick={() => setPayOpen(true)}>
                        <Wallet2 variant="Bold" /> {t("app.finance.schedule.payNext", { amount: fmt.compact(d.next.amount) })}
                      </Button>
                    )}
                    {locked && (
                      <p className="mt-3 flex items-start gap-1.5 text-[11px] text-ink-400">
                        <Lock1 size={13} className="mt-px shrink-0" /> {t("app.finance.schedule.payLocked")}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/[0.07] p-3.5">
                    <TickCircle size={26} variant="Bulk" className="shrink-0 text-success" />
                    <div>
                      <div className="text-sm font-semibold text-stone-100">{t("app.finance.schedule.allPaid")}</div>
                      <div className="text-xs text-ink-400">{t("app.finance.schedule.allPaidHint")}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* schedule: stacked rows on phones, table from sm */}
            <ul className="mt-6 divide-y divide-line overflow-hidden rounded-xl border border-line @lg:hidden">
              {shown.map((p) => {
                const isNext = p.id === d.next?.id;
                const late = p.status === "OVERDUE";
                return (
                  <li key={p.id} className={cn("flex items-center gap-3 px-3 py-2.5", isNext && !late && "bg-gold-500/[0.07]", late && "bg-danger/[0.05]")}>
                    <span className="w-5 shrink-0 font-mono text-[11px] text-ink-500">{p.seq + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className={cn("truncate text-sm", isNext ? "font-semibold text-stone-100" : "text-ink-100")}>{seqLabel(p.seq, d.planType)}</div>
                      <div className="text-[11px] text-ink-400">
                        {fmt.date(p.dueDate)}
                        {p.paidAt && <span className="text-ink-500"> · ✓ {fmt.date(p.paidAt)}</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className={cn("whitespace-nowrap font-mono text-[13px]", late ? "font-semibold text-danger" : "text-stone-100")}>{fmt.money(p.amount, cur)}</span>
                      <StatusBadge kind="paymentStatus" value={p.status} className="px-1.5 py-0 text-[10px]" />
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-6 hidden overflow-x-auto rounded-xl border border-line @lg:block">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line bg-fg/[0.02] text-left text-[10.5px] font-semibold uppercase tracking-wider text-ink-400">
                    <th className="w-10 px-3 py-2.5">{t("app.finance.schedule.columns.n")}</th>
                    <th className="px-3 py-2.5">{t("app.finance.schedule.columns.payment")}</th>
                    <th className="px-3 py-2.5">{t("app.finance.schedule.columns.due")}</th>
                    <th className="px-3 py-2.5 text-right">{t("app.finance.schedule.columns.amount")}</th>
                    <th className="px-3 py-2.5">{t("app.finance.schedule.columns.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence initial={false}>
                    {shown.map((p, i) => (
                      <ScheduleRow key={p.id} p={p} index={i} isNext={p.id === d.next?.id} label={seqLabel(p.seq, d.planType)} currency={cur} />
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
            {items.length > shown.length || all ? (
              <div className="mt-2 text-center">
                <Button variant="ghost" size="sm" onClick={() => setAll((a) => !a)}>
                  {all ? <ArrowUp2 /> : <ArrowDown2 />}
                  {all ? t("app.finance.schedule.showLess") : t("app.finance.schedule.showAll", { n: items.length })}
                </Button>
              </div>
            ) : null}
            {mode === "buyer" && canPay && <p className="mt-3 text-[11px] text-ink-400">{t("app.finance.schedule.demo")}</p>}
          </>
        )}
      </div>

      <ConfirmDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        icon={Wallet2}
        title={t("app.finance.schedule.payTitle")}
        description={d.next ? t("app.finance.schedule.payText", { label: nextLabel, amount: fmt.money(d.next.amount, cur) }) : undefined}
        confirmLabel={t("app.finance.schedule.payConfirm")}
        onConfirm={pay}
      >
        <p className="text-xs text-ink-400">{t("app.finance.schedule.demo")}</p>
      </ConfirmDialog>

      <Dialog open={paidOpen} onOpenChange={setPaidOpen}>
        <DialogContent size="sm" className="overflow-hidden">
          <AnimatePresence>
            {paidOpen && (
              <div className="flex flex-col items-center px-6 pb-8 pt-4 text-center">
                <SuccessBurst size={96} />
                <DialogTitle className="-mt-4 font-display text-3xl font-medium">{t("app.finance.schedule.paySuccess")}</DialogTitle>
                <p className="mt-2 max-w-xs text-sm text-ink-300">{t("app.finance.schedule.paySuccessText")}</p>
                <Button variant="gold" className="mt-6" onClick={() => setPaidOpen(false)}>
                  {t("common.actions.close")}
                </Button>
              </div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Stat({ label, value, compact, tone, muted }: { label: string; value: string; compact?: string; tone?: "success"; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-ink-400">{label}</dt>
      <dd className={cn("whitespace-nowrap font-mono text-sm font-semibold", tone === "success" ? "text-success" : muted ? "text-ink-300" : "text-stone-100")}>
        {compact ? (
          <>
            <span className="@md:hidden">{compact}</span>
            <span className="hidden @md:inline">{value}</span>
          </>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

function ScheduleRow({ p, index, isNext, label, currency }: { p: PaymentItem; index: number; isNext: boolean; label: string; currency: string }) {
  const fmt = useFmt();
  const reduce = useReducedMotion();
  const late = p.status === "OVERDUE";
  return (
    <motion.tr
      initial={reduce ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index, 10) * 0.02 }}
      className={cn(
        "border-b border-line last:border-0",
        isNext && !late && "bg-gold-500/[0.07]",
        late && "bg-danger/[0.05]",
        p.status === "PAID" && "text-ink-300",
      )}
    >
      <td className="px-3 py-2.5 font-mono text-xs text-ink-400">
        <span className="relative inline-flex items-center">
          {isNext && <span className="absolute -left-2 size-1.5 rounded-full bg-gold-400" aria-hidden />}
          {p.seq + 1}
        </span>
      </td>
      <td className={cn("px-3 py-2.5", isNext ? "font-semibold text-stone-100" : "text-ink-100")}>{label}</td>
      <td className="whitespace-nowrap px-3 py-2.5 text-xs text-ink-200">
        {fmt.date(p.dueDate)}
        {p.paidAt && <div className="text-[10.5px] text-ink-500">✓ {fmt.date(p.paidAt)}</div>}
      </td>
      <td className={cn("whitespace-nowrap px-3 py-2.5 text-right font-mono", late ? "font-semibold text-danger" : isNext ? "font-semibold text-stone-100" : "")}>{fmt.money(p.amount, currency)}</td>
      <td className="px-3 py-2.5">
        <StatusBadge kind="paymentStatus" value={p.status} />
      </td>
    </motion.tr>
  );
}

/* ───────────────────────────── reservation countdown ───────────────────────────── */

export function ReservationCountdown({ until, className }: { until: string; className?: string }) {
  const { t } = useI18n();
  const fmt = useFmt();
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const end = new Date(until).getTime();
  const left = Math.max(0, end - (now ?? end));
  const expired = now != null && left <= 0;
  const parts = [
    { v: Math.floor(left / 86_400_000), l: t("app.finance.reservation.d") },
    { v: Math.floor((left / 3_600_000) % 24), l: t("app.finance.reservation.h") },
    { v: Math.floor((left / 60_000) % 60), l: t("app.finance.reservation.m") },
    { v: Math.floor((left / 1000) % 60), l: t("app.finance.reservation.s") },
  ];
  const urgent = left < 86_400_000 * 2;
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border p-5",
        expired ? "border-danger/30 bg-danger/[0.06]" : urgent ? "border-warning/35 bg-gradient-to-br from-warning/[0.09] to-ink-900" : "border-gold-500/30 bg-gradient-to-br from-gold-500/[0.08] to-ink-900",
        className,
      )}
      aria-live="off"
    >
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-400">
        <Timer1 size={15} variant="Bulk" className={expired ? "text-danger" : urgent ? "text-warning" : "text-gold-300"} />
        {expired ? t("app.finance.reservation.expired") : t("app.finance.reservation.title")}
      </div>
      {!expired && (
        <div className="mt-3 grid grid-cols-4 gap-2" role="timer" aria-label={fmt.dateTime(until)}>
          {parts.map((p) => (
            <div key={p.l} className="rounded-xl border border-line bg-ink-900/80 py-2 text-center">
              <div className={cn("font-mono text-xl font-semibold tabular-nums", urgent ? "text-warning" : "text-stone-100")}>{now == null ? "--" : String(p.v).padStart(2, "0")}</div>
              <div className="text-[10px] uppercase tracking-wider text-ink-400">{p.l}</div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-ink-400">
        <span className="font-mono text-ink-200">{fmt.dateTime(until)}</span> — {t("app.finance.reservation.hint")}
      </p>
    </section>
  );
}

/* ───────────────────────────── deal documents ───────────────────────────── */

/** Word downloads: the contract (with SHA-256 + signatures evidence) and the deal's annexes. */
export function DealDocuments({ purchase, className }: { purchase: Pick<PurchaseItem, "id" | "contract">; className?: string }) {
  const { t, tr } = useI18n();
  const annexes = useApi<AnnexItem[]>(purchase.contract ? `/purchases/${purchase.id}/annexes` : null, undefined, { select: asList });
  const reduce = useReducedMotion();
  const rows: { key: string; title: string; hint: string; href: string; contract?: boolean }[] = [];
  if (purchase.contract)
    rows.push({
      key: "contract",
      title: t("app.finance.documents.contract"),
      hint: t("app.finance.documents.contractHint", { number: purchase.contract.number }),
      href: `${API_BASE}/contracts/${purchase.contract.id}/docx`,
      contract: true,
    });
  for (const a of annexes.data ?? [])
    rows.push({ key: a.key, title: tr(a.name), hint: `${t("app.finance.documents.annex")} · ${t("app.finance.documents.version", { n: a.version })}`, href: `${API_BASE}/purchases/${purchase.id}/annexes/${a.key}` });

  return (
    <section className={cn("rounded-2xl border border-line bg-ink-900/80 shadow-card", className)}>
      <header className="flex items-center gap-3 px-5 pt-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-gold-500/20 bg-gold-500/10 text-gold-300">
          <DocumentText1 size={18} variant="Bulk" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold tracking-tight text-stone-100">{t("app.finance.documents.title")}</h2>
          <p className="mt-0.5 text-xs text-ink-400">{t("app.finance.documents.subtitle")}</p>
        </div>
      </header>
      <div className="p-3 sm:p-4">
        {!purchase.contract ? (
          <p className="px-2 py-4 text-sm text-ink-400">{t("app.finance.documents.none")}</p>
        ) : (
          <ul className="space-y-1.5">
            {rows.map((r, i) => (
              <motion.li key={r.key} initial={reduce ? false : { opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05, duration: 0.35 }}>
                <a
                  href={r.href}
                  download
                  data-doc={r.key}
                  className="group flex items-center gap-3 rounded-xl border border-transparent px-2.5 py-2.5 transition hover:border-line hover:bg-fg/[0.03]"
                >
                  <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl border font-mono text-[9px] font-bold", r.contract ? "border-info/30 bg-info/10 text-info" : "border-line bg-ink-850 text-ink-300")}>
                    DOCX
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-stone-100">{r.title}</span>
                    <span className="block truncate text-[11px] text-ink-400">{r.hint}</span>
                  </span>
                  <DocumentDownload size={18} className="shrink-0 text-ink-400 transition group-hover:translate-y-0.5 group-hover:text-gold-300" aria-label={t("app.finance.documents.download")} />
                </a>
              </motion.li>
            ))}
            {annexes.loading && !annexes.data && (
              <li className="space-y-1.5 px-2.5">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </li>
            )}
          </ul>
        )}
      </div>
    </section>
  );
}
