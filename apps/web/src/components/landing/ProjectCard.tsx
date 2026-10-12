"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowRight, Building, Location, Verify } from "iconsax-reactjs";
import { StatusBadge } from "@/components/ui/status-badge";
import { TrustRing } from "@/components/ui/trust-ring";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/i18n/client";
import type { ProjectCard as ProjectCardData } from "@/lib/types";
import { cn } from "@/lib/utils";
import { fmtMoneyCompact } from "@/components/marketing/format";

/** Elegant project card used on the landing page and developer profiles. */
export function ProjectCard({ project, className }: { project: ProjectCardData; className?: string }) {
  const { t, tr, locale } = useI18n();
  const [imgOk, setImgOk] = React.useState(!!project.coverUrl);
  const price = fmtMoneyCompact(project.priceFrom, locale, project.currency);
  const location = [project.district, project.region].filter(Boolean).map((x) => tr(x)).join(", ");

  return (
    <Link
      href={`/projects/${project.slug}`}
      aria-label={`${tr(project.name)} — ${t("landing.projects.open")}`}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-3xl border border-line bg-ink-900/80 shadow-card transition-all duration-500 ease-[var(--ease-out-expo)] hover:-translate-y-1.5 hover:border-gold-500/35 hover:shadow-lift",
        className,
      )}
    >
      <div className="relative aspect-[16/11] overflow-hidden">
        {imgOk && project.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.coverUrl}
            alt=""
            loading="lazy"
            onError={() => setImgOk(false)}
            className="absolute inset-0 size-full object-cover transition-transform duration-[1200ms] ease-[var(--ease-out-expo)] group-hover:scale-[1.06]"
          />
        ) : (
          <CoverPlaceholder floors={project.floors} />
        )}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink-950/90 via-ink-950/10 to-transparent" />
        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          <StatusBadge kind="projectStatus" value={project.status} className="backdrop-blur-md" />
          {project.verificationStatus === "VERIFIED" && (
            <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-ink-950/60 px-2.5 py-0.5 text-[11px] font-semibold text-success backdrop-blur-md">
              <Verify size={12} variant="Bold" />
              {t("landing.projects.verified")}
            </span>
          )}
        </div>
        <div className="absolute bottom-4 right-4 rounded-full bg-ink-950/70 p-1 backdrop-blur-md">
          <TrustRing score={project.trustScore} size={48} stroke={4} />
        </div>
        <div className="absolute bottom-4 left-4 right-20">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-gold-300">{tr(project.developer.name)}</div>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-[26px] leading-tight text-stone-100 transition-colors group-hover:text-gold-200">{tr(project.name)}</h3>
        {location && (
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-ink-300">
            <Location size={14} variant="Bulk" className="shrink-0 text-gold-400" />
            <span className="truncate">{location}</span>
          </p>
        )}

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="text-ink-400">{t("landing.projects.progress")}</span>
            <span className="font-mono font-semibold text-stone-100">{project.progress}%</span>
          </div>
          <Progress value={project.progress} />
        </div>

        <div className="mt-5 flex items-end justify-between gap-4 border-t border-line pt-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-ink-400">{t("landing.projects.priceFrom")}</div>
            <div className="mt-0.5 font-mono text-[15px] font-semibold text-stone-100">
              {price ? (
                locale === "ru" ? (
                  <>
                    <span className="text-xs font-normal text-ink-400">{t("landing.projects.from")} </span>
                    {price}
                  </>
                ) : (
                  <>
                    {price} <span className="text-xs font-normal text-ink-400">{t("landing.projects.from")}</span>
                  </>
                )
              ) : (
                <span className="font-sans text-sm font-medium text-ink-300">{t("landing.projects.priceOnRequest")}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-ink-400">
            <span className="inline-flex items-center gap-1">
              <Building size={14} variant="Bulk" />
              {t("landing.projects.floors", { n: project.floors })}
            </span>
            <span className="grid size-9 place-items-center rounded-full border border-line text-gold-300 transition-all duration-500 group-hover:border-gold-400 group-hover:bg-gold-gradient group-hover:text-onyx">
              <ArrowRight size={16} />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function CoverPlaceholder({ floors }: { floors: number }) {
  const n = Math.max(6, Math.min(16, floors || 12));
  return (
    <div className="bg-blueprint absolute inset-0 bg-ink-850">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_100%,rgb(201_164_100/0.22),transparent_65%)]" />
      <svg viewBox="0 0 200 140" className="absolute inset-x-0 bottom-0 mx-auto h-[85%]" aria-hidden>
        <rect x="70" y={130 - n * 7} width="60" height={n * 7} className="fill-ink-700" />
        {Array.from({ length: n }, (_, i) => (
          <line key={i} x1="70" x2="130" y1={130 - i * 7} y2={130 - i * 7} className="stroke-ink-500" strokeWidth="0.6" />
        ))}
        {Array.from({ length: 7 }, (_, i) => (
          <line key={i} x1={70 + i * 10} x2={70 + i * 10} y1="130" y2={130 - n * 7} stroke="#c9a464" strokeOpacity="0.7" strokeWidth="0.8" />
        ))}
        <rect x="40" y="112" width="30" height="18" className="fill-ink-800" />
        <rect x="130" y="104" width="34" height="26" className="fill-ink-800" />
        <line x1="10" x2="190" y1="130.5" y2="130.5" stroke="#c9a464" strokeOpacity="0.5" />
      </svg>
    </div>
  );
}
