"use client";
import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  Activity,
  ArrowRight,
  ArrowRight2,
  Bag2,
  Buildings,
  DocumentText,
  Folder2,
  Heart,
  PenTool,
  TickCircle,
  Wallet2,
} from "iconsax-reactjs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatCard } from "@/components/ui/misc";
import { CountUp, Reveal } from "@/components/ui/reveal";
import { StatusBadge } from "@/components/ui/status-badge";
import { useI18n } from "@/i18n/client";
import { api } from "@/lib/api";
import type { ContractDetail, ProgressItem, ProjectCard, PurchaseItem } from "@/lib/types";
import type { DocumentItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useCabinetUser } from "../CabinetContext";
import { asList, useApi } from "../hooks";
import { useFmt } from "../format";
import { ProjectMiniCard } from "../ProjectMiniCard";
import { CardGridSkeleton, ErrorState, ListSkeleton, StatCardsSkeleton } from "../states";
import { ProjectCover } from "../ui";

export type FeedItem = ProgressItem & { project: { slug: string; name: string } };
export type MyFilesGroup = { project: { slug: string; name: string }; documents: DocumentItem[] };

function greetingKey(h: number) {
  if (h < 5) return "night" as const;
  if (h < 12) return "morning" as const;
  if (h < 18) return "day" as const;
  return "evening" as const;
}

export function DashboardView() {
  const { t, label, tr } = useI18n();
  const fmt = useFmt();
  const { user } = useCabinetUser();
  const purchases = useApi<PurchaseItem[]>("/purchases", undefined, { select: asList });
  const favorites = useApi<ProjectCard[]>("/favorites", undefined, { select: asList });
  const files = useApi<MyFilesGroup[]>("/me/files", undefined, { select: asList });
  const feed = useApi<FeedItem[]>("/me/feed", undefined, { select: asList });
  const recommended = useApi<ProjectCard[]>("/projects", { sort: "trust", pageSize: 4 }, { select: asList });
  const [hour, setHour] = React.useState<number | null>(null);
  React.useEffect(() => setHour(new Date().getHours()), []);

  // contracts that need *my* signature (ask the API — it knows which side I sign for)
  const [toSign, setToSign] = React.useState<PurchaseItem[]>([]);
  React.useEffect(() => {
    const candidates = (purchases.data ?? []).filter((p) => p.contract && (p.contract.status === "PENDING" || p.contract.status === "PARTIALLY_SIGNED")).slice(0, 6);
    if (!candidates.length) {
      setToSign([]);
      return;
    }
    let alive = true;
    Promise.all(
      candidates.map((p) =>
        api
          .get<ContractDetail>(`/contracts/${p.contract!.id}`)
          .then((c) => (c.canSign ? p : null))
          .catch(() => (p.contract!.status === "PENDING" ? p : null)),
      ),
    ).then((res) => alive && setToSign(res.filter((x): x is PurchaseItem => Boolean(x))));
    return () => {
      alive = false;
    };
  }, [purchases.data]);

  const list = purchases.data ?? [];
  const signed = list.filter((p) => p.contract?.status === "SIGNED").length;
  const filesCount = (files.data ?? []).reduce((s, g) => s + g.documents.filter((d) => !d.locked).length, 0);
  const toPay = list.filter((p) => p.status === "SIGNED");
  const statsLoading = purchases.loading || favorites.loading || files.loading;

  return (
    <div className="space-y-8">
      {/* hero */}
      <section className="relative overflow-hidden rounded-3xl border border-line bg-ink-900 p-6 shadow-card md:p-10">
        <div className="bg-blueprint pointer-events-none absolute inset-0 opacity-70 [mask-image:linear-gradient(to_left,black,transparent_70%)]" />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-24 size-80 rounded-full bg-gold-500/15 blur-[90px]"
          animate={{ scale: [1, 1.12, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-gold-400">
              {hour === null ? " " : t(`app.dashboard.greeting.${greetingKey(hour)}`)}
            </div>
            <h1 className="font-display text-4xl font-medium leading-tight text-stone-100 md:text-5xl">{user.fullName}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge tone="gold">{label("role", user.role)}</Badge>
              {user.organization ? (
                <Badge tone={user.organization.status === "VERIFIED" ? "success" : "warning"} dot>
                  {tr(user.organization.name)}
                </Badge>
              ) : (
                <Badge>{t("app.dashboard.individual")}</Badge>
              )}
            </div>
            <p className="mt-4 max-w-xl text-sm text-ink-300 md:text-[15px]">{t("app.dashboard.heroSubtitle")}</p>
          </div>
          <Button asChild variant="gold" size="lg" className="self-start md:self-auto">
            <Link href="/projects">
              <Buildings size={18} variant="Bulk" /> {t("app.dashboard.browse")}
            </Link>
          </Button>
        </div>
      </section>

      {/* stats */}
      {statsLoading ? (
        <StatCardsSkeleton />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
          {[
            { label: t("app.dashboard.stats.purchases"), value: list.length, hint: t("app.dashboard.stats.purchasesHint"), icon: Bag2 },
            { label: t("app.dashboard.stats.contracts"), value: signed, hint: t("app.dashboard.stats.contractsHint"), icon: DocumentText },
            { label: t("app.dashboard.stats.files"), value: filesCount, hint: t("app.dashboard.stats.filesHint"), icon: Folder2 },
            { label: t("app.dashboard.stats.favorites"), value: (favorites.data ?? []).length, hint: t("app.dashboard.stats.favoritesHint"), icon: Heart },
          ].map((s, i) => (
            <Reveal key={s.label} delay={i * 0.06} y={12}>
              <StatCard label={s.label} value={<CountUp value={s.value} duration={1} />} hint={s.hint} icon={s.icon} className="h-full" />
            </Reveal>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* recent purchases */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>{t("app.dashboard.recent.title")}</CardTitle>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/app/purchases">
                  {t("common.actions.seeAll")} <ArrowRight2 size={14} />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {purchases.loading ? (
                <ListSkeleton rows={3} />
              ) : purchases.error ? (
                <ErrorState error={purchases.error} onRetry={purchases.reload} compact />
              ) : list.length === 0 ? (
                <div className="flex flex-col items-center rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center">
                  <Bag2 size={28} variant="Bulk" className="text-gold-300" />
                  <div className="mt-3 font-semibold text-stone-100">{t("app.dashboard.recent.empty")}</div>
                  <p className="mt-1 max-w-sm text-sm text-ink-400">{t("app.dashboard.recent.emptyHint")}</p>
                  <Button asChild variant="outline" size="sm" className="mt-4">
                    <Link href="/projects">{t("app.dashboard.browse")}</Link>
                  </Button>
                </div>
              ) : (
                <ul className="-mx-2 space-y-1">
                  {list.slice(0, 4).map((p) => (
                    <li key={p.id}>
                      <Link href={`/app/purchases/${p.id}`} className="group flex items-center gap-4 rounded-xl px-2 py-2.5 transition hover:bg-fg/[0.04]">
                        <span className="size-12 shrink-0 overflow-hidden rounded-xl border border-line">
                          <ProjectCover src={p.project.coverUrl} alt={tr(p.project.name)} iconSize={18} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-stone-100">{tr(p.project.name)}</span>
                          <span className="block truncate text-xs text-ink-400">
                            <span className="font-mono">{p.number}</span> ·{" "}
                            {p.unit
                              ? t("app.common.unitShort", { section: p.unit.section, floor: p.unit.floor, number: p.unit.number })
                              : t("app.purchases.package")}
                          </span>
                        </span>
                        <span className="hidden text-right sm:block">
                          <span className="block font-mono text-sm text-stone-100">{fmt.money(p.amount, p.currency)}</span>
                          <span className="block text-[11px] text-ink-400">{fmt.date(p.createdAt)}</span>
                        </span>
                        <StatusBadge kind="purchaseStatus" value={p.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* recommended */}
          <div>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-stone-100">{t("app.dashboard.recommended.title")}</h2>
                <p className="text-sm text-ink-400">{t("app.dashboard.recommended.subtitle")}</p>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/projects">
                  {t("common.actions.seeAll")} <ArrowRight2 size={14} />
                </Link>
              </Button>
            </div>
            {recommended.loading ? (
              <CardGridSkeleton count={2} className="xl:grid-cols-2" />
            ) : recommended.error || !(recommended.data ?? []).length ? (
              <div className="rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center text-sm text-ink-400">
                {recommended.error ? <ErrorState error={recommended.error} onRetry={recommended.reload} compact /> : t("app.dashboard.recommended.empty")}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {(recommended.data ?? []).slice(0, 4).map((p, i) => (
                  <ProjectMiniCard key={p.id} project={p} index={i} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {/* next actions */}
          <Card className="relative overflow-hidden">
            <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-gold-500/10 blur-3xl" />
            <CardHeader>
              <div>
                <CardTitle>{t("app.dashboard.actions.title")}</CardTitle>
                <CardDescription>{t("app.dashboard.actions.subtitle")}</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {purchases.loading ? (
                <ListSkeleton rows={2} />
              ) : toSign.length + toPay.length === 0 ? (
                <div className="flex items-center gap-3 rounded-xl border border-success/20 bg-success/[0.06] p-4">
                  <TickCircle size={24} variant="Bulk" className="shrink-0 text-success" />
                  <div>
                    <div className="text-sm font-semibold text-stone-100">{t("app.dashboard.actions.empty")}</div>
                    <div className="text-xs text-ink-400">{t("app.dashboard.actions.emptyHint")}</div>
                  </div>
                </div>
              ) : (
                <ul className="space-y-2">
                  {toSign.map((p) => (
                    <ActionRow
                      key={`s-${p.id}`}
                      href={`/app/contracts/${p.contract!.id}`}
                      icon="sign"
                      title={t("app.dashboard.actions.sign")}
                      text={`${p.contract!.number} · ${tr(p.project.name)}`}
                    />
                  ))}
                  {toPay.map((p) => (
                    <ActionRow
                      key={`p-${p.id}`}
                      href={`/app/purchases/${p.id}`}
                      icon="pay"
                      title={t("app.dashboard.actions.pay")}
                      text={`${fmt.money(p.amount, p.currency)} · ${tr(p.project.name)}`}
                    />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* feed */}
          <Card>
            <CardHeader>
              <CardTitle>{t("app.dashboard.feed.title")}</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href="/app/feed">
                  {t("common.actions.seeAll")} <ArrowRight2 size={14} />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {feed.loading ? (
                <ListSkeleton rows={3} />
              ) : feed.error ? (
                <ErrorState error={feed.error} onRetry={feed.reload} compact />
              ) : !(feed.data ?? []).length ? (
                <div className="py-6 text-center">
                  <Activity size={26} variant="Bulk" className="mx-auto text-gold-300" />
                  <div className="mt-2 text-sm font-semibold text-stone-100">{t("app.dashboard.feed.empty")}</div>
                  <p className="mx-auto mt-1 max-w-xs text-xs text-ink-400">{t("app.dashboard.feed.emptyHint")}</p>
                </div>
              ) : (
                <ol className="relative space-y-5 border-l border-line pl-5">
                  {(feed.data ?? []).slice(0, 4).map((f) => (
                    <li key={f.id} className="relative">
                      <span
                        className={cn(
                          "absolute -left-[25px] top-1 size-2.5 rounded-full ring-4 ring-ink-900",
                          f.phase === "POST_HANDOVER" ? "bg-info" : "bg-gold-400",
                        )}
                      />
                      <div className="text-[11px] text-ink-400">
                        {fmt.date(f.date)} · <Link href={`/projects/${f.project.slug}`} className="hover:text-gold-300">{tr(f.project.name)}</Link>
                      </div>
                      <div className="mt-0.5 text-sm font-medium text-stone-100">{tr(f.title)}</div>
                      {f.percent != null && <div className="mt-0.5 text-xs text-gold-300">{t("app.feed.percent", { n: f.percent })}</div>}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ActionRow({ href, icon, title, text }: { href: string; icon: "sign" | "pay"; title: string; text: string }) {
  const Icon = icon === "sign" ? PenTool : Wallet2;
  return (
    <li>
      <Link
        href={href}
        className="group flex items-center gap-3 rounded-xl border border-line bg-ink-850/60 p-3 transition hover:-translate-y-0.5 hover:border-gold-500/40 hover:bg-gold-500/[0.04]"
      >
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-xl",
            icon === "sign" ? "bg-gold-gradient text-onyx shadow-glow" : "border border-info/30 bg-info/10 text-info",
          )}
        >
          <Icon size={18} variant="Bold" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-stone-100">{title}</span>
          <span className="block truncate text-xs text-ink-400">{text}</span>
        </span>
        <ArrowRight size={16} className="shrink-0 text-ink-400 transition group-hover:translate-x-0.5 group-hover:text-gold-300" />
      </Link>
    </li>
  );
}
