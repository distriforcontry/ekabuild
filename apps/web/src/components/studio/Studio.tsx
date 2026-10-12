"use client";
// Client-only entry for the 3D studio: three.js / R3F are code-split into the StudioApp chunk.
import * as React from "react";
import dynamic from "next/dynamic";
import { I3DCubeScan } from "iconsax-reactjs";
import { useI18n } from "@/i18n/client";
import { Spinner } from "@/components/ui/spinner";
import type { StudioAppProps } from "./StudioApp";

export function StudioSkeleton({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div className="flex h-[calc(100dvh-8rem)] min-h-[560px] flex-col overflow-hidden rounded-2xl border border-line bg-ink-900 shadow-card" aria-busy>
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-3">
        <div className="skeleton h-8 w-8 rounded-lg" />
        <div className="skeleton h-4 w-40 rounded" />
        <div className="mx-auto flex gap-1.5">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="skeleton size-8 rounded-lg" />
          ))}
        </div>
        <div className="skeleton h-8 w-28 rounded-xl" />
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="hidden w-[280px] shrink-0 space-y-2 border-r border-line p-3 lg:block">
          <div className="skeleton h-8 w-full rounded-lg" />
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton h-5 rounded" style={{ width: `${55 + ((i * 37) % 40)}%`, marginLeft: (i % 3) * 14 }} />
          ))}
        </div>
        <div
          className="bg-blueprint relative grid flex-1 place-items-center"
          style={{ background: "radial-gradient(130% 100% at 50% 0%, var(--color-ink-850) 0%, var(--color-ink-950) 78%)" }}
        >
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="grid size-14 place-items-center rounded-2xl border border-gold-500/25 bg-gold-500/8 text-gold-300 animate-float">
              <I3DCubeScan size={26} variant="Bulk" />
            </div>
            <div className="flex items-center gap-2 text-sm text-ink-300">
              <Spinner className="text-gold-400" />
              {label ?? t("studio.meta.title")}
            </div>
          </div>
        </div>
        <div className="hidden w-[340px] shrink-0 space-y-3 border-l border-line p-4 lg:block">
          <div className="skeleton h-8 w-full rounded-lg" />
          <div className="skeleton h-24 w-full rounded-xl" />
          <div className="skeleton h-40 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

const StudioApp = dynamic(() => import("./StudioApp"), { ssr: false, loading: () => <StudioSkeleton /> });

export function Studio(props: StudioAppProps) {
  return <StudioApp {...props} />;
}
