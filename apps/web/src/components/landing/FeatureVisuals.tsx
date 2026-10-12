"use client";
import * as React from "react";
import { motion, useReducedMotion } from "motion/react";

const EASE = [0.16, 1, 0.3, 1] as const;

/** Isometric wireframe tower that draws itself in when scrolled into view. */
export function WireframeBuilding({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const { structure, fins } = React.useMemo(() => {
    const S = 13;
    const P = (x: number, y: number, z: number) => `${(200 + (x - z) * 0.866 * S).toFixed(1)},${(205 + (x + z) * 0.5 * S - y * S).toFixed(1)}`;
    // visible edges of an axis-aligned box (viewer looks at the +x / +z faces)
    const box = (x0: number, z0: number, w: number, d: number, y0: number, y1: number) => {
      const p = (x: number, y: number, z: number) => P(x0 + x, y, z0 + z);
      return [
        `M${p(0, y1, 0)} L${p(w, y1, 0)} L${p(w, y1, d)} L${p(0, y1, d)} Z`,
        `M${p(w, y0, 0)} L${p(w, y1, 0)}`,
        `M${p(w, y0, d)} L${p(w, y1, d)}`,
        `M${p(0, y0, d)} L${p(0, y1, d)}`,
        `M${p(w, y0, 0)} L${p(w, y0, d)} L${p(0, y0, d)}`,
      ];
    };
    const FLOORS = 11;
    const base = 1.4;
    const top = base + FLOORS * 0.9;
    const t = (x: number, y: number, z: number) => P(1 + x, y, 1 + z);
    const structure = [
      ...box(0, 0, 6, 6, 0, base),
      ...box(1, 1, 4, 4, base, top),
      ...Array.from({ length: FLOORS - 1 }, (_, i) => {
        const y = base + (i + 1) * 0.9;
        return `M${t(4, y, 0)} L${t(4, y, 4)} L${t(0, y, 4)}`;
      }),
    ];
    const fins = [
      ...Array.from({ length: 7 }, (_, i) => `M${t(4, base, 0.5 + i * 0.5)} L${t(4, top, 0.5 + i * 0.5)}`),
      ...Array.from({ length: 7 }, (_, i) => `M${t(0.5 + i * 0.5, base, 4)} L${t(0.5 + i * 0.5, top, 4)}`),
      `M${t(3.2, top, 3.2)} L${t(3.2, top + 2.6, 3.2)}`,
    ];
    return { structure, fins };
  }, []);

  return (
    <svg viewBox="0 0 400 300" className={className} aria-hidden fill="none">
      <defs>
        <linearGradient id="wf-gold" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#8e6e3c" />
          <stop offset="1" stopColor="#e6cb8f" />
        </linearGradient>
      </defs>
      {structure.map((d, i) => (
        <motion.path
          key={`s${i}`}
          d={d}
          className="stroke-ink-400"
          strokeWidth={1}
          strokeLinejoin="round"
          initial={reduce ? false : { pathLength: 0, opacity: 0 }}
          whileInView={{ pathLength: 1, opacity: 1 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.9, delay: 0.04 * i, ease: EASE }}
        />
      ))}
      {fins.map((d, i) => (
        <motion.path
          key={`f${i}`}
          d={d}
          stroke="url(#wf-gold)"
          strokeWidth={1.4}
          strokeLinecap="round"
          initial={reduce ? false : { pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 1.1, delay: 0.7 + 0.04 * i, ease: EASE }}
        />
      ))}
    </svg>
  );
}

/** Handwritten signature that draws itself (E-IMZO card). */
export function SignatureDraw({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 260 70" className={className} aria-hidden fill="none">
      <motion.path
        d="M8 48 C 22 18, 34 14, 38 34 S 46 60, 58 40 S 72 12, 80 30 S 86 58, 100 44 C 112 32, 118 30, 126 40 C 134 50, 142 50, 150 38 C 158 26, 166 24, 170 36 C 174 48, 182 52, 196 42 C 210 32, 226 30, 252 34"
        stroke="#c9a464"
        strokeWidth={2.2}
        strokeLinecap="round"
        initial={reduce ? false : { pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 2, ease: [0.65, 0, 0.35, 1] }}
      />
    </svg>
  );
}

export function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-1.5 rounded-full bg-gold-400"
          animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </span>
  );
}

/** Animated horizontal bar (trust breakdown demo). */
export function DemoBar({ value, max, delay = 0 }: { value: number; max: number; delay?: number }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-fg/8">
      <motion.div
        className="h-full rounded-full bg-gold-gradient"
        initial={{ width: 0 }}
        whileInView={{ width: `${(value / max) * 100}%` }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, delay, ease: EASE }}
      />
    </div>
  );
}
