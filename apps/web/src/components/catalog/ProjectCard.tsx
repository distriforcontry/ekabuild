"use client";
import Link from "next/link";
import { Building, Calendar, Location, ShieldTick, Verify } from "iconsax-reactjs";
import type { ProjectCard as ProjectCardType } from "@/lib/types";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/status-badge";
import { TrustRing } from "@/components/ui/trust-ring";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { ProjectCover } from "./ProjectCover";
import { useFormat } from "./use-format";
import { Tilt } from "@/components/marketing/motion";

/** Luxury catalog card: cover with zoom, status, trust ring, progress, price, availability. */
export function ProjectCard({ project: p, className }: { project: ProjectCardType; className?: string }) {
  const { t, label, tr } = useI18n();
  const fmt = useFormat();
  const href = `/projects/${p.slug}`;
  const location = [fmt.region(p.region), p.district ? tr(p.district) : null].filter(Boolean).join(", ");

  return (
    <Tilt as="article" max={4} className={cn("eka-glow h-full rounded-3xl", className)}>
    <div
      className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-ink-900 shadow-card transition-[box-shadow,border-color] duration-500 ease-[var(--ease-out-expo)] hover:border-gold-500/30 hover:shadow-lift focus-within:border-gold-500/40"
    >
      <div className="eka-dark relative aspect-[4/3] overflow-hidden">
        <ProjectCover
          src={p.coverUrl}
          name={tr(p.name)}
          seed={p.slug}
          floors={p.floors}
          className="absolute inset-0 duration-[1400ms] group-hover:scale-[1.07] motion-reduce:group-hover:scale-100"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950/85 via-ink-950/10 to-ink-950/35" />

        <div className="absolute left-4 top-4 flex flex-wrap items-center gap-2">
          <StatusBadge kind="projectStatus" value={p.status} className="bg-ink-950/60 backdrop-blur-md" />
          {p.verificationStatus === "VERIFIED" && (
            <Badge tone="gold" className="bg-ink-950/60 backdrop-blur-md">
              <ShieldTick variant="Bold" />
              {t("catalog.detail.verifiedProject")}
            </Badge>
          )}
        </div>

        <div className="glass absolute right-3 top-3 rounded-full p-1 shadow-card">
          <TrustRing score={p.trustScore} size={46} stroke={4} />
          <span className="sr-only">
            {t("catalog.card.trust")}: {p.trustScore} — {fmt.trustLabel(p.trustScore)}
          </span>
        </div>

        <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3">
          <div className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-ink-100">
            <Location size={14} variant="Bold" className="shrink-0 text-gold-300" />
            <span className="truncate">{location}</span>
          </div>
          <span className="glass inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium text-ink-100">
            <Building size={12} className="text-gold-300" />
            {t("catalog.card.floors", { count: p.floors })}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5 md:p-6">
        <div className="flex items-center gap-1.5 text-xs text-ink-400">
          <span className="truncate">{label("projectType", p.type)}</span>
          <span aria-hidden>·</span>
          <span className="truncate">{tr(p.developer.name)}</span>
          {p.developer.status === "VERIFIED" && (
            <Tooltip content={t("catalog.card.verifiedDeveloper")}>
              <span className="relative z-10 inline-flex" tabIndex={0} aria-label={t("catalog.card.verifiedDeveloper")}>
                <Verify size={15} variant="Bold" className="text-gold-400" />
              </span>
            </Tooltip>
          )}
        </div>

        <h3 className="mt-2 font-display text-[1.75rem] font-medium leading-[1.1] text-stone-100 transition-colors duration-300 group-hover:text-gold-200">
          <Link
            href={href}
            className="after:absolute after:inset-0 after:z-0 after:content-[''] focus-visible:outline-none"
            aria-label={t("catalog.card.open", { name: tr(p.name) })}
          >
            {tr(p.name)}
          </Link>
        </h3>
        {p.tagline && <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink-300">{tr(p.tagline)}</p>}

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="text-ink-400">{t("catalog.card.progress")}</span>
            <span className="font-mono font-medium text-ink-100">{p.progress}%</span>
          </div>
          <Progress value={p.progress} />
          {p.plannedEndDate && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-400">
              <Calendar size={13} variant="Bulk" className="text-gold-400" />
              {t("catalog.card.completion")}: <span className="text-ink-200">{fmt.monthYear(p.plannedEndDate)}</span>
            </div>
          )}
        </div>

        <div className="mt-auto pt-5">
        <div className="flex items-end justify-between gap-3 border-t border-line pt-4">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">{t("catalog.card.priceFrom")}</div>
            <div className="mt-0.5 truncate font-mono text-lg font-semibold tracking-tight text-stone-100">
              {p.priceFrom ? t("catalog.card.priceValue", { value: fmt.compactMoney(p.priceFrom, p.currency) }) : t("catalog.card.priceOnRequest")}
            </div>
            {p.pricePerSqm && (
              <div className="text-xs text-ink-400">
                {t("catalog.card.perSqm")} · <span className="font-mono">{fmt.compactMoney(p.pricePerSqm, p.currency)}</span>
              </div>
            )}
          </div>
          <Badge tone={p.unitsAvailable > 0 ? "success" : "neutral"} dot className="shrink-0">
            {p.unitsAvailable > 0 ? t("catalog.card.unitsAvailable", { count: p.unitsAvailable }) : t("catalog.card.noUnits")}
          </Badge>
        </div>
        </div>
      </div>
    </div>
    </Tilt>
  );
}

export function ProjectCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-ink-900 shadow-card">
      <div className="skeleton aspect-[4/3]" />
      <div className="space-y-3 p-5 md:p-6">
        <div className="skeleton h-3 w-1/3 rounded" />
        <div className="skeleton h-7 w-3/4 rounded-md" />
        <div className="skeleton h-3 w-full rounded" />
        <div className="skeleton mt-5 h-1.5 w-full rounded-full" />
        <div className="flex items-end justify-between border-t border-line pt-4">
          <div className="skeleton h-6 w-28 rounded" />
          <div className="skeleton h-5 w-20 rounded-full" />
        </div>
      </div>
    </div>
  );
}
