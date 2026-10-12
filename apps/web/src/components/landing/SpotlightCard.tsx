"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

/** Card with a soft gold spotlight that follows the cursor (pure CSS vars, no re-renders). */
export function SpotlightCard({
  className,
  children,
  as: Comp = "div",
}: {
  className?: string;
  children: React.ReactNode;
  as?: "div" | "article" | "li";
}) {
  const ref = React.useRef<HTMLElement>(null);
  const onMove = (e: React.PointerEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--sx", `${e.clientX - r.left}px`);
    el.style.setProperty("--sy", `${e.clientY - r.top}px`);
  };
  return (
    <Comp
      ref={ref as React.Ref<never>}
      onPointerMove={onMove}
      className={cn(
        "group/spot relative isolate overflow-hidden rounded-3xl border border-line bg-ink-900/70 shadow-card transition-all duration-500 ease-[var(--ease-out-expo)] hover:-translate-y-1 hover:border-gold-500/30 hover:shadow-lift",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-500 group-hover/spot:opacity-100"
        style={{ background: "radial-gradient(420px circle at var(--sx, 50%) var(--sy, 0%), rgb(201 164 100 / 0.12), transparent 60%)" }}
      />
      {children}
    </Comp>
  );
}
