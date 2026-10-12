"use client";
import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { Clock, CloseCircle, SearchStatus, ShieldCross, TimerPause, Verify, Warning2 } from "iconsax-reactjs";
import { cn } from "@/lib/utils";

export type SealStatus = "VERIFIED" | "PENDING" | "EXPIRED" | "REVOKED" | "REJECTED" | "NOT_FOUND" | "UNAVAILABLE";

const TONE: Record<SealStatus, "success" | "warning" | "danger" | "info"> = {
  VERIFIED: "success",
  PENDING: "warning",
  EXPIRED: "danger",
  REVOKED: "danger",
  REJECTED: "danger",
  NOT_FOUND: "danger",
  UNAVAILABLE: "info",
};

const ICON = {
  VERIFIED: Verify,
  PENDING: Clock,
  EXPIRED: TimerPause,
  REVOKED: CloseCircle,
  REJECTED: ShieldCross,
  NOT_FOUND: SearchStatus,
  UNAVAILABLE: Warning2,
} as const;

const COLOR = { success: "var(--color-success)", warning: "var(--color-warning)", danger: "var(--color-danger)", info: "var(--color-info)" };

/** Big animated verification seal: rotating engraved ring, drawn border, icon pop. */
export function CertificateSeal({ status, label, className }: { status: SealStatus; label: string; className?: string }) {
  const reduce = useReducedMotion();
  const uid = React.useId().replace(/:/g, "");
  const tone = TONE[status];
  const color = COLOR[tone];
  const Icon = ICON[status];
  const ring = `EKA BUILD  •  ${label.toUpperCase()}  •  EKA BUILD  •  ${label.toUpperCase()}  •  `;

  return (
    <div className={cn("relative size-44 shrink-0 sm:size-52", className)} style={{ color }} role="img" aria-label={label}>
      {/* glow + pulse */}
      <div aria-hidden className="absolute inset-6 rounded-full opacity-30 blur-2xl" style={{ background: color }} />
      {tone === "success" && !reduce && <span aria-hidden className="absolute inset-10 animate-pulse-ring rounded-full" style={{ background: color, opacity: 0.25 }} />}

      <motion.svg
        viewBox="0 0 200 200"
        className="absolute inset-0 size-full"
        initial={reduce ? false : { scale: 0.6, opacity: 0, rotate: -40 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 140, damping: 16 }}
        aria-hidden
      >
        <defs>
          <path id={`seal-${uid}`} d="M100,100 m-80,0 a80,80 0 1,1 160,0 a80,80 0 1,1 -160,0" />
          <radialGradient id={`seal-fill-${uid}`} cx="0.5" cy="0.35" r="0.7">
            <stop offset="0" stopColor="currentColor" stopOpacity="0.28" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0.06" />
          </radialGradient>
        </defs>
        {/* engraved rotating text */}
        <g className={cn(!reduce && "animate-[spin_28s_linear_infinite]")} style={{ transformOrigin: "100px 100px", transformBox: "view-box" }}>
          <text fontSize="10.5" fontWeight={700} letterSpacing="2.4" fill="currentColor" opacity="0.75" fontFamily="'JetBrains Mono Variable', ui-monospace, monospace">
            <textPath href={`#seal-${uid}`}>{ring}</textPath>
          </text>
        </g>
        {/* scalloped ring */}
        <circle cx="100" cy="100" r="68" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="2 4" />
        {/* drawn border */}
        <motion.circle
          cx="100"
          cy="100"
          r="60"
          fill={`url(#seal-fill-${uid})`}
          stroke="currentColor"
          strokeWidth="2.5"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.1, delay: 0.2, ease: [0.65, 0, 0.35, 1] }}
          style={{ rotate: -90, transformOrigin: "100px 100px" }}
        />
        <circle cx="100" cy="100" r="52" fill="none" stroke="currentColor" strokeOpacity="0.4" strokeWidth="0.75" />
      </motion.svg>

      <motion.div
        className="absolute inset-0 grid place-items-center"
        initial={reduce ? false : { scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.55 }}
      >
        <Icon size={64} variant="Bold" />
      </motion.div>
    </div>
  );
}
