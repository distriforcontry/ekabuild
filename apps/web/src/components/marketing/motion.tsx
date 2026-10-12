"use client";
import * as React from "react";
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Motion toolkit for the public site. Everything animates transform/opacity only and turns itself off for
 * prefers-reduced-motion and for touch pointers (magnetic / tilt).
 */

const finePointer = () => typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

/* ───────────── InView: flags itself with [data-in] once visible (drives the CSS .eka-iv-* / .eka-words-iv) ───────────── */
type InViewProps = {
  as?: "div" | "section" | "header" | "li" | "ul" | "ol" | "span" | "article";
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  /** IntersectionObserver rootMargin */
  margin?: string;
  id?: string;
} & Omit<React.HTMLAttributes<HTMLElement>, "children" | "className" | "style" | "id">;

export function InView({ as = "div", className, style, children, margin = "0px 0px -12% 0px", id, ...rest }: InViewProps) {
  const ref = React.useRef<HTMLElement>(null);
  const [inView, setInView] = React.useState(false);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        // also reveal anything already scrolled past (fast scrolls / anchor jumps can skip the intersecting frame)
        if (entries.some((e) => e.isIntersecting || e.boundingClientRect.bottom < 0)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: margin, threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);
  return React.createElement(as, { ref, id, "data-in": inView ? "" : undefined, className, style, ...rest }, children);
}

/* ───────────── Magnetic: the element leans toward the cursor (primary CTAs) ───────────── */
export function Magnetic({ children, className, strength = 0.32 }: { children: React.ReactNode; className?: string; strength?: number }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 240, damping: 17, mass: 0.35 });
  const sy = useSpring(y, { stiffness: 240, damping: 17, mass: 0.35 });
  const onMove = (e: React.PointerEvent) => {
    if (reduce || e.pointerType !== "mouse" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * strength);
    y.set((e.clientY - (r.top + r.height / 2)) * strength * 1.2);
  };
  const reset = () => {
    x.set(0);
    y.set(0);
  };
  return (
    <motion.span ref={ref} onPointerMove={onMove} onPointerLeave={reset} style={{ x: sx, y: sy }} className={cn("inline-flex will-change-transform", className)}>
      {children}
    </motion.span>
  );
}

/* ───────────── Tilt: 3D tilt + cursor spotlight (cards, banner visuals) ───────────── */
export function Tilt({
  children,
  className,
  max = 6,
  spotlight = true,
  as = "div",
  disabled = false,
}: {
  children: React.ReactNode;
  className?: string;
  max?: number;
  spotlight?: boolean;
  as?: "div" | "li" | "article";
  /** keep the element flat (e.g. while an inner 3D viewer is being dragged) */
  disabled?: boolean;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 160, damping: 18, mass: 0.5 });
  const sry = useSpring(ry, { stiffness: 160, damping: 18, mass: 0.5 });
  const onMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty("--sx", `${px * 100}%`);
    el.style.setProperty("--sy", `${py * 100}%`);
    if (reduce || disabled) return;
    ry.set((px - 0.5) * 2 * max);
    rx.set(-(py - 0.5) * 2 * max);
  };
  const reset = () => {
    rx.set(0);
    ry.set(0);
  };
  React.useEffect(() => {
    if (disabled) {
      rx.set(0);
      ry.set(0);
    }
  }, [disabled, rx, ry]);
  const Comp = motion[as];
  return (
    <Comp
      ref={ref as React.Ref<never>}
      onPointerMove={onMove}
      onPointerLeave={reset}
      style={{ rotateX: srx, rotateY: sry, transformPerspective: 1100 }}
      className={cn("group/tilt relative will-change-transform [transform-style:preserve-3d]", className)}
    >
      {children}
      {spotlight && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 z-20 rounded-[inherit] opacity-0 transition-opacity duration-500 group-hover/tilt:opacity-100"
          style={{ background: "radial-gradient(520px circle at var(--sx, 50%) var(--sy, 0%), rgb(233 213 168 / 0.13), transparent 55%)" }}
        />
      )}
    </Comp>
  );
}

/* ───────────── Parallax: content drifts against the scroll ───────────── */
export function useParallax(range = 60): { ref: React.RefObject<HTMLDivElement | null>; y: MotionValue<number> | number } {
  const ref = React.useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [-range, range]);
  return { ref, y: reduce ? 0 : y };
}

/**
 * Full-bleed parallax backdrop: an oversized layer inside an overflow-hidden frame.
 * Put it as the first child of a `relative isolate overflow-hidden` section.
 */
export function ParallaxLayer({ children, className, range = 70, scale = 1.18 }: { children: React.ReactNode; className?: string; range?: number; scale?: number }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [-range, range]);
  return (
    <div ref={ref} aria-hidden className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)}>
      <motion.div className="absolute inset-0 will-change-transform" style={{ y: reduce ? 0 : y, scale }}>
        {children}
      </motion.div>
    </div>
  );
}

/** Element that drifts by `range` px over the section's scroll (use inside banners for depth). */
export function Drift({ children, className, range = 40, x = false }: { children: React.ReactNode; className?: string; range?: number; x?: boolean }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const v = useTransform(scrollYProgress, [0, 1], [range, -range]);
  return (
    <motion.div ref={ref} className={className} style={reduce ? undefined : x ? { x: v } : { y: v }}>
      {children}
    </motion.div>
  );
}

/* ───────────── Stagger: children rise one after another when scrolled into view ───────────── */
const staggerParent = { hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } } };
const staggerChild = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { duration: 0.85, ease: [0.16, 1, 0.3, 1] as const } },
};

export function Stagger({
  children,
  className,
  as = "div",
  amount = 0.15,
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "ul" | "ol";
  amount?: number;
}) {
  const reduce = useReducedMotion();
  const Comp = motion[as];
  return (
    <Comp className={className} variants={staggerParent} initial={reduce ? false : "hidden"} whileInView="show" viewport={{ once: true, amount }}>
      {children}
    </Comp>
  );
}

export function StaggerItem({ children, className, as = "div" }: { children: React.ReactNode; className?: string; as?: "div" | "li" | "article" }) {
  const Comp = motion[as];
  return (
    <Comp className={className} variants={staggerChild}>
      {children}
    </Comp>
  );
}
