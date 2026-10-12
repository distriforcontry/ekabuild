"use client";
import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Calculator, Calendar, MoneyRecive, TickCircle, Wallet2 } from "iconsax-reactjs";
import { useFormat } from "@/components/catalog/use-format";
import { MoneyInput } from "@/components/ui/masked-input";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n/client";
import { api } from "@/lib/api";
import type { InstallmentCalc, PaymentPlanType } from "@/lib/types";
import { cn } from "@/lib/utils";

export type PlanChoice = { planType: PaymentPlanType; downPercent: number; months: number };

export const DEFAULT_PLAN: PlanChoice = { planType: "FULL", downPercent: 30, months: 12 };
const MONTHS = [6, 12, 18, 24, 36, 48, 60];
const DOWN_CHIPS = [20, 30, 40, 50];
const MIN_DOWN = 20;
const MAX_DOWN = 90;

/** Debounced live calculation from GET /calc/installment (public). */
export function useInstallmentCalc(amount: number | null, downPercent: number, months: number, enabled = true) {
  const [data, setData] = React.useState<InstallmentCalc | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(false);
  React.useEffect(() => {
    if (!enabled || !amount || amount <= 0) return;
    let alive = true;
    setLoading(true);
    const id = setTimeout(() => {
      api
        .get<InstallmentCalc>("/calc/installment", { query: { amount: Math.round(amount), downPercent, months } })
        .then((r) => {
          if (!alive) return;
          setData(r);
          setError(false);
        })
        .catch(() => alive && setError(true))
        .finally(() => alive && setLoading(false));
    }, 220);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [amount, downPercent, months, enabled]);
  return { data, loading, error };
}

/* ───────────────────────────── controls ───────────────────────────── */

function Chip({ active, onClick, children, label }: { active: boolean; onClick: () => void; children: React.ReactNode; label?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "relative h-9 min-w-0 cursor-pointer rounded-lg border px-1 font-mono text-xs font-semibold transition",
        active ? "border-gold-400 bg-gold-gradient text-onyx shadow-glow" : "border-line bg-ink-850 text-ink-200 hover:border-gold-500/40 hover:text-stone-100",
      )}
    >
      {children}
    </button>
  );
}

/** Down-payment slider (20–90 %, step 5) with quick chips, and the months selector. */
export function PlanControls({ value, onChange, idPrefix }: { value: PlanChoice; onChange: (v: PlanChoice) => void; idPrefix: string }) {
  const { t } = useI18n();
  const pct = ((value.downPercent - MIN_DOWN) / (MAX_DOWN - MIN_DOWN)) * 100;
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <label htmlFor={`${idPrefix}-down`} className="text-xs font-semibold text-ink-200">
            {t("app.finance.calc.down")}
          </label>
          <span className="font-mono text-sm font-semibold text-gold-200">{t("app.finance.calc.downPct", { p: value.downPercent })}</span>
        </div>
        <div className="relative h-6">
          <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-fg/10">
            <div className="h-full rounded-full bg-gold-gradient" style={{ width: `${pct}%` }} />
          </div>
          <input
            id={`${idPrefix}-down`}
            type="range"
            min={MIN_DOWN}
            max={MAX_DOWN}
            step={5}
            value={value.downPercent}
            onChange={(e) => onChange({ ...value, downPercent: Number(e.target.value) })}
            aria-valuetext={`${value.downPercent}%`}
            className="eka-range absolute inset-0 w-full cursor-pointer appearance-none bg-transparent"
          />
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1.5" role="radiogroup" aria-label={t("app.finance.calc.down")}>
          {DOWN_CHIPS.map((p) => (
            <Chip key={p} active={value.downPercent === p} onClick={() => onChange({ ...value, downPercent: p })}>
              {p}%
            </Chip>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-2 text-xs font-semibold text-ink-200">{t("app.finance.calc.months")}</div>
        <div className="grid grid-cols-7 gap-1.5" role="radiogroup" aria-label={t("app.finance.calc.months")}>
          {MONTHS.map((m) => (
            <Chip key={m} active={value.months === m} onClick={() => onChange({ ...value, months: m })} label={t("app.finance.calc.monthsN", { n: m })}>
              {m}
            </Chip>
          ))}
        </div>
        <div className="mt-1.5 text-[11px] text-ink-400">{t("app.finance.calc.monthsN", { n: value.months })}</div>
      </div>
      <style>{RANGE_CSS}</style>
    </div>
  );
}

const RANGE_CSS = `
.eka-range::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:22px;height:22px;border-radius:9999px;background:var(--color-gold-300);border:3px solid var(--color-ink-900);box-shadow:0 0 0 1px var(--color-gold-500),0 4px 14px -4px rgb(201 164 100/.7);cursor:grab;transition:transform .15s}
.eka-range::-webkit-slider-thumb:active{transform:scale(1.12);cursor:grabbing}
.eka-range::-moz-range-thumb{width:18px;height:18px;border-radius:9999px;background:var(--color-gold-300);border:3px solid var(--color-ink-900);box-shadow:0 0 0 1px var(--color-gold-500)}
.eka-range::-webkit-slider-runnable-track{height:24px;background:transparent}
.eka-range:focus-visible{outline:none}
.eka-range:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 4px rgb(201 164 100/.35)}
`;

/* ───────────────────────────── result ───────────────────────────── */

/** Down / monthly / count / total + a mini schedule preview. */
export function CalcResult({ calc, loading, error, currency = "UZS", compact }: { calc: InstallmentCalc | null; loading: boolean; error: boolean; currency?: string; compact?: boolean }) {
  const { t } = useI18n();
  const fmt = useFormat();
  const reduce = useReducedMotion();
  if (error && !calc) return <p className="rounded-xl border border-danger/25 bg-danger/[0.06] px-3 py-2.5 text-xs text-danger">{t("app.finance.calc.error")}</p>;
  if (!calc)
    return (
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    );
  const rows = calc.schedule;
  const preview = rows.length <= 5 ? rows : [...rows.slice(0, 3), null, rows[rows.length - 1]!];
  return (
    <div className={cn("transition-opacity", loading && "opacity-70")} aria-live="polite">
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2 rounded-xl border border-gold-500/35 bg-gradient-to-br from-gold-500/[0.12] to-transparent p-3.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">
            <Calendar size={14} variant="Bulk" className="text-gold-300" /> {t("app.finance.calc.monthly")}
          </div>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={calc.monthly}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="mt-1 font-mono text-2xl font-semibold text-stone-100"
            >
              {fmt.money(calc.monthly, currency)}
            </motion.div>
          </AnimatePresence>
          <div className="mt-0.5 text-xs text-ink-400">
            × {calc.count - 1} · {t("app.finance.calc.lastPayment", { date: fmt.date(rows[rows.length - 1]?.dueDate) })}
          </div>
        </div>
        <Cell label={t("app.finance.calc.down")} value={fmt.money(calc.down, currency)} icon={Wallet2} />
        <Cell label={t("app.finance.calc.count")} value={String(calc.count)} icon={TickCircle} />
        <Cell label={t("app.finance.calc.total")} value={fmt.money(calc.total, currency)} icon={MoneyRecive} />
        <Cell label={t("app.finance.calc.interest")} value={calc.interest ? fmt.money(calc.interest, currency) : t("app.finance.calc.noInterest")} icon={Calculator} />
      </div>
      {!compact && (
        <div className="mt-3 overflow-hidden rounded-xl border border-line">
          <div className="border-b border-line bg-fg/[0.02] px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-ink-400">{t("app.finance.calc.schedule")}</div>
          <ul className="divide-y divide-line text-xs">
            {preview.map((r, i) =>
              r ? (
                <li key={r.seq} className={cn("flex items-center gap-3 px-3 py-2", r.seq === 0 && "bg-gold-500/[0.06]")}>
                  <span className="w-5 font-mono text-ink-500">{r.seq + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-ink-200">{r.seq === 0 ? t("app.finance.calc.down") : t("app.finance.calc.monthsN", { n: r.seq })}</span>
                  <span className="hidden whitespace-nowrap text-ink-400 sm:inline">{fmt.date(r.dueDate)}</span>
                  <span className="shrink-0 whitespace-nowrap text-right font-mono font-semibold text-stone-100 sm:w-28">{fmt.compactMoney(r.amount, currency)}</span>
                </li>
              ) : (
                <li key={`gap-${i}`} className="px-3 py-1.5 text-center text-[11px] text-ink-500">
                  ⋯ {t("app.finance.calc.more", { n: rows.length - 4 })}
                </li>
              ),
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function Cell({ label, value, icon: Icon }: { label: string; value: string; icon: React.ComponentType<{ size?: number; variant?: "Bulk"; className?: string }> }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-ink-850/70 p-3">
      <div className="flex items-center gap-1.5 truncate text-[10.5px] uppercase tracking-wider text-ink-400">
        <Icon size={13} variant="Bulk" className="shrink-0 text-gold-300" /> {label}
      </div>
      <div className="mt-1 truncate font-mono text-sm font-semibold text-stone-100">{value}</div>
    </div>
  );
}

/* ───────────────────────────── plan picker (purchase dialog) ───────────────────────────── */

/** FULL vs INSTALLMENT choice; for INSTALLMENT shows the controls and the live calculation. */
export function PlanPicker({ amount, currency, value, onChange }: { amount: number; currency: string; value: PlanChoice; onChange: (v: PlanChoice) => void }) {
  const { t } = useI18n();
  const fmt = useFormat();
  const reduce = useReducedMotion();
  const calc = useInstallmentCalc(amount, value.downPercent, value.months, value.planType === "INSTALLMENT");
  const options: { v: PaymentPlanType; title: string; hint: string; icon: typeof Wallet2 }[] = [
    { v: "FULL", title: t("app.finance.plan.full"), hint: t("app.finance.plan.fullHint"), icon: Wallet2 },
    { v: "INSTALLMENT", title: t("app.finance.plan.installment"), hint: t("app.finance.plan.installmentHint", { min: MIN_DOWN, max: 60 }), icon: Calendar },
  ];
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">{t("app.finance.plan.title")}</div>
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={t("app.finance.plan.title")}>
        {options.map((o) => {
          const active = value.planType === o.v;
          return (
            <button
              key={o.v}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange({ ...value, planType: o.v })}
              className={cn(
                "relative flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-left transition",
                active ? "border-gold-400/70 bg-gold-500/[0.08] shadow-glow" : "border-line bg-ink-850 hover:border-line-strong",
              )}
            >
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg border", active ? "border-gold-500/40 bg-gold-gradient text-onyx" : "border-line bg-ink-800 text-gold-300")}>
                <o.icon size={17} variant={active ? "Bold" : "Bulk"} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-stone-100">{o.title}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-ink-400">{o.v === "FULL" ? fmt.money(amount, currency) : o.hint}</span>
                {o.v === "FULL" && <span className="block text-[11px] leading-snug text-ink-500">{o.hint}</span>}
              </span>
              <span className={cn("absolute right-3 top-3 grid size-4 place-items-center rounded-full border", active ? "border-gold-400 bg-gold-400" : "border-line-strong")}>
                {active && <span className="size-1.5 rounded-full bg-onyx" />}
              </span>
            </button>
          );
        })}
      </div>
      <AnimatePresence initial={false}>
        {value.planType === "INSTALLMENT" && (
          <motion.div
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduce ? undefined : { opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              <PlanControls value={value} onChange={onChange} idPrefix="buy" />
              <CalcResult calc={calc.data} loading={calc.loading} error={calc.error} currency={currency} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ───────────────────────────── standalone card ───────────────────────────── */

/** "Bo'lib to'lash kalkulyatori" card for the project page: editable price, plan controls, live result. */
export function InstallmentCalculatorCard({
  defaultAmount,
  currency = "UZS",
  unitHint,
  className,
}: {
  defaultAmount: number | null;
  currency?: string;
  /** where the price came from, e.g. "Tanlangan xonadon: № 47" */
  unitHint?: string | null;
  className?: string;
}) {
  const { t } = useI18n();
  const [amount, setAmount] = React.useState<number | null>(defaultAmount);
  const [plan, setPlan] = React.useState<PlanChoice>({ planType: "INSTALLMENT", downPercent: 30, months: 12 });
  React.useEffect(() => setAmount(defaultAmount), [defaultAmount]);
  const calc = useInstallmentCalc(amount, plan.downPercent, plan.months);
  return (
    <section className={cn("relative overflow-hidden rounded-3xl border border-line bg-ink-900/80 p-5 shadow-card md:p-6", className)} aria-labelledby="calc-title">
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full bg-gold-500/10 blur-3xl" />
      <header className="relative mb-5 flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gold-gradient text-onyx shadow-glow">
          <Calculator size={20} variant="Bold" />
        </span>
        <div className="min-w-0">
          <h3 id="calc-title" className="font-display text-2xl text-stone-100">
            {t("app.finance.calc.title")}
          </h3>
          <p className="mt-0.5 text-sm text-ink-400">{t("app.finance.calc.subtitle")}</p>
        </div>
      </header>
      <div className="relative grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="min-w-0 space-y-4">
          <div>
            <div className="mb-1.5 flex min-w-0 items-baseline justify-between gap-2">
              <label htmlFor="calc-amount" className="shrink-0 text-xs font-semibold text-ink-200">
                {t("app.finance.calc.amount")}
              </label>
              {unitHint && <span className="truncate text-[11px] text-gold-300">{unitHint}</span>}
            </div>
            <MoneyInput id="calc-amount" value={amount} onChange={setAmount} currency={currency} />
          </div>
          <PlanControls value={plan} onChange={setPlan} idPrefix="calc" />
        </div>
        <div>
          {amount ? <CalcResult calc={calc.data} loading={calc.loading} error={calc.error} currency={currency} /> : <Skeleton className="h-48 rounded-xl" />}
          <p className="mt-3 text-[11px] leading-relaxed text-ink-500">{t("app.finance.calc.note")}</p>
        </div>
      </div>
    </section>
  );
}
