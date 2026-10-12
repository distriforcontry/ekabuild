"use client";
import * as React from "react";
import { animate, motion, useInView, useReducedMotion } from "motion/react";

/** Fade/slide-in on scroll. */
/**
 * True once the element has entered the viewport — or has already been scrolled past (fast scroll, anchor jump,
 * restored scroll position), so content can never stay hidden.
 */
function useSeen(ref: React.RefObject<Element | null>, margin: string) {
  const inView = useInView(ref, { once: true, margin: margin as never });
  const [passed, setPassed] = React.useState(false);
  React.useEffect(() => {
    if (inView || passed) return;
    const check = () => {
      const el = ref.current;
      if (el && el.getBoundingClientRect().bottom < 0) setPassed(true);
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    return () => window.removeEventListener("scroll", check);
  }, [ref, inView, passed]);
  return inView || passed;
}

export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "section" | "li" | "span";
}) {
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLElement>(null);
  const seen = useSeen(ref, "-60px");
  const Comp = motion[as] as typeof motion.div;
  return (
    <Comp
      ref={ref as React.RefObject<HTMLDivElement>}
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      animate={seen ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </Comp>
  );
}

/** Number that counts up when scrolled into view (re-animates from the previous value when `value` changes). */
export function CountUp({ value, duration = 1.6, format }: { value: number; duration?: number; format?: (n: number) => string }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  // never stays at 0: also starts when the tile was scrolled past (fast jump, anchor link)
  const inView = useSeen(ref, "0px 0px 120px 0px");
  const reduce = useReducedMotion();
  const fmt = React.useCallback((n: number) => (format ? format(n) : new Intl.NumberFormat("uz-UZ").format(n).replace(/,/g, " ")), [format]);
  const from = React.useRef(0);
  const [display, setDisplay] = React.useState(() => fmt(0));

  React.useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setDisplay(fmt(value));
      from.current = value;
      return;
    }
    const controls = animate(from.current, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(fmt(Math.round(v))),
    });
    from.current = value;
    return () => controls.stop();
  }, [inView, value, duration, reduce, fmt]);

  return <span ref={ref}>{display}</span>;
}
