"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h);
}

/** Project cover image, or an elegant generated blueprint placeholder with the project initial. */
export function ProjectCover({
  src,
  name,
  seed,
  floors = 12,
  className,
  imgClassName,
  eager,
  showInitial = true,
}: {
  src?: string | null;
  name: string;
  seed?: string;
  floors?: number;
  className?: string;
  imgClassName?: string;
  eager?: boolean;
  showInitial?: boolean;
}) {
  const [failed, setFailed] = React.useState(false);
  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        onError={() => setFailed(true)}
        className={cn("size-full object-cover", className, imgClassName)}
      />
    );
  }
  return <CoverPlaceholder name={name} seed={seed ?? name} floors={floors} className={className} showInitial={showInitial} />;
}

export function CoverPlaceholder({
  name,
  seed,
  floors = 12,
  className,
  showInitial = true,
}: {
  name: string;
  seed: string;
  floors?: number;
  className?: string;
  showInitial?: boolean;
}) {
  const h = hash(seed);
  const glowX = [18, 50, 82][h % 3];
  const mainH = Math.min(232, 96 + Math.max(1, floors) * 6);
  const leftH = 70 + (h % 70);
  const rightH = 90 + ((h >> 3) % 80);
  const initial = (name.trim()[0] ?? "E").toUpperCase();
  const rows = Math.floor((mainH - 20) / 11);

  return (
    <div className={cn("relative isolate size-full overflow-hidden bg-ink-850", className)} aria-hidden>
      <div
        className="absolute inset-0"
        style={{ background: `radial-gradient(120% 85% at ${glowX}% 0%, rgb(201 164 100 / 0.22), transparent 62%)` }}
      />
      <div className="bg-blueprint absolute inset-0 opacity-80" />
      <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 size-full">
        <g strokeWidth="1.2" fill="none">
          {/* back towers */}
          <rect x="44" y={292 - leftH} width="78" height={leftH} className="fill-ink-800/70 stroke-gold-500/35" />
          <rect x="282" y={292 - rightH} width="70" height={rightH} className="fill-ink-800/70 stroke-gold-500/35" />
          {/* main tower */}
          <rect x="148" y={292 - mainH} width="108" height={mainH} className="fill-ink-800 stroke-gold-400/70" />
          {Array.from({ length: rows }).map((_, i) => (
            <line key={i} x1="156" x2="248" y1={292 - mainH + 14 + i * 11} y2={292 - mainH + 14 + i * 11} className="stroke-gold-500/20" />
          ))}
          {[170, 192, 214, 236].map((x) => (
            <line key={x} x1={x} x2={x} y1={292 - mainH + 6} y2="292" className="stroke-gold-500/15" />
          ))}
          <line x1="140" x2="264" y1={292 - mainH} y2={292 - mainH} className="stroke-gold-300/80" strokeWidth="2" />
          {/* crane */}
          <path d={`M330 ${292 - rightH} V${292 - rightH - 46} H230 M330 ${292 - rightH - 46} H360`} className="stroke-gold-500/40" strokeDasharray="3 3" />
          <line x1="0" x2="400" y1="292.5" y2="292.5" className="stroke-gold-500/50" />
        </g>
      </svg>
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink-950/70 to-transparent" />
      {showInitial && (
        <span className="text-gold-gradient absolute bottom-1 left-5 font-display text-[6.5rem] leading-none opacity-90 select-none">
          {initial}
        </span>
      )}
    </div>
  );
}
