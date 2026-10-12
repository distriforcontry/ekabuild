"use client";
import * as React from "react";
import type { Icon as IconType } from "iconsax-reactjs";
import { CloudCross, Refresh, ShieldCross } from "iconsax-reactjs";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n/client";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { isForbidden, isNotFound } from "./hooks";

/** Friendly error card with retry — used whenever a fetch fails (API down, 403, 404…). */
export function ErrorState({ error, onRetry, className, compact }: { error: unknown; onRetry?: () => void; className?: string; compact?: boolean }) {
  const { t } = useI18n();
  const forbidden = isForbidden(error);
  const notFound = isNotFound(error);
  const network = error instanceof ApiError && error.status === 0;
  const title = forbidden ? t("app.states.forbiddenTitle") : notFound ? t("app.states.notFoundTitle") : t("app.states.errorTitle");
  const hint = forbidden
    ? t("app.states.forbiddenHint")
    : notFound
      ? t("app.states.notFoundHint")
      : network
        ? t("common.errors.network")
        : t("app.states.errorHint");
  const Icon: IconType = forbidden ? ShieldCross : CloudCross;
  if (compact) {
    return (
      <div className={cn("flex items-center gap-3 rounded-xl border border-danger/20 bg-danger/[0.05] px-4 py-3 text-sm", className)}>
        <Icon size={20} variant="Bulk" className="shrink-0 text-danger" />
        <span className="flex-1 text-ink-200">{title}</span>
        {onRetry && !forbidden && !notFound && (
          <Button size="sm" variant="ghost" onClick={onRetry}>
            <Refresh size={14} /> {t("common.actions.retry")}
          </Button>
        )}
      </div>
    );
  }
  return (
    <EmptyState
      icon={Icon}
      title={title}
      description={hint}
      className={className}
      action={
        onRetry && !forbidden && !notFound ? (
          <Button variant="secondary" onClick={onRetry}>
            <Refresh size={16} /> {t("common.actions.retry")}
          </Button>
        ) : undefined
      }
    />
  );
}

export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-line bg-ink-900 p-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-4 h-7 w-20" />
          <Skeleton className="mt-3 h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-xl border border-line bg-ink-900 p-4">
          <Skeleton className="size-12 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function CardGridSkeleton({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-line bg-ink-900">
          <Skeleton className="aspect-[16/10] rounded-none" />
          <div className="space-y-3 p-5">
            <Skeleton className="h-5 w-3/5" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-2 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Small section heading inside cabinet pages */
export function SectionTitle({ title, subtitle, action, className }: { title: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-4 flex items-end justify-between gap-4", className)}>
      <div>
        <h2 className="text-base font-semibold tracking-tight text-stone-100 md:text-lg">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-ink-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
