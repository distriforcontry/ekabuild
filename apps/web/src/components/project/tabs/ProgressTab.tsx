"use client";
import * as React from "react";
import { AnimatePresence, motion, useScroll, useSpring } from "motion/react";
import { Activity, Calendar, User } from "iconsax-reactjs";
import type { ProgressPhase } from "@eka/shared";
import type { ProgressItem } from "@/lib/types";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { CountUp } from "@/components/ui/reveal";
import { EmptyState } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { useFormat } from "@/components/catalog/use-format";
import { isImage } from "@/components/catalog/format";
import { useProject } from "../ProjectProvider";
import { Lightbox, type LightboxItem } from "../Lightbox";
import { FileChip, Thumb, downloadUrl } from "../bits";

type Filter = "ALL" | ProgressPhase;

export function ProgressTab() {
  const { project: p } = useProject();
  const { t, label } = useI18n();
  const fmt = useFormat();
  const all = React.useMemo(
    () => [...(p.progressUpdates ?? [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [p.progressUpdates],
  );
  const [filter, setFilter] = React.useState<Filter>("ALL");
  const items = filter === "ALL" ? all : all.filter((u) => u.phase === filter);
  const [lb, setLb] = React.useState<{ items: LightboxItem[]; index: number; title: string } | null>(null);

  const counts: Record<Filter, number> = {
    ALL: all.length,
    CONSTRUCTION: all.filter((u) => u.phase === "CONSTRUCTION").length,
    POST_HANDOVER: all.filter((u) => u.phase === "POST_HANDOVER").length,
  };

  return (
    <div className="space-y-6">
      {/* overall progress */}
      <div className="relative overflow-hidden rounded-3xl border border-line bg-ink-900/80 p-6 shadow-card md:p-8">
        <div className="bg-blueprint pointer-events-none absolute inset-0 opacity-50 [mask-image:linear-gradient(to_left,black,transparent_70%)]" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-400">{t("catalog.progress.overall")}</div>
            <div className="mt-2 font-display text-7xl leading-none text-gold-gradient md:text-8xl">
              <CountUp value={p.progress} duration={1.4} />%
            </div>
          </div>
          <div className="space-y-1 text-sm text-ink-300 md:text-right">
            {p.startDate && (
              <div className="flex items-center gap-2 md:justify-end">
                <Calendar size={15} className="text-gold-400" />
                {t("catalog.progress.started", { date: fmt.date(p.startDate) })}
              </div>
            )}
            {p.plannedEndDate && (
              <div className="flex items-center gap-2 md:justify-end">
                <Calendar size={15} className="text-gold-400" />
                {t("catalog.progress.planned", { date: fmt.date(p.plannedEndDate) })}
              </div>
            )}
          </div>
        </div>
        <div className="relative mt-6 h-3 overflow-hidden rounded-full bg-fg/8" role="progressbar" aria-valuenow={p.progress} aria-valuemin={0} aria-valuemax={100}>
          <motion.div
            className="relative h-full overflow-hidden rounded-full bg-gold-gradient"
            initial={{ width: 0 }}
            whileInView={{ width: `${p.progress}%` }}
            viewport={{ once: true }}
            transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="bg-gold-sheen absolute inset-0 animate-[shimmer_2.6s_linear_infinite]" />
          </motion.div>
          {[25, 50, 75].map((m) => (
            <span key={m} className="absolute top-0 h-full w-px bg-ink-950/40" style={{ left: `${m}%` }} />
          ))}
        </div>
      </div>

      {/* phase filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-3xl text-stone-100">{t("catalog.progress.title")}</h3>
        <div role="radiogroup" className="inline-flex rounded-xl border border-line bg-ink-900 p-1">
          {(["ALL", "CONSTRUCTION", "POST_HANDOVER"] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                "relative inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors",
                filter === f ? "text-stone-100" : "text-ink-300 hover:text-stone-100",
              )}
            >
              {filter === f && <motion.span layoutId="progress-phase-pill" className="absolute inset-0 rounded-lg bg-ink-700" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
              <span className="relative">{f === "ALL" ? t("catalog.progress.all") : label("progressPhase", f)}</span>
              <span className="relative font-mono text-[10px] text-ink-400">{counts[f]}</span>
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={Activity} title={t("catalog.progress.empty")} description={t("catalog.progress.emptyHint")} className="py-16" />
      ) : (
        <Timeline items={items} onOpen={(u, index) => setLb({ items: mediaItems(u), index, title: u.title })} />
      )}

      {lb && <Lightbox items={lb.items} index={lb.index} onIndexChange={(index) => setLb((s) => (s ? { ...s, index } : s))} open onOpenChange={(o) => !o && setLb(null)} title={lb.title} />}
    </div>
  );
}

function Timeline({ items, onOpen }: { items: ProgressItem[]; onOpen: (u: ProgressItem, index: number) => void }) {
  const listRef = React.useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({ target: listRef, offset: ["start 80%", "end 60%"] });
  const line = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });
  return (
    <ol ref={listRef} className="relative ml-3 md:ml-5">
      <span className="absolute bottom-0 left-0 top-0 w-px bg-line" aria-hidden />
      <motion.span className="absolute left-0 top-0 h-full w-px origin-top bg-gold-gradient" style={{ scaleY: line }} aria-hidden />
      <AnimatePresence mode="popLayout" initial={false}>
        {items.map((u, i) => (
          <motion.li
            key={u.id}
            layout
            initial={{ opacity: 0, x: -12 }}
            whileInView={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.6, delay: Math.min(i, 4) * 0.05, ease: [0.16, 1, 0.3, 1] }}
            className="relative pb-8 pl-8 last:pb-0 md:pl-10"
          >
            <span
              className={cn(
                "absolute -left-[7px] top-1.5 size-[15px] rounded-full border-[3px] border-ink-950",
                u.phase === "POST_HANDOVER" ? "bg-info" : "bg-gold-400",
                i === 0 && "shadow-glow",
              )}
            />
            <ProgressCard item={u} onOpenMedia={(index) => onOpen(u, index)} />
          </motion.li>
        ))}
      </AnimatePresence>
    </ol>
  );
}

function mediaItems(u: ProgressItem): LightboxItem[] {
  return u.media.filter((m) => isImage(m.mime, m.originalName)).map((m) => ({ src: m.url, alt: m.originalName, caption: u.title, download: downloadUrl(m) }));
}

function ProgressCard({ item: u, onOpenMedia }: { item: ProgressItem; onOpenMedia: (i: number) => void }) {
  const { t, label, tr } = useI18n();
  const fmt = useFormat();
  const images = u.media.filter((m) => isImage(m.mime, m.originalName));
  const files = u.media.filter((m) => !isImage(m.mime, m.originalName));

  return (
    <article className="rounded-3xl border border-line bg-ink-900/80 p-5 shadow-card transition-colors duration-300 hover:border-line-strong md:p-6">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <time dateTime={u.date} className="font-mono text-ink-300">
          {fmt.date(u.date)}
        </time>
        <Badge tone={u.phase === "POST_HANDOVER" ? "info" : "gold"}>{label("progressPhase", u.phase)}</Badge>
        {u.stage && <Badge tone="neutral">{tr(u.stage)}</Badge>}
        {typeof u.percent === "number" && (
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-gold-500/30 bg-gold-500/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-gold-200">
            <Activity size={12} variant="Bulk" className="text-gold-400" />
            {u.percent}%
          </span>
        )}
      </div>
      <h4 className="mt-2 text-lg font-semibold text-stone-100">{tr(u.title)}</h4>
      {u.body && <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink-300">{tr(u.body)}</p>}

      {images.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.slice(0, 8).map((m, i) => (
            <div key={m.id} className="relative">
              <Thumb src={m.url} alt={m.originalName} onClick={() => onOpenMedia(i)} className="aspect-square rounded-xl border border-line" />
              {i === 7 && images.length > 8 && (
                <span className="pointer-events-none absolute inset-0 grid place-items-center rounded-xl bg-ink-950/70 font-mono text-sm text-stone-100">
                  +{images.length - 8}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      {files.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {files.map((f) => (
            <FileChip key={f.id} file={f} />
          ))}
        </div>
      )}
      {u.author && (
        <div className="mt-4 flex items-center gap-1.5 text-xs text-ink-400">
          <User size={13} variant="Bulk" className="text-gold-400" />
          {t("catalog.progress.author", { name: tr(u.author.fullName) })}
        </div>
      )}
    </article>
  );
}
