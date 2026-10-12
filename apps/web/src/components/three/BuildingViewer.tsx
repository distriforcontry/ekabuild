"use client";
// Public 3D entry points. three.js / R3F are code-split and only loaded on the client when the viewer
// scrolls near the viewport.
import * as React from "react";
import dynamic from "next/dynamic";
import { I3DCubeScan } from "iconsax-reactjs";
import type { MassingParams } from "@eka/shared";
import type { FileRef } from "@/lib/types";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import type { BuildingSceneProps } from "./BuildingScene";

function ViewerFallback({ compact }: { compact?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="bg-blueprint relative grid size-full place-items-center overflow-hidden bg-ink-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgb(201_164_100/0.12),transparent_65%)]" />
      <div className="relative flex flex-col items-center gap-3 text-center">
        <div className="grid size-14 place-items-center rounded-2xl border border-gold-500/25 bg-gold-500/8 text-gold-300 animate-float">
          <I3DCubeScan size={26} variant="Bulk" />
        </div>
        {!compact && (
          <div className="flex items-center gap-2 text-sm text-ink-300">
            <Spinner className="text-gold-400" />
            {t("catalog.viewer.loading")}
          </div>
        )}
      </div>
    </div>
  );
}

const Scene = dynamic(() => import("./BuildingScene"), { ssr: false, loading: () => <ViewerFallback /> });
const Thumb = dynamic(() => import("./BuildingScene").then((m) => m.ThumbScene), { ssr: false, loading: () => <ViewerFallback compact /> });

function useNearViewport<T extends Element>(margin = "300px") {
  const ref = React.useRef<T>(null);
  const [near, setNear] = React.useState(false);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") return setNear(true);
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);
  return [ref, near] as const;
}

export type BuildingViewerProps = {
  /** Uploaded GLB/GLTF (takes precedence) */
  model3d?: FileRef | null;
  /** Procedural massing parameters (used when no model) */
  massing?: MassingParams | null;
  /** Fallback floors when massing is missing */
  floors?: number;
  /** Construction progress 0..100 — floors above it render as a wireframe ghost */
  progress?: number;
  /** Used for the screenshot file name / aria-label */
  name?: string;
  /** "full" = all controls, "compact" = rotate / day-night / fullscreen only */
  variant?: BuildingSceneProps["variant"];
  autoRotate?: boolean;
  className?: string;
};

/** Interactive 3D building: uploaded GLB or a procedural building from massing params. */
export function BuildingViewer({ className, ...props }: BuildingViewerProps) {
  const [ref, near] = useNearViewport<HTMLDivElement>();
  return (
    <div ref={ref} className={cn("relative h-[520px] w-full overflow-hidden rounded-3xl border border-line shadow-card", className)}>
      {near ? <Scene {...props} /> : <ViewerFallback />}
    </div>
  );
}

/** Lightweight auto-rotating procedural building without UI. */
export function BuildingThumb({
  massing,
  floors,
  progress,
  night,
  className,
}: {
  massing?: MassingParams | null;
  floors?: number;
  progress?: number;
  night?: boolean;
  className?: string;
}) {
  const [ref, near] = useNearViewport<HTMLDivElement>("100px");
  return (
    <div ref={ref} className={cn("relative size-full", className)} aria-hidden>
      {near ? <Thumb massing={massing} floors={floors} progress={progress} night={night} /> : null}
    </div>
  );
}
