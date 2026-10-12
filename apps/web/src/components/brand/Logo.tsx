import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * EKA BUILD brand mark, redrawn from the signage:
 * a brushed-gold plate, "E K A" stacked on the left, and a "1"-shaped building cut on the right.
 * The cut is a real mask, so the mark sits correctly on any background.
 */

type MarkProps = {
  className?: string;
  /** colour of the engraved letters */
  letterColor?: string;
  title?: string;
};

// The "1"/tower shape — flag, then stem down the right edge
export const TOWER_POINTS = "120,38 120,200 92,200 92,100 72,118 72,90";

export function LogoMark({ className, letterColor = "#141416", title = "EKA BUILD" }: MarkProps) {
  const uid = useId().replace(/:/g, "");
  const gold = `eka-gold-${uid}`;
  const goldHi = `eka-goldhi-${uid}`;
  const sheen = `eka-sheen-${uid}`;
  const cut = `eka-cut-${uid}`;

  return (
    <svg viewBox="0 0 120 200" className={cn("h-10 w-auto", className)} role="img" aria-label={title}>
      <title>{title}</title>
      <defs>
        <linearGradient id={gold} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E9D5A8" />
          <stop offset="0.45" stopColor="#C9A464" />
          <stop offset="1" stopColor="#8E6E3C" />
        </linearGradient>
        <linearGradient id={goldHi} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F4E9D2" />
          <stop offset="0.5" stopColor="#D4AF6A" />
          <stop offset="1" stopColor="#9B7A43" />
        </linearGradient>
        {/* subtle brushed-metal streaks */}
        <linearGradient id={sheen} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.18" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={cut} maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="200">
          <rect width="120" height="200" fill="#fff" />
          <polygon points={TOWER_POINTS} fill="#000" stroke="#000" strokeWidth="7" strokeLinejoin="miter" />
        </mask>
      </defs>

      {/* plate (minus tower + gap) */}
      <g mask={`url(#${cut})`}>
        <rect width="120" height="200" fill={`url(#${gold})`} />
        <rect width="120" height="200" fill={`url(#${sheen})`} opacity="0.6" />
      </g>
      {/* tower */}
      <polygon points={TOWER_POINTS} fill={`url(#${goldHi})`} />

      {/* engraved letters */}
      <g
        fill={letterColor}
        fontFamily="'Manrope Variable', Manrope, 'Helvetica Neue', Arial, sans-serif"
        fontWeight={800}
        fontSize="44"
        textAnchor="middle"
      >
        <text x="34" y="62">E</text>
        <text x="34" y="122">K</text>
        <text x="34" y="182">A</text>
      </g>
    </svg>
  );
}

type LogoProps = {
  className?: string;
  variant?: "horizontal" | "stacked" | "mark";
  /** show the small "verified construction" tagline under the wordmark */
  tagline?: boolean;
};

export function Logo({ className, variant = "horizontal", tagline = false }: LogoProps) {
  if (variant === "mark") return <LogoMark className={className} />;

  if (variant === "stacked") {
    return (
      <div className={cn("inline-flex flex-col items-center gap-3", className)}>
        <LogoMark className="h-24" />
        <span className="font-sans text-xl font-semibold tracking-[0.42em] text-gold-300 pl-[0.42em]">BUILD</span>
      </div>
    );
  }

  return (
    <div className={cn("inline-flex items-center gap-3", className)}>
      <LogoMark className="h-9" />
      <div className="flex flex-col leading-none">
        <span className="font-sans text-[17px] font-extrabold tracking-[0.18em] text-stone-100">
          EKA<span className="text-gold-400"> BUILD</span>
        </span>
        {tagline && (
          <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.24em] text-ink-300">
            Ishonchli qurilish
          </span>
        )}
      </div>
    </div>
  );
}
