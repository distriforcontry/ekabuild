"use client";
import { motion } from "motion/react";
import { trustLevel } from "@eka/shared";
import { cn } from "@/lib/utils";

const TONE_COLOR = { success: "#3FB68B", info: "#5B9BD5", warning: "#E8B04B", danger: "#E5484D" } as const;

/** Circular trust score gauge (0–100). */
export function TrustRing({ score, size = 72, stroke = 6, showLabel = false, className }: { score: number; size?: number; stroke?: number; showLabel?: boolean; className?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const level = trustLevel(score);
  const color = TONE_COLOR[level.tone];
  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-line-strong)" strokeWidth={stroke} fill="none" />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            whileInView={{ strokeDashoffset: c - (c * Math.max(0, Math.min(100, score))) / 100 }}
            viewport={{ once: true }}
            transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
            style={{ filter: `drop-shadow(0 0 6px ${color}66)` }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span className="font-mono font-semibold text-stone-100" style={{ fontSize: size * 0.28 }}>
            {score}
          </span>
        </div>
      </div>
      {showLabel && (
        <div className="leading-tight">
          <div className="text-xs text-ink-400">Ishonch bali</div>
          <div className="text-sm font-semibold" style={{ color }}>
            {level.label}
          </div>
        </div>
      )}
    </div>
  );
}
