"use client";
import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import type { Icon as IconType } from "iconsax-reactjs";
import { Call, Chart21, ClipboardText, Clock, DollarCircle, MoneyRecive, MoneyTime, PercentageSquare, Receipt2, Refresh, TickCircle, Warning2, WalletMoney } from "iconsax-reactjs";
import { ChartPaletteStyle, Sparkline } from "@/components/admin/charts";
import { useFormat } from "@/components/admin/format";
import { useApi } from "@/components/admin/hooks";
import { Avatar, ErrorNotice } from "@/components/admin/primitives";
import { Button } from "@/components/ui/button";
import { formatMasked } from "@/components/ui/masked-input";
import { EmptyState } from "@/components/ui/misc";
import { CountUp } from "@/components/ui/reveal";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n/client";
import type { DuePayment, FinanceSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { apiBase, dealHref, type Area } from "./area";
import { CashflowChart, PlanDonut, ProjectFinanceBars } from "./charts";
import { ExportCenter } from "./ExportButton";
import { PaymentsTable } from "./PaymentsTable";
import { Block, ControlHeader, DaysBadge, useSeqLabel } from "./ui";

const EASE = [0.16, 1, 0.3, 1] as const;

/** Finance control centre: KPIs, cash-flow, plan split, per-project receivables, overdue / upcoming, payments registry. */
export function FinanceView({ area }: { area: Area }) {
  const { t } = useI18n();
  const f = useFormat();
  const fin = useApi<FinanceSummary>(`${apiBase(area)}/finance`);
  const [loadedAt, setLoadedAt] = React.useState<Date | null>(null);
  React.useEffect(() => {
    if (fin.data) setLoadedAt(new Date());
  }, [fin.data]);

  const d = fin.data;
  const reloadAll = () => fin.reload();

  return (
    <div className="min-w-0">
      <ChartPaletteStyle />
      <ControlHeader
        area={area}
        icon={MoneyRecive}
        title={t("admin.control.finance.title")}
        description={area === "admin" ? t("admin.control.finance.description") : t("admin.control.finance.descriptionDev")}
        actions={
          <>
            {loadedAt && <span className="hidden text-xs text-ink-400 lg:inline">{t("admin.control.updatedAt", { time: f.time(loadedAt) })}</span>}
            <ExportCenter area={area} />
            <Button variant="secondary" size="sm" onClick={reloadAll} loading={fin.loading && Boolean(d)}>
              {!(fin.loading && d) && <Refresh />} {t("admin.control.refresh")}
            </Button>
          </>
        }
      />

      <ErrorNotice error={fin.error} onRetry={fin.reload} />

      <KpiRow data={d ?? null} dim={Boolean(fin.error)} />

      <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-3">
        <Block icon={Chart21} title={t("admin.control.finance.cash.title")} subtitle={t("admin.control.finance.cash.subtitle")} className="xl:col-span-2">
          {!d ? <ChartSkeleton /> : d.monthly.length ? <CashflowChart data={d.monthly} /> : <NoData />}
        </Block>
        <Block icon={PercentageSquare} title={t("admin.control.finance.plan.title")} subtitle={t("admin.control.finance.plan.subtitle")}>
          {!d ? <Skeleton className="mx-auto size-44 rounded-full" /> : d.byPlan.length ? <PlanDonut data={d.byPlan} /> : <NoData />}
        </Block>
      </div>

      <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
        <DueList
          area={area}
          tone="danger"
          icon={Warning2}
          title={t("admin.control.finance.overdueList.title")}
          subtitle={t("admin.control.finance.overdueList.subtitle")}
          items={d?.overdue ?? null}
          empty={t("admin.control.finance.overdueList.empty")}
          emptyHint={t("admin.control.finance.overdueList.emptyHint")}
          count={d?.totals.overdueCount}
        />
        <DueList
          area={area}
          tone="info"
          icon={Clock}
          title={t("admin.control.finance.upcoming.title")}
          subtitle={t("admin.control.finance.upcoming.subtitle")}
          items={d?.upcoming ?? null}
          empty={t("admin.control.finance.upcoming.empty")}
          emptyHint={t("admin.control.finance.upcoming.emptyHint")}
        />
      </div>

      <Block icon={ClipboardText} title={t("admin.control.finance.projects.title")} subtitle={t("admin.control.finance.projects.subtitle")} className="mt-4">
        {!d ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : d.byProject.length ? (
          <ProjectFinanceBars data={d.byProject} hrefFor={(id) => (area === "dev" ? `/app/developer/projects/${id}` : null)} />
        ) : (
          <EmptyState icon={ClipboardText} title={t("admin.control.finance.projects.empty")} className="border-0 py-10" />
        )}
      </Block>

      <section className="mt-8 min-w-0" id="payments">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base font-semibold text-stone-100">
              <WalletMoney size={18} variant="Bulk" className="text-gold-300" /> {t("admin.control.payments.title")}
            </h2>
            <p className="text-sm text-ink-400">{t("admin.control.payments.subtitle")}</p>
          </div>
        </div>
        <PaymentsTable area={area} onChanged={fin.reload} />
      </section>
    </div>
  );
}

/* ───────────────────────────── KPI tiles ───────────────────────────── */

function KpiRow({ data, dim }: { data: FinanceSummary | null; dim?: boolean }) {
  const { t } = useI18n();
  const f = useFormat();
  const reduce = useReducedMotion();
  if (!data)
    return (
      <div className={cn("grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-5", dim && "opacity-50")}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={cn("rounded-2xl border border-line bg-ink-900 p-5", i === 0 && "col-span-2 xl:col-span-1")}>
            <div className="flex items-start justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="size-9 rounded-xl" />
            </div>
            <Skeleton className="mt-4 h-8 w-28" />
            <Skeleton className="mt-4 h-8 w-full" />
          </div>
        ))}
      </div>
    );

  const k = data.totals;
  const now = new Date();
  const nowKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const past = data.monthly.filter((m) => m.month <= nowKey);
  const tiles: {
    key: string;
    label: string;
    value: React.ReactNode;
    hint: React.ReactNode;
    icon: IconType;
    tone?: "gold" | "danger" | "success";
    foot?: React.ReactNode;
    hero?: boolean;
  }[] = [
    {
      key: "contracted",
      label: t("admin.control.finance.kpi.contracted"),
      value: f.compactMoney(k.contracted),
      hint: t("admin.control.finance.kpi.contractedHint", { n: f.number(k.deals) }),
      icon: Receipt2,
      hero: true,
      foot: <Sparkline values={past.map((m) => m.scheduled)} color="var(--chart-2)" height={34} />,
    },
    {
      key: "collected",
      label: t("admin.control.finance.kpi.collected"),
      value: f.compactMoney(k.collected),
      hint: t("admin.control.finance.kpi.collectedHint"),
      icon: DollarCircle,
      tone: "success",
      foot: <Sparkline values={past.map((m) => m.collected)} height={34} />,
    },
    {
      key: "receivable",
      label: t("admin.control.finance.kpi.receivable"),
      value: f.compactMoney(k.receivable),
      hint: t("admin.control.finance.kpi.receivableHint", { n: f.number(k.pendingCount) }),
      icon: MoneyTime,
      foot: <Meter value={k.contracted ? (k.receivable / k.contracted) * 100 : 0} tone="gold" />,
    },
    {
      key: "overdue",
      label: t("admin.control.finance.kpi.overdue"),
      value: f.compactMoney(k.overdue),
      hint: k.overdueCount ? t("admin.control.finance.kpi.overdueHint", { n: k.overdueCount }) : t("admin.control.finance.kpi.overdueNone"),
      icon: Warning2,
      tone: k.overdueCount ? "danger" : "success",
      foot: <Meter value={k.receivable ? (k.overdue / k.receivable) * 100 : 0} tone="danger" />,
    },
    {
      key: "rate",
      label: t("admin.control.finance.kpi.rate"),
      value: (
        <>
          <CountUp value={Math.round(k.collectionRate * 10) / 10} format={(n) => n.toFixed(1)} />
          <span className="ml-0.5 text-lg text-ink-400">%</span>
        </>
      ),
      hint: t("admin.control.finance.kpi.rateHint"),
      icon: TickCircle,
      tone: k.collectionRate >= 80 ? "success" : "gold",
      foot: <Meter value={k.collectionRate} tone={k.collectionRate >= 80 ? "success" : "gold"} />,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-5">
      {tiles.map((tile, i) => (
        <motion.div
          key={tile.key}
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: i * 0.05, ease: EASE }}
          className={cn(tile.hero && "col-span-2 xl:col-span-1")}
        >
          <article
            className={cn(
              "group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-ink-900 p-4 shadow-card transition duration-300 hover:-translate-y-0.5 hover:border-line-strong md:p-5",
              tile.tone === "danger" ? "border-danger/25 bg-gradient-to-br from-danger/[0.07] via-ink-900 to-ink-900" : tile.hero ? "border-gold-500/25 bg-gradient-to-br from-gold-500/[0.08] via-ink-900 to-ink-900" : "border-line",
            )}
          >
            <div className="pointer-events-none absolute -right-12 -top-12 size-36 rounded-full bg-gold-500/5 blur-2xl transition group-hover:bg-gold-500/10" />
            <div className="relative flex items-start justify-between gap-3">
              <span className="text-[11px] font-semibold uppercase leading-snug tracking-[0.12em] text-ink-400">{tile.label}</span>
              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-xl border",
                  tile.tone === "danger" ? "border-danger/30 bg-danger/10 text-danger" : tile.tone === "success" ? "border-success/25 bg-success/10 text-success" : "border-gold-500/20 bg-gold-500/10 text-gold-300",
                )}
              >
                <tile.icon size={17} variant="Bulk" />
              </span>
            </div>
            <div className={cn("relative mt-2 whitespace-nowrap font-mono text-[22px] font-semibold tracking-tight md:text-[26px]", tile.tone === "danger" ? "text-danger" : "text-stone-100")}>
              {tile.value}
            </div>
            <div className="relative mt-1 text-xs text-ink-400">{tile.hint}</div>
            <div className="relative mt-auto pt-3">{tile.foot}</div>
          </article>
        </motion.div>
      ))}
    </div>
  );
}

function Meter({ value, tone }: { value: number; tone: "gold" | "danger" | "success" }) {
  const reduce = useReducedMotion();
  const v = Math.max(0, Math.min(100, value));
  const bar = tone === "danger" ? "bg-danger" : tone === "success" ? "bg-success" : "bg-gold-gradient";
  return (
    <div className="flex items-center gap-2" aria-hidden>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fg/8">
        <motion.div className={cn("h-full rounded-full", bar)} initial={reduce ? false : { width: 0 }} animate={{ width: `${v}%` }} transition={{ duration: 1.1, ease: EASE }} />
      </div>
      <span className="w-10 text-right font-mono text-[10.5px] text-ink-400">{v.toFixed(v < 10 ? 1 : 0)}%</span>
    </div>
  );
}

/* ───────────────────────────── due lists ───────────────────────────── */

function DueList({
  area,
  tone,
  icon,
  title,
  subtitle,
  items,
  empty,
  emptyHint,
  count,
}: {
  area: Area;
  tone: "danger" | "info";
  icon: IconType;
  title: string;
  subtitle: string;
  items: DuePayment[] | null;
  empty: string;
  emptyHint: string;
  count?: number;
}) {
  const { t, tr } = useI18n();
  const f = useFormat();
  const seqLabel = useSeqLabel();
  const reduce = useReducedMotion();
  const total = items?.reduce((s, p) => s + Number(p.amount), 0) ?? 0;
  return (
    <Block
      icon={icon}
      tone={tone}
      title={
        <span className="flex items-center gap-2">
          {title}
          {items && items.length > 0 && (
            <span className={cn("rounded-full px-1.5 py-px font-mono text-[10px]", tone === "danger" ? "bg-danger/15 text-danger" : "bg-info/15 text-info")}>{count ?? items.length}</span>
          )}
        </span>
      }
      subtitle={subtitle}
      action={items && items.length > 0 ? <span className="font-mono text-xs font-semibold text-stone-100">{f.compactMoney(total)}</span> : null}
      bodyClassName="p-2 sm:p-2"
    >
      {!items ? (
        <div className="space-y-2 p-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center px-4 py-10 text-center">
          <span className="grid size-11 place-items-center rounded-2xl border border-success/25 bg-success/10 text-success">
            <TickCircle size={20} variant="Bulk" />
          </span>
          <div className="mt-3 text-sm font-semibold text-stone-100">{empty}</div>
          <div className="mt-1 max-w-xs text-xs text-ink-400">{emptyHint}</div>
        </div>
      ) : (
        <ul className="max-h-[420px] overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin]">
          {items.map((p, i) => (
            <motion.li
              key={p.id}
              initial={reduce ? false : { opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i, 10) * 0.03, duration: 0.35 }}
              className="group flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition hover:bg-fg/[0.035]"
            >
              <Avatar name={p.purchase.buyerName} size={34} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-stone-100">{p.purchase.buyerName}</span>
                </div>
                <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-ink-400">
                  <Link href={dealHref(area, p.purchase)} className="shrink-0 font-mono text-gold-200 transition hover:text-gold-100 hover:underline">
                    {p.purchase.number}
                  </Link>
                  <span aria-hidden>·</span>
                  <span className="truncate">{tr(p.purchase.projectName)}</span>
                </div>
                <a href={`tel:${p.purchase.buyerPhone}`} className="mt-0.5 inline-flex max-w-full items-center gap-1 whitespace-nowrap font-mono text-[11px] text-ink-300 transition hover:text-gold-300">
                  <Call size={11} variant="Bulk" /> {formatMasked("phone", p.purchase.buyerPhone)}
                </a>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className={cn("font-mono text-sm font-semibold", tone === "danger" ? "text-danger" : "text-stone-100")}>{f.compactMoney(p.amount)}</span>
                <DaysBadge days={p.daysLeft} />
                <span className="hidden text-[10.5px] text-ink-500 sm:block">{seqLabel(p.seq)}</span>
              </div>
            </motion.li>
          ))}
        </ul>
      )}
      {items && items.length > 0 && (
        <div className="px-2.5 pb-1 pt-2 text-right">
          <Link href={`?status=${tone === "danger" ? "OVERDUE" : "PENDING"}#payments`} className="text-xs font-semibold text-ink-300 transition hover:text-gold-300">
            {t("admin.control.payments.title")} →
          </Link>
        </div>
      )}
    </Block>
  );
}

function ChartSkeleton() {
  return (
    <div className="flex h-[300px] items-end gap-2">
      {[35, 52, 44, 68, 58, 74, 62, 80, 70, 88, 76, 92, 40, 36, 30, 28, 22, 18].map((h, i) => (
        <div key={i} className="flex-1" style={{ height: `${h}%` }}>
          <Skeleton className="h-full w-full rounded-md" />
        </div>
      ))}
    </div>
  );
}

function NoData() {
  const { t } = useI18n();
  return <EmptyState icon={Chart21} title={t("admin.control.finance.noData")} className="border-0 py-10" />;
}
