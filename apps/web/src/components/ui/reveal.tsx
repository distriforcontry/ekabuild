"use client";
import * as React from "react";
import { animate, motion, useInView, useReducedMotion } from "motion/react";

/** Fade/slide-in on scroll. */
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
  const Comp = motion[as];
  return (
    <Comp
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </Comp>
  );
}

/** Number that counts up when scrolled into view (re-animates from the previous value when `value` changes). */
export function CountUp({ value, duration = 1.6, format }: { value: number; duration?: number; format?: (n: number) => string }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
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
