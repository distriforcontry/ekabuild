import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * EKA BUILD brand mark, redrawn from the signage:
 * a brushed-gold plate, "E K A" engraved on the left, and a "1"-shaped tower cut on the right.
 * The cut is a real mask, so the mark sits correctly on any background.
 *
 * Lockups follow the signage: the plate already says "EKA", so the wordmark next to / under it is only "BUILD".
 * `shimmer` sweeps a soft light across the metal (CSS keyframes `eka-sheen`, disabled for reduced motion).
 */

type MarkProps = {
  className?: string;
  title?: string;
  /** animated light sweep across the gold */
  shimmer?: boolean;
};

// The "1"/tower shape — flag, then stem down the right edge
export const TOWER_POINTS = "120,38 120,200 92,200 92,100 72,118 72,90";

export function LogoMark({ className, title = "EKA BUILD", shimmer = false }: MarkProps) {
  const uid = useId().replace(/:/g, "");
  const gold = `eka-gold-${uid}`;
  const goldHi = `eka-goldhi-${uid}`;
  const brush = `eka-brush-${uid}`;
  const cut = `eka-cut-${uid}`;
  const shape = `eka-shape-${uid}`;
  const sheen = `eka-sheen-${uid}`;
  const ink = `eka-ink-${uid}`;

  return (
    <svg viewBox="0 0 120 200" className={cn("eka-mark h-10 w-auto overflow-visible", className)} role="img" aria-label={title}>
      <title>{title}</title>
      <defs>
        <linearGradient id={gold} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F1DFB2" />
          <stop offset="0.38" stopColor="#D2B071" />
          <stop offset="0.72" stopColor="#B38D50" />
          <stop offset="1" stopColor="#8A6A38" />
        </linearGradient>
        <linearGradient id={goldHi} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FBF0D4" />
          <stop offset="0.45" stopColor="#DDBD7E" />
          <stop offset="1" stopColor="#9E7C44" />
        </linearGradient>
        {/* fine horizontal brushing */}
        <pattern id={brush} width="120" height="3" patternUnits="userSpaceOnUse">
          <rect width="120" height="1" fill="#fff" opacity="0.07" />
        </pattern>
        {/* engraved letters: deep graphite with a warm bottom edge */}
        <linearGradient id={ink} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2B2620" />
          <stop offset="1" stopColor="#14120F" />
        </linearGradient>
        <linearGradient id={sheen} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.75" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={cut} maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="200">
          <rect width="120" height="200" fill="#fff" />
          <polygon points={TOWER_POINTS} fill="#000" stroke="#000" strokeWidth="7" strokeLinejoin="miter" />
        </mask>
        {/* plate + tower without the gap — where the light may travel */}
        <mask id={shape} maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="200">
          <rect width="120" height="200" fill="#fff" />
          <polygon points={TOWER_POINTS} fill="none" stroke="#000" strokeWidth="7" strokeLinejoin="miter" />
        </mask>
      </defs>

      {/* plate (minus tower + gap) */}
      <g mask={`url(#${cut})`}>
        <rect width="120" height="200" fill={`url(#${gold})`} />
        <rect width="120" height="200" fill={`url(#${brush})`} />
      </g>
      {/* tower */}
      <polygon points={TOWER_POINTS} fill={`url(#${goldHi})`} />
      <polygon points={TOWER_POINTS} fill={`url(#${brush})`} />

      {/* engraved letters with a light lower lip (emboss) */}
      <g fontFamily="'Manrope Variable', Manrope, 'Helvetica Neue', Arial, sans-serif" fontWeight={800} fontSize="44" textAnchor="middle">
        <g fill="#FFF3D6" opacity="0.55" transform="translate(0 1.2)">
          <text x="34" y="62">E</text>
          <text x="34" y="122">K</text>
          <text x="34" y="182">A</text>
        </g>
        <g fill={`url(#${ink})`}>
          <text x="34" y="62">E</text>
          <text x="34" y="122">K</text>
          <text x="34" y="182">A</text>
        </g>
      </g>

      {shimmer && (
        <g mask={`url(#${shape})`} style={{ mixBlendMode: "overlay" }}>
          <g transform="skewX(-18)">
            <rect className="eka-sheen" x="-80" y="-20" width="46" height="240" fill={`url(#${sheen})`} />
          </g>
        </g>
      )}
    </svg>
  );
}

type LogoProps = {
  className?: string;
  variant?: "horizontal" | "stacked" | "mark";
  /** small line under the wordmark */
  tagline?: boolean;
  /** translated tagline text (defaults to the Uzbek "Ishonchli qurilish") */
  taglineText?: string;
  shimmer?: boolean;
  /** size of the mark in the horizontal lockup */
  size?: "sm" | "md" | "lg";
};

/** "BUILD" wordmark in brushed gold (optionally shimmering) */
export function Wordmark({ className, shimmer = false }: { className?: string; shimmer?: boolean }) {
  return (
    <span
      className={cn(
        "font-sans font-bold uppercase leading-none tracking-[0.42em] [padding-left:0.42em]",
        shimmer ? "text-gold-shimmer" : "text-gold-gradient",
        className,
      )}
    >
      Build
    </span>
  );
}

export function Logo({ className, variant = "horizontal", tagline = false, taglineText = "Ishonchli qurilish", shimmer = true, size = "md" }: LogoProps) {
  if (variant === "mark") return <LogoMark className={className} shimmer={shimmer} />;

  if (variant === "stacked") {
    return (
      <div className={cn("inline-flex flex-col items-center gap-4", className)}>
        <LogoMark className="h-24" shimmer={shimmer} />
        <Wordmark className="text-xl" shimmer={shimmer} />
        {tagline && <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-ink-400">{taglineText}</span>}
      </div>
    );
  }

  const markH = size === "sm" ? "h-8" : size === "lg" ? "h-12" : "h-10";
  const wordSize = size === "sm" ? "text-[13px]" : size === "lg" ? "text-lg" : "text-[15px]";
  return (
    <div className={cn("group/logo inline-flex items-center gap-3.5", className)}>
      <LogoMark className={cn(markH, "transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover/logo:-translate-y-0.5")} shimmer={shimmer} />
      <span aria-hidden className="h-7 w-px bg-gradient-to-b from-transparent via-gold-500/50 to-transparent" />
      <span className="flex flex-col gap-1.5">
        <Wordmark className={wordSize} shimmer={shimmer} />
        {tagline && <span className="text-[9px] font-semibold uppercase tracking-[0.28em] text-ink-400 [padding-left:0.1em]">{taglineText}</span>}
      </span>
    </div>
  );
}
