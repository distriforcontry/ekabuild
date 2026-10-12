"use client";
import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Activity, Gallery, Play, User } from "iconsax-reactjs";
import type { ProgressPhase } from "@eka/shared";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/i18n/client";
import type { FileRef } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FilePreviewDialog } from "../FilePreviewDialog";
import { fileKind } from "../FileTypeIcon";
import { asList, useApi } from "../hooks";
import { dayKey, useFmt } from "../format";
import { ErrorState, ListSkeleton } from "../states";
import type { FeedItem } from "./DashboardView";

type Filter = "all" | ProgressPhase;
const FILTERS: Filter[] = ["all", "CONSTRUCTION", "POST_HANDOVER"];

export function FeedView() {
  const { t, label, tr } = useI18n();
  const fmt = useFmt();
  const { data, loading, error, reload } = useApi<FeedItem[]>("/me/feed", undefined, { select: asList });
  const [filter, setFilter] = React.useState<Filter>("all");
  const [preview, setPreview] = React.useState<FileRef | null>(null);

  const items = React.useMemo(
    () => (data ?? []).filter((f) => filter === "all" || f.phase === filter).sort((a, b) => +new Date(b.date) - +new Date(a.date)),
    [data, filter],
  );
  const counts = React.useMemo(() => {
    const c: Record<Filter, number> = { all: 0, CONSTRUCTION: 0, POST_HANDOVER: 0 };
    for (const f of data ?? []) {
      c.all++;
      c[f.phase]++;
    }
    return c;
  }, [data]);

  return (
    <div>
      <PageHeader eyebrow={t("app.shell.area")} title={t("app.feed.title")} description={t("app.feed.subtitle")} />

      <div role="tablist" className="no-scrollbar -mx-4 mb-8 flex gap-2 overflow-x-auto px-4">
        {FILTERS.map((f) => {
          const active = filter === f;
          return (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(f)}
              className={cn(
                "relative inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-medium transition",
                active ? "border-gold-500/50 text-stone-100" : "border-line text-ink-300 hover:border-line-strong hover:text-stone-100",
              )}
            >
              {active && <motion.span layoutId="feed-chip" className="absolute inset-0 rounded-full bg-gold-500/10" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
              <span className="relative">{t(`app.feed.filters.${f}`)}</span>
              <span className={cn("relative rounded-full px-1.5 font-mono text-[10px]", active ? "bg-gold-500/20 text-gold-200" : "bg-fg/5 text-ink-400")}>{counts[f]}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <ListSkeleton rows={4} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : items.length === 0 ? (
        <EmptyState icon={Activity} title={t("app.feed.empty")} description={t("app.feed.emptyHint")} />
      ) : (
        <ol className="relative ml-2 border-l border-line pl-6 md:ml-4 md:pl-10">
          <AnimatePresence initial={false}>
            {items.map((f, i) => {
              const newDay = i === 0 || dayKey(items[i - 1]!.date) !== dayKey(f.date);
              const media = f.media ?? [];
              return (
                <motion.li
                  key={f.id}
                  layout
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.45, delay: Math.min(i, 8) * 0.04, ease: [0.16, 1, 0.3, 1] }}
                  className="relative pb-8 last:pb-0"
                >
                  <span
                    className={cn(
                      "absolute -left-[31px] top-5 grid size-3.5 place-items-center rounded-full ring-4 ring-ink-950 md:-left-[47px]",
                      f.phase === "POST_HANDOVER" ? "bg-info" : "bg-gold-400",
                    )}
                  />
                  {newDay && <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-ink-400">{fmt.date(f.date)}</div>}
                  <article className="rounded-2xl border border-line bg-ink-900 p-5 shadow-card transition hover:border-line-strong">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={f.phase === "POST_HANDOVER" ? "info" : "gold"}>{label("progressPhase", f.phase)}</Badge>
                      {f.stage && <Badge>{tr(f.stage)}</Badge>}
                      <Link href={`/projects/${f.project.slug}`} className="ml-auto text-xs font-semibold text-gold-300 underline-offset-4 hover:underline">
                        {tr(f.project.name)}
                      </Link>
                    </div>
                    <h3 className="mt-3 text-base font-semibold text-stone-100 md:text-lg">{tr(f.title)}</h3>
                    {f.body && <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink-300">{tr(f.body)}</p>}
                    {f.percent != null && (
                      <div className="mt-4 max-w-sm">
                        <div className="mb-1.5 flex justify-between text-xs">
                          <span className="text-ink-400">{t("app.common.progress")}</span>
                          <span className="font-mono text-gold-300">{t("app.feed.percent", { n: f.percent })}</span>
                        </div>
                        <Progress value={f.percent} />
                      </div>
                    )}
                    {media.length > 0 && (
                      <div className={cn("mt-4 grid gap-2", media.length === 1 ? "grid-cols-1" : media.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
                        {media.slice(0, 6).map((m, mi) => {
                          const kind = fileKind(m.mime, m.originalName);
                          const more = mi === 5 && media.length > 6;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => setPreview(m)}
                              className={cn(
                                "group relative cursor-pointer overflow-hidden rounded-xl border border-line bg-ink-850",
                                media.length === 1 ? "aspect-[16/9]" : "aspect-square",
                              )}
                              aria-label={m.originalName}
                            >
                              {kind === "image" ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={m.url} alt={m.originalName} loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-105" />
                              ) : (
                                <span className="grid size-full place-items-center text-gold-300">
                                  {kind === "video" ? <Play size={28} variant="Bulk" /> : <Gallery size={28} variant="Bulk" />}
                                </span>
                              )}
                              {more && (
                                <span className="absolute inset-0 grid place-items-center bg-ink-950/70 font-mono text-lg font-semibold text-stone-100">
                                  +{media.length - 6}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-400">
                      <span>{fmt.dateTime(f.date)}</span>
                      {f.author && (
                        <span className="inline-flex items-center gap-1">
                          <User size={13} /> {t("app.feed.by", { name: f.author.fullName })}
                        </span>
                      )}
                      {media.length > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Gallery size={13} /> {t("app.feed.media", { n: media.length })}
                        </span>
                      )}
                    </div>
                  </article>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ol>
      )}
      <FilePreviewDialog file={preview} open={Boolean(preview)} onOpenChange={(o) => !o && setPreview(null)} />
    </div>
  );
}
