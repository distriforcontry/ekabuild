"use client";
import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  Activity,
  ArrowRight,
  Bag2,
  Buildings,
  Buildings2,
  DocumentText,
  Folder2,
  FolderOpen,
  Heart,
  PenTool,
  Star1,
  TickCircle,
  Verify,
  Wallet2,
  Wallet3,
} from "iconsax-reactjs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMasked } from "@/components/ui/masked-input";
import { StatusBadge } from "@/components/ui/status-badge";
import { useI18n } from "@/i18n/client";
import { api } from "@/lib/api";
import type { ContractDetail, ProgressItem, ProjectCard, PurchaseItem } from "@/lib/types";
import type { DocumentItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useCabinetUser } from "../CabinetContext";
import { asList, useApi } from "../hooks";
import { useFmt } from "../format";
import { AnimatedNumber, Kpi, Panel, PanelEmpty, SeeAll } from "../kit";
import { ProjectMiniCard } from "../ProjectMiniCard";
import { CardGridSkeleton, ErrorState, ListSkeleton, StatCardsSkeleton } from "../states";
import { ProjectCover } from "../ui";
import { JourneyStepper } from "./JourneyStepper";

export type FeedItem = ProgressItem & { project: { slug: string; name: string } };
export type MyFilesGroup = { project: { slug: string; name: string }; documents: DocumentItem[] };

function greetingKey(h: number) {
  if (h < 5) return "night" as const;
  if (h < 12) return "morning" as const;
  if (h < 18) return "day" as const;
  return "evening" as const;
}

const ACTIVE: PurchaseItem["status"][] = ["DRAFT", "PENDING_SIGNATURES", "SIGNED"];
const PAID: PurchaseItem["status"][] = ["PAID", "COMPLETED"];

export function DashboardView() {
  const { t } = useI18n();
  const { user } = useCabinetUser();
  const purchases = useApi<PurchaseItem[]>("/purchases", undefined, { select: asList });
  const favorites = useApi<ProjectCard[]>("/favorites", undefined, { select: asList });
  const files = useApi<MyFilesGroup[]>("/me/files", undefined, { select: asList });
  const feed = useApi<FeedItem[]>("/me/feed", undefined, { select: asList });
  const recommended = useApi<ProjectCard[]>("/projects", { sort: "trust", pageSize: 4 }, { select: asList });
  const org = user.organization;

  // contracts that need *my* signature (ask the API — it knows which side I sign for)
  const [toSign, setToSign] = React.useState<Set<string>>(new Set());
  React.useEffect(() => {
    const candidates = (purchases.data ?? []).filter((p) => p.contract && (p.contract.status === "PENDING" || p.contract.status === "PARTIALLY_SIGNED")).slice(0, 8);
    if (!candidates.length) {
      setToSign(new Set());
      return;
    }
    let alive = true;
    Promise.all(
      candidates.map((p) =>
        api
          .get<ContractDetail>(`/contracts/${p.contract!.id}`)
          .then((c) => (c.canSign ? p.id : null))
          .catch(() => (p.contract!.status === "PENDING" ? p.id : null)),
      ),
    ).then((res) => alive && setToSign(new Set(res.filter((x): x is string => Boolean(x)))));
    return () => {
      alive = false;
    };
  }, [purchases.data]);

  const list = React.useMemo(() => [...(purchases.data ?? [])].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)), [purchases.data]);
  const live = list.filter((p) => p.status !== "CANCELLED");
  const signed = list.filter((p) => p.contract?.status === "SIGNED").length;
  const filesCount = (files.data ?? []).reduce((s, g) => s + g.documents.filter((d) => !d.locked).length, 0);
  const statsLoading = purchases.loading || favorites.loading || files.loading;
  const signList = list.filter((p) => toSign.has(p.id));
  const payList = list.filter((p) => p.status === "SIGNED");

  return (
    <div className="space-y-6 md:space-y-8">
      <Hero purchases={live} loading={purchases.loading} />

      {/* KPIs */}
      {statsLoading ? (
        <StatCardsSkeleton />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
          <Kpi
            index={0}
            href="/app/purchases"
            label={t("app.dashboard.stats.purchases")}
            value={<AnimatedNumber value={list.length} duration={1} />}
            hint={t("app.dashboard.stats.activeHint", { n: list.filter((p) => ACTIVE.includes(p.status)).length })}
            icon={Bag2}
          />
          <Kpi
            index={1}
            href="/app/contracts"
            label={t("app.dashboard.stats.contracts")}
            value={<AnimatedNumber value={signed} duration={1} />}
            hint={t("app.dashboard.stats.contractsHint")}
            icon={DocumentText}
            accent={toSign.size > 0}
          />
          <Kpi
            index={2}
            href="/app/files"
            label={t("app.dashboard.stats.files")}
            value={<AnimatedNumber value={filesCount} duration={1} />}
            hint={t("app.dashboard.stats.filesHint")}
            icon={Folder2}
            accent={Boolean(org) && filesCount > 0}
          />
          <Kpi
            index={3}
            href="/app/favorites"
            label={t("app.dashboard.stats.favorites")}
            value={<AnimatedNumber value={(favorites.data ?? []).length} duration={1} />}
            hint={t("app.dashboard.stats.favoritesHint")}
            icon={Heart}
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] xl:gap-8">
        <div className="min-w-0 space-y-6">
          {org && <DocumentsPanel groups={files.data ?? []} loading={files.loading} error={files.error} onRetry={files.reload} emphasis />}

          {/* purchases with their journey */}
          <Panel
            icon={Bag2}
            title={t("app.dashboard.purchases.title")}
            subtitle={t("app.dashboard.purchases.subtitle")}
            action={list.length > 0 ? <SeeAll href="/app/purchases">{t("common.actions.seeAll")}</SeeAll> : undefined}
          >
            {purchases.loading ? (
              <ListSkeleton rows={2} />
            ) : purchases.error ? (
              <ErrorState error={purchases.error} onRetry={purchases.reload} compact />
            ) : list.length === 0 ? (
              <PanelEmpty
                icon={Bag2}
                title={t("app.dashboard.recent.empty")}
                hint={t("app.dashboard.recent.emptyHint")}
                action={
                  <Button asChild variant="gold" size="sm">
                    <Link href="/projects">
                      <Buildings size={16} variant="Bulk" /> {t("app.dashboard.browse")}
                    </Link>
                  </Button>
                }
              />
            ) : (
              <ul className="space-y-4">
                {list.slice(0, 3).map((p, i) => (
                  <PurchaseCard key={p.id} purchase={p} index={i} needsSignature={toSign.has(p.id)} />
                ))}
              </ul>
            )}
          </Panel>
          {!org && <DocumentsPanel groups={files.data ?? []} loading={files.loading} error={files.error} onRetry={files.reload} />}
        </div>

        <div className="min-w-0 space-y-6">
          <NextActions loading={purchases.loading} sign={signList} pay={payList} />
          <FeedPanel feed={feed.data ?? []} loading={feed.loading} error={feed.error} onRetry={feed.reload} />
        </div>
      </div>

      {/* recommended */}
      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-gold-400">
              <Star1 size={13} variant="Bold" /> {t("app.dashboard.recommended.eyebrow")}
            </div>
            <h2 className="font-display text-2xl font-medium text-stone-100 md:text-[28px]">{t("app.dashboard.recommended.title")}</h2>
            <p className="mt-0.5 text-sm text-ink-400">{t("app.dashboard.recommended.subtitle")}</p>
          </div>
          <SeeAll href="/projects">{t("common.actions.seeAll")}</SeeAll>
        </div>
        {recommended.loading ? (
          <CardGridSkeleton count={4} className="sm:grid-cols-2 xl:grid-cols-4" />
        ) : recommended.error ? (
          <ErrorState error={recommended.error} onRetry={recommended.reload} compact />
        ) : !(recommended.data ?? []).length ? (
          <PanelEmpty icon={Buildings} title={t("app.dashboard.recommended.empty")} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {(recommended.data ?? []).slice(0, 4).map((p, i) => (
              <ProjectMiniCard key={p.id} project={p} index={i} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ───────────── hero: greeting + portfolio summary ─────────────

function Hero({ purchases, loading }: { purchases: PurchaseItem[]; loading: boolean }) {
  const { t, label, tr } = useI18n();
  const fmt = useFmt();
  const { user } = useCabinetUser();
  const [hour, setHour] = React.useState<number | null>(null);
  React.useEffect(() => setHour(new Date().getHours()), []);
  const org = user.organization;

  const total = purchases.reduce((s, p) => s + Number(p.amount || 0), 0);
  const paid = purchases.filter((p) => PAID.includes(p.status)).reduce((s, p) => s + Number(p.amount || 0), 0);
  const pending = total - paid;
  const paidShare = total ? paid / total : 0;
  const objects = new Set(purchases.map((p) => p.project.id)).size;

  return (
    <section className="relative overflow-hidden rounded-3xl border border-line bg-ink-900/80 shadow-card">
      <div aria-hidden className="bg-blueprint pointer-events-none absolute inset-0 opacity-70 [mask-image:linear-gradient(to_left,black,transparent_75%)]" />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-28 size-96 rounded-full bg-gold-500/15 blur-[100px]"
        animate={{ scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="relative grid gap-8 p-6 md:p-9 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-center">
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.26em] text-gold-400">
            <span aria-hidden className="h-px w-7 bg-gradient-to-r from-gold-500/0 to-gold-500" />
            {hour === null ? " " : t(`app.dashboard.greeting.${greetingKey(hour)}`)}
          </div>
          <h1 className="text-balance bg-gradient-to-br from-stone-100 from-50% to-gold-200 bg-clip-text pb-1 font-display text-4xl font-medium leading-[1.05] text-transparent md:text-[52px]">
            {user.fullName}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge tone="gold">{label("role", user.role)}</Badge>
            {org ? (
              <Badge tone={org.status === "VERIFIED" ? "success" : org.status === "REJECTED" ? "danger" : "warning"}>
                <Verify variant="Bold" /> {tr(org.name)}
              </Badge>
            ) : (
              <Badge>{t("app.dashboard.individual")}</Badge>
            )}
            {org && <span className="font-mono text-[11px] text-ink-400">STIR {formatMasked("tin", org.tin)}</span>}
          </div>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-300 md:text-[15px]">{org ? t("app.dashboard.heroSubtitleOrg") : t("app.dashboard.heroSubtitle")}</p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Button asChild variant="gold">
              <Link href="/projects">
                <Buildings size={18} variant="Bulk" /> {t("app.dashboard.browse")}
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={org ? "/app/files" : "/app/contracts"}>
                {org ? <FolderOpen size={18} variant="Bulk" className="text-gold-300" /> : <DocumentText size={18} variant="Bulk" className="text-gold-300" />}
                {org ? t("app.dashboard.documents.open") : t("app.shell.nav.contracts")}
              </Link>
            </Button>
          </div>
        </div>

        {/* portfolio */}
        <div className="glass relative overflow-hidden rounded-2xl p-5 shadow-card md:p-6">
          <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-400/60 to-transparent" />
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-400">{t("app.dashboard.portfolio.title")}</span>
            <span className="grid size-9 place-items-center rounded-xl border border-gold-500/25 bg-gold-500/10 text-gold-300">
              <Wallet3 size={18} variant="Bulk" />
            </span>
          </div>
          {loading ? (
            <div className="mt-4 space-y-3">
              <div className="skeleton h-9 w-48 rounded-lg" />
              <div className="skeleton h-2 w-full rounded-full" />
              <div className="skeleton h-4 w-40 rounded" />
            </div>
          ) : (
            <>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-mono text-[32px] font-semibold leading-none tracking-tight text-stone-100 md:text-[36px]">
                  <AnimatedNumber value={total} duration={1.4} format={(n) => fmt.compact(Math.round(n))} />
                </span>
              </div>
              <div className="mt-1.5 text-xs text-ink-400">
                {purchases.length ? t("app.dashboard.portfolio.objects", { n: objects, p: purchases.length }) : t("app.dashboard.portfolio.empty")}
              </div>
              <div className="mt-5 flex h-2 overflow-hidden rounded-full bg-fg/8" role="img" aria-label={`${t("app.dashboard.portfolio.paid")}: ${Math.round(paidShare * 100)}%`}>
                <motion.span
                  className="h-full rounded-full bg-gold-gradient"
                  initial={{ width: 0 }}
                  animate={{ width: `${paidShare * 100}%` }}
                  transition={{ duration: 1.3, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                />
                {pending > 0 && <span className="ml-0.5 h-full flex-1 rounded-full bg-[repeating-linear-gradient(135deg,var(--color-gold-700)_0_4px,transparent_4px_8px)] opacity-60" />}
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-line bg-ink-850/50 px-3 py-2.5">
                  <dt className="flex items-center gap-1.5 text-ink-400">
                    <span className="size-2 rounded-full bg-gold-400" /> {t("app.dashboard.portfolio.paid")}
                  </dt>
                  <dd className="mt-1 font-mono text-sm font-semibold text-stone-100">{fmt.compact(paid)}</dd>
                </div>
                <div className="rounded-xl border border-line bg-ink-850/50 px-3 py-2.5">
                  <dt className="flex items-center gap-1.5 text-ink-400">
                    <span className="size-2 rounded-full bg-[repeating-linear-gradient(135deg,var(--color-gold-600)_0_2px,transparent_2px_4px)] ring-1 ring-gold-600/60" /> {t("app.dashboard.portfolio.inProgress")}
                  </dt>
                  <dd className="mt-1 font-mono text-sm font-semibold text-stone-100">{fmt.compact(pending)}</dd>
                </div>
              </dl>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

// ───────────── purchase card with journey ─────────────

function PurchaseCard({ purchase: p, index, needsSignature }: { purchase: PurchaseItem; index: number; needsSignature: boolean }) {
  const { t, label, tr } = useI18n();
  const fmt = useFmt();
  const cta = needsSignature
    ? { href: `/app/contracts/${p.contract!.id}`, label: t("app.dashboard.cta.sign"), icon: PenTool, variant: "gold" as const }
    : p.status === "SIGNED"
      ? { href: `/app/purchases/${p.id}`, label: t("app.dashboard.cta.pay"), icon: Wallet2, variant: "gold" as const }
      : { href: `/app/purchases/${p.id}`, label: t("app.dashboard.cta.open"), icon: ArrowRight, variant: "secondary" as const };
  const CtaIcon = cta.icon;
  return (
    <motion.li
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 + index * 0.08, ease: [0.16, 1, 0.3, 1] }}
      className="group grid overflow-hidden rounded-2xl border border-line bg-ink-850/40 transition-all duration-300 hover:border-gold-500/25 hover:shadow-lift sm:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[230px_minmax(0,1fr)]"
    >
      <Link href={`/app/purchases/${p.id}`} className="relative block aspect-[16/9] overflow-hidden sm:aspect-auto sm:min-h-full" tabIndex={-1} aria-hidden>
        <div className="size-full transition-transform duration-700 ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-[1.05]">
          <ProjectCover src={p.project.coverUrl} alt={tr(p.project.name)} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-onyx/70 via-onyx/10 to-transparent sm:bg-gradient-to-r sm:from-transparent sm:via-transparent sm:to-ink-950/20" />
        <span className="absolute left-3 top-3 rounded-full border border-fg/10 bg-ink-950/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink-200 backdrop-blur">
          {label("purchaseKind", p.kind)}
        </span>
      </Link>
      <div className="flex min-w-0 flex-col gap-5 p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-mono text-[11px] text-ink-400">{p.number}</div>
            <Link href={`/app/purchases/${p.id}`} className="mt-0.5 block truncate text-base font-semibold text-stone-100 transition hover:text-gold-300">
              {tr(p.project.name)}
            </Link>
            <div className="mt-0.5 truncate text-xs text-ink-400">
              {p.unit
                ? `${t("app.common.unitShort", { section: p.unit.section, floor: p.unit.floor, number: p.unit.number })} · ${fmt.area(p.unit.area)}`
                : t("app.purchases.package")}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-mono text-[15px] font-semibold text-stone-100">{fmt.compact(p.amount)}</div>
            <StatusBadge kind="purchaseStatus" value={p.status} className="mt-1" />
          </div>
        </div>
        <JourneyStepper status={p.status} kind={p.kind} hasContract={Boolean(p.contract)} />
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="min-w-0 flex-1 text-xs leading-relaxed text-ink-300">{needsSignature ? t("app.dashboard.actions.signHint") : t(`app.purchases.detail.next.${p.status}`)}</p>
          <Button asChild size="sm" variant={cta.variant}>
            <Link href={cta.href}>
              <CtaIcon size={14} variant={cta.variant === "gold" ? "Bold" : "Linear"} /> {cta.label}
            </Link>
          </Button>
        </div>
      </div>
    </motion.li>
  );
}

// ───────────── next actions ─────────────

function NextActions({ loading, sign, pay }: { loading: boolean; sign: PurchaseItem[]; pay: PurchaseItem[] }) {
  const { t, tr } = useI18n();
  const fmt = useFmt();
  const count = sign.length + pay.length;
  return (
    <Panel
      icon={TickCircle}
      title={t("app.dashboard.actions.title")}
      subtitle={t("app.dashboard.actions.subtitle")}
      action={count > 0 ? <span className="grid h-6 min-w-6 place-items-center rounded-full bg-gold-gradient px-2 font-mono text-[11px] font-bold text-onyx">{count}</span> : undefined}
      className={cn(count > 0 && "border-gold-500/25")}
    >
      {count > 0 && <div aria-hidden className="pointer-events-none absolute -right-12 -top-12 size-44 rounded-full bg-gold-500/15 blur-3xl" />}
      {loading ? (
        <ListSkeleton rows={2} />
      ) : count === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-success/20 bg-success/[0.06] p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-success/15 text-success">
            <TickCircle size={22} variant="Bulk" />
          </span>
          <div>
            <div className="text-sm font-semibold text-stone-100">{t("app.dashboard.actions.empty")}</div>
            <div className="text-xs text-ink-400">{t("app.dashboard.actions.emptyHint")}</div>
          </div>
        </div>
      ) : (
        <ul className="relative space-y-2">
          {sign.map((p) => (
            <ActionRow
              key={`s-${p.id}`}
              href={`/app/contracts/${p.contract!.id}`}
              kind="sign"
              title={t("app.dashboard.actions.sign")}
              text={`${p.contract!.number} · ${tr(p.project.name)}`}
              cta={t("app.dashboard.cta.sign")}
            />
          ))}
          {pay.map((p) => (
            <ActionRow
              key={`p-${p.id}`}
              href={`/app/purchases/${p.id}`}
              kind="pay"
              title={t("app.dashboard.actions.pay")}
              text={`${fmt.money(p.amount, p.currency)} · ${tr(p.project.name)}`}
              cta={t("app.dashboard.cta.pay")}
            />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function ActionRow({ href, kind, title, text, cta }: { href: string; kind: "sign" | "pay"; title: string; text: string; cta: string }) {
  const Icon = kind === "sign" ? PenTool : Wallet2;
  return (
    <li>
      <Link
        href={href}
        className="group flex items-center gap-3 rounded-xl border border-line bg-ink-850/60 p-3 transition hover:-translate-y-0.5 hover:border-gold-500/40 hover:bg-gold-500/[0.04]"
      >
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-xl",
            kind === "sign" ? "bg-gold-gradient text-onyx shadow-glow" : "border border-info/30 bg-info/10 text-info",
          )}
        >
          <Icon size={18} variant="Bold" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-stone-100">{title}</span>
          <span className="block truncate text-xs text-ink-400">{text}</span>
        </span>
        <span className="shrink-0 rounded-lg border border-gold-500/30 px-2 py-1 text-[11px] font-semibold text-gold-300 transition group-hover:bg-gold-500/10">{cta}</span>
      </Link>
    </li>
  );
}

// ───────────── feed with images ─────────────

function FeedPanel({ feed, loading, error, onRetry }: { feed: FeedItem[]; loading: boolean; error: unknown; onRetry: () => void }) {
  const { t, label, tr } = useI18n();
  const fmt = useFmt();
  const items = [...feed].sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 4);
  const imageOf = (f: FeedItem) => f.media?.find((m) => m.mime.startsWith("image/"));
  const featured = items.find((f) => imageOf(f));
  const rest = items.filter((f) => f !== featured).slice(0, 3);
  return (
    <Panel icon={Activity} title={t("app.dashboard.feed.title")} action={feed.length > 0 ? <SeeAll href="/app/feed">{t("common.actions.seeAll")}</SeeAll> : undefined}>
      {loading ? (
        <ListSkeleton rows={3} />
      ) : error ? (
        <ErrorState error={error} onRetry={onRetry} compact />
      ) : !items.length ? (
        <PanelEmpty icon={Activity} title={t("app.dashboard.feed.empty")} hint={t("app.dashboard.feed.emptyHint")} className="py-8" />
      ) : (
        <div className="space-y-4">
          {featured && (
            <Link href="/app/feed" className="group relative block aspect-[16/10] overflow-hidden rounded-xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageOf(featured)!.url} alt={tr(featured.title)} loading="lazy" className="size-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-onyx/90 via-onyx/30 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-gold-200">
                  <span className={cn("size-1.5 rounded-full", featured.phase === "POST_HANDOVER" ? "bg-info" : "bg-gold-300")} />
                  {label("progressPhase", featured.phase)} · {fmt.short(featured.date)}
                </div>
                <div className="mt-1 line-clamp-2 text-sm font-semibold text-[#f4f1ea]">{tr(featured.title)}</div>
                <div className="mt-0.5 truncate text-xs text-[#c4c7ce]">{tr(featured.project.name)}</div>
              </div>
              {featured.percent != null && (
                <span className="absolute right-3 top-3 rounded-full bg-onyx/70 px-2 py-0.5 font-mono text-[11px] font-semibold text-gold-200 backdrop-blur">{featured.percent}%</span>
              )}
            </Link>
          )}
          <ol className="space-y-1">
            {rest.map((f) => {
              const img = imageOf(f);
              return (
                <li key={f.id}>
                  <Link href={`/projects/${f.project.slug}`} className="flex items-center gap-3 rounded-xl p-1.5 transition hover:bg-fg/[0.04]">
                    <span className="relative size-11 shrink-0 overflow-hidden rounded-lg border border-line bg-ink-850">
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img.url} alt="" loading="lazy" className="size-full object-cover" />
                      ) : (
                        <span className={cn("grid size-full place-items-center", f.phase === "POST_HANDOVER" ? "text-info" : "text-gold-300")}>
                          <Activity size={18} variant="Bulk" />
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-stone-100">{tr(f.title)}</span>
                      <span className="block truncate text-[11px] text-ink-400">
                        {fmt.short(f.date)} · {tr(f.project.name)}
                      </span>
                    </span>
                    {f.percent != null && <span className="shrink-0 font-mono text-[11px] text-gold-300">{f.percent}%</span>}
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </Panel>
  );
}

// ───────────── unlocked document packages ─────────────

function DocumentsPanel({ groups, loading, error, onRetry, emphasis }: { groups: MyFilesGroup[]; loading: boolean; error: unknown; onRetry: () => void; emphasis?: boolean }) {
  const { t, tr } = useI18n();
  const shown = groups.filter((g) => g.documents.length > 0).slice(0, 4);
  return (
    <Panel
      icon={FolderOpen}
      title={t("app.dashboard.documents.title")}
      subtitle={emphasis ? t("app.dashboard.documents.subtitleOrg") : t("app.dashboard.documents.subtitle")}
      action={shown.length > 0 ? <SeeAll href="/app/files">{t("app.dashboard.documents.open")}</SeeAll> : undefined}
      className={cn(emphasis && "border-gold-500/20")}
    >
      {loading ? (
        <ListSkeleton rows={2} />
      ) : error ? (
        <ErrorState error={error} onRetry={onRetry} compact />
      ) : !shown.length ? (
        <PanelEmpty icon={FolderOpen} title={t("app.files.empty")} hint={t("app.files.emptyHint")} className="py-8" />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {shown.map((g) => {
            const open = g.documents.filter((d) => !d.locked).length;
            const verified = g.documents.filter((d) => d.status === "VERIFIED").length;
            return (
              <li key={g.project.slug}>
                <Link
                  href="/app/files"
                  className="group flex items-center gap-3 rounded-xl border border-line bg-ink-850/50 p-3 transition hover:-translate-y-0.5 hover:border-gold-500/30"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-gold-500/20 bg-gradient-to-br from-gold-500/15 to-transparent text-gold-300">
                    <Buildings2 size={20} variant="Bulk" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-stone-100">{tr(g.project.name)}</span>
                    <span className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-400">
                      <span>{t("app.files.count", { n: open })}</span>
                      {verified > 0 && (
                        <span className="inline-flex items-center gap-1 text-success">
                          <Verify size={12} variant="Bold" /> {verified}
                        </span>
                      )}
                    </span>
                  </span>
                  <ArrowRight size={16} className="shrink-0 text-ink-500 transition group-hover:translate-x-0.5 group-hover:text-gold-300" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
