"use client";
import * as React from "react";
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useSpring, type MotionValue } from "motion/react";
import { Buildings2, I3DRotate, PenTool2, SearchNormal1, ShieldTick } from "iconsax-reactjs";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/misc";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

const ICONS = [SearchNormal1, ShieldTick, I3DRotate, PenTool2, Buildings2];

type Step = { title: string; text: string };

export function HowItWorks() {
  const { t, raw } = useI18n();
  const steps = raw<Step[]>("landing.how.steps") ?? [];
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "end 55%"] });
  const progress = useSpring(scrollYProgress, { stiffness: 110, damping: 28, mass: 0.4 });

  return (
    <section id="how" className="relative isolate scroll-mt-24 overflow-hidden border-y border-line bg-ink-900/30 py-24 md:py-32">
      <div aria-hidden className="bg-blueprint pointer-events-none absolute inset-0 -z-10 opacity-60 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading align="center" eyebrow={t("landing.how.eyebrow")} title={t("landing.how.title")} description={t("landing.how.description")} />
        </Reveal>

        <ol ref={ref} className="relative mt-16 grid gap-8 lg:mt-20 lg:grid-cols-5 lg:gap-6">
          {/* connecting line — horizontal on desktop, vertical on mobile */}
          <div aria-hidden className="absolute left-[10%] right-[10%] top-8 hidden h-px bg-line-strong lg:block">
            <motion.div style={{ scaleX: reduce ? 1 : progress }} className="h-full origin-left bg-gold-gradient shadow-[0_0_12px_rgb(201_164_100/0.6)]" />
          </div>
          <div aria-hidden className="absolute bottom-8 left-8 top-8 w-px bg-line-strong lg:hidden">
            <motion.div style={{ scaleY: reduce ? 1 : progress }} className="h-full w-full origin-top bg-gold-gradient" />
          </div>

          {steps.map((s, i) => (
            <StepItem key={i} index={i} total={steps.length} step={s} progress={progress} reduce={!!reduce} />
          ))}
        </ol>
      </div>
    </section>
  );
}

function StepItem({ index, total, step, progress, reduce }: { index: number; total: number; step: Step; progress: MotionValue<number>; reduce: boolean }) {
  const Icon = ICONS[index % ICONS.length]!;
  const threshold = total > 1 ? index / (total - 1) : 0;
  const [active, setActive] = React.useState(reduce);
  useMotionValueEvent(progress, "change", (v) => {
    if (!reduce) setActive(v >= threshold - 0.03);
  });

  return (
    <motion.li
      className="relative flex gap-5 pl-0 lg:flex-col lg:items-center lg:text-center"
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="relative z-10 shrink-0">
        <div
          className={cn(
            "grid size-16 place-items-center rounded-2xl border transition-all duration-500",
            active ? "border-gold-400/70 bg-gold-gradient text-onyx shadow-glow" : "border-line-strong bg-ink-900 text-ink-300",
          )}
        >
          <Icon size={26} variant={active ? "Bold" : "Linear"} />
        </div>
        <span
          className={cn(
            "absolute -right-2 -top-2 grid size-6 place-items-center rounded-full border font-mono text-[10px] font-bold transition-colors duration-500",
            active ? "border-gold-400 bg-ink-950 text-gold-300" : "border-line-strong bg-ink-900 text-ink-400",
          )}
        >
          {index + 1}
        </span>
      </div>
      <div className="pt-1 lg:pt-6">
        <h3 className={cn("text-lg font-semibold transition-colors duration-500", active ? "text-stone-100" : "text-ink-200")}>{step.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-ink-300 lg:mx-auto lg:max-w-[22ch]">{step.text}</p>
      </div>
    </motion.li>
  );
}
