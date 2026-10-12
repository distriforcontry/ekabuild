"use client";
import * as React from "react";
import { motion, useInView, useMotionValue, useSpring, useReducedMotion } from "motion/react";

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

/** Number that counts up when scrolled into view. */
export function CountUp({ value, duration = 1.6, format }: { value: number; duration?: number; format?: (n: number) => string }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { duration: duration * 1000, bounce: 0 });
  const [display, setDisplay] = React.useState("0");

  React.useEffect(() => {
    if (inView) mv.set(value);
  }, [inView, value, mv]);

  React.useEffect(
    () =>
      spring.on("change", (v) => {
        const n = Math.round(v);
        setDisplay(format ? format(n) : new Intl.NumberFormat("uz-UZ").format(n).replace(/,/g, " "));
      }),
    [spring, format],
  );

  return <span ref={ref}>{display}</span>;
}
