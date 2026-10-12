"use client";
import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Location, Verify } from "iconsax-reactjs";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/status-badge";
import { TrustRing } from "@/components/ui/trust-ring";
import { useI18n } from "@/i18n/client";
import type { ProjectCard } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useFmt } from "./format";
import { ProjectCover } from "./ui";

/** Compact project card for the cabinet (favorites, recommendations). */
export function ProjectMiniCard({ project, action, index = 0, className }: { project: ProjectCard; action?: React.ReactNode; index?: number; className?: string }) {
  const { t, tr } = useI18n();
  const fmt = useFmt();
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.45, delay: Math.min(index, 8) * 0.05, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-ink-900 shadow-card transition-all duration-500 hover:-translate-y-1 hover:border-line-strong hover:shadow-lift",
        className,
      )}
    >
      <Link href={`/projects/${project.slug}`} className="absolute inset-0 z-10" aria-label={tr(project.name)} />
      <div className="relative aspect-[16/10] overflow-hidden">
        <div className="size-full transition-transform duration-700 ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-[1.04]">
          <ProjectCover src={project.coverUrl} alt={tr(project.name)} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950/80 via-transparent to-transparent" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <StatusBadge kind="projectStatus" value={project.status} className="bg-ink-950/70 backdrop-blur" />
        </div>
        {action && <div className="absolute right-3 top-3 z-20">{action}</div>}
        <div className="absolute bottom-3 right-3 rounded-full bg-ink-950/70 p-1 backdrop-blur">
          <TrustRing score={project.trustScore} size={44} stroke={4} />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start gap-2">
          <h3 className="line-clamp-1 flex-1 font-semibold text-stone-100">{tr(project.name)}</h3>
          {project.verificationStatus === "VERIFIED" && <Verify size={18} variant="Bold" className="shrink-0 text-gold-400" />}
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-400">
          <Location size={14} className="shrink-0" />
          <span className="truncate">{tr([project.region, project.district].filter(Boolean).join(", "))}</span>
        </p>
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-[11px] text-ink-400">
            <span>{t("app.common.progress")}</span>
            <span className="font-mono text-ink-200">{project.progress}%</span>
          </div>
          <Progress value={project.progress} />
        </div>
        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-ink-400">{t("app.common.price")}</div>
            <div className="font-mono text-sm font-semibold text-stone-100">
              {project.priceFrom ? (
                <>
                  {fmt.compact(project.priceFrom)} <span className="font-sans text-xs font-normal text-ink-400">{t("app.common.from")}</span>
                </>
              ) : (
                "—"
              )}
            </div>
          </div>
          <div className="text-right text-xs text-ink-400">{t("app.favorites.available", { n: project.unitsAvailable })}</div>
        </div>
      </div>
    </motion.article>
  );
}
