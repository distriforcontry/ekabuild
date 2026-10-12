"use client";
import * as React from "react";
import Link from "next/link";
import { AnimatePresence, animate, motion, useInView, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform } from "motion/react";
import { ArrowRight, ArrowSwapHorizontal, Buildings2 } from "iconsax-reactjs";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { Container } from "../primitives";
import { InView, Magnetic } from "../motion";
import { RevealHeading } from "../text";
import { RENDERS, type RenderKey } from "../renders";

const STAGES: { key: RenderKey; pct: number }[] = [
  { key: "stage-15", pct: 15 },
  { key: "stage-40", pct: 40 },
  { key: "stage-65", pct: 65 },
  { key: "stage-85", pct: 85 },
  { key: "stage-100", pct: 100 },
];

/**
 * "Qurilish jarayonini kuzating" — before/after compare of the same tower's construction stages
 * (Cycles renders), a stage timeline that auto-advances while visible, and a draggable / keyboard
 * accessible split. The split is drawn with two opposing translateX layers (transform only).
 */
export function ProgressBanner({ className }: { className?: string }) {
  const { t, raw } = useI18n();
  const names = raw<string[]>("landing.banners.progress.stages") ?? [];
  const reduce = useReducedMotion();
  const frameRef = React.useRef<HTMLDivElement>(null);
  const inView = useInView(frameRef, { amount: 0.45 });
  const [active, setActive] = React.useState(3);
  const [touched, setTouched] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  const [value, setValue] = React.useState(50);
  const split = useMotionValue(50);
  useMotionValueEvent(split, "change", (v) => setValue(Math.round(v)));

  // the "after" layer is shifted right by split% and its image shifted back by the same amount → visible right of the split
  const outerX = useTransform(split, (v) => `${v}%`);
  const innerX = useTransform(split, (v) => `${-v}%`);
  const handleX = useTransform(split, (v) => `${v}%`);

  // one-off demo sweep the first time the frame is in view
  const demoed = React.useRef(false);
  React.useEffect(() => {
    if (!inView || demoed.current || reduce) return;
    demoed.current = true;
    const controls = animate(split, [50, 26, 72, 50], { duration: 2.6, ease: [0.65, 0, 0.35, 1], delay: 0.4 });
    return () => controls.stop();
  }, [inView, reduce, split]);

  // auto-advance through the stages while visible (until the visitor takes over)
  React.useEffect(() => {
    if (!inView || touched || hover || reduce) return;
    const id = setInterval(() => setActive((a) => (a >= STAGES.length - 1 ? 1 : a + 1)), 3200);
    return () => clearInterval(id);
  }, [inView, touched, hover, reduce]);

  const before = RENDERS["stage-15"];
  const stage = STAGES[active]!;
  const after = RENDERS[stage.key];
  const stageName = names[active] ?? "";

  return (
    <section className={cn("relative isolate overflow-hidden py-24 md:py-32", className)}>
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute right-[-15%] top-10 size-[620px] rounded-full bg-gold-500 opacity-[0.08] blur-[140px]" />
      </div>
      <Container>
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <RevealHeading
            eyebrow={t("landing.banners.progress.eyebrow")}
            title={t("landing.banners.progress.title")}
            accent={t("landing.banners.progress.accent")}
            description={t("landing.banners.progress.text")}
          />
          <InView className="eka-iv-up flex shrink-0 items-center gap-3" style={{ "--d": "300ms" } as React.CSSProperties}>
            <span className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1.5 text-xs font-semibold text-success">
              <span className="relative flex size-2">
                <span className="absolute inset-0 animate-ping rounded-full bg-success opacity-60" />
                <span className="relative size-2 rounded-full bg-success" />
              </span>
              {t("landing.banners.progress.live")}
            </span>
            <Magnetic>
              <Button asChild variant="outline" size="lg" className="group">
                <Link href="/projects?status=UNDER_CONSTRUCTION">
                  <Buildings2 variant="Bulk" />
                  {t("landing.banners.progress.cta")}
                  <ArrowRight className="transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </Magnetic>
          </InView>
        </div>

        {/* compare frame */}
        <InView className="eka-iv-scale mt-12" style={{ "--d": "150ms" } as React.CSSProperties}>
          <div
            ref={frameRef}
            onPointerEnter={() => setHover(true)}
            onPointerLeave={() => setHover(false)}
            className="eka-dark group relative aspect-[4/3] overflow-hidden rounded-[1.75rem] border border-gold-500/25 bg-ink-850 shadow-lift sm:aspect-[16/9] lg:aspect-[16/8]"
          >
            {/* before */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={before.src}
              srcSet={before.srcSet}
              sizes="(min-width: 1280px) 1200px, 100vw"
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 size-full object-cover"
              style={{ backgroundImage: `url("${before.lqip}")`, backgroundSize: "cover" }}
            />
            {/* after (current stage), revealed to the right of the split */}
            <motion.div className="absolute inset-0 overflow-hidden will-change-transform" style={{ x: reduce ? "0%" : outerX }}>
              <motion.div className="absolute inset-0 will-change-transform" style={{ x: reduce ? "0%" : innerX }}>
                <AnimatePresence initial={false}>
                  <motion.img
                    key={stage.key}
                    src={after.src}
                    srcSet={after.srcSet}
                    sizes="(min-width: 1280px) 1200px, 100vw"
                    alt=""
                    loading="lazy"
                    decoding="async"
                    initial={{ opacity: 0, scale: 1.03 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute inset-0 size-full object-cover"
                    style={{ backgroundImage: `url("${after.lqip}")`, backgroundSize: "cover" }}
                  />
                </AnimatePresence>
              </motion.div>
            </motion.div>

            <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0b0b0c]/70 via-transparent to-[#0b0b0c]/25" />

            {/* labels */}
            <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-[#f4f1ea]/15 bg-[#0b0b0c]/55 px-3 py-1.5 text-xs font-semibold text-[#ece6da] backdrop-blur-md sm:left-6 sm:top-6">
              {t("landing.banners.progress.before")} · <span className="font-mono">15%</span>
            </div>
            <div className="pointer-events-none absolute right-4 top-4 flex items-center gap-2 rounded-full border border-[#e0c285]/35 bg-[#0b0b0c]/55 px-3 py-1.5 text-xs font-semibold text-[#f1dfb2] backdrop-blur-md sm:right-6 sm:top-6">
              {t("landing.banners.progress.after")}
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={stage.pct}
                  initial={{ y: 8, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -8, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="font-mono"
                >
                  {stage.pct}%
                </motion.span>
              </AnimatePresence>
            </div>

            {/* handle */}
            {!reduce && (
              <motion.div aria-hidden className="pointer-events-none absolute inset-0 will-change-transform" style={{ x: handleX }}>
                <div className="absolute inset-y-0 -left-px w-0.5 bg-gradient-to-b from-[#f1dfb2]/0 via-[#f1dfb2] to-[#f1dfb2]/0 shadow-[0_0_18px_rgb(233_213_168/0.8)]" />
                <div className="absolute left-0 top-1/2 grid size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-[#fff1cc]/70 bg-gradient-to-br from-[#e9d5a8] via-[#c9a464] to-[#8e6e3c] text-[#1f1a12] shadow-[0_10px_40px_-8px_rgb(201_164_100/0.8)] transition-transform duration-300 group-hover:scale-110">
                  <ArrowSwapHorizontal size={20} variant="Bold" />
                </div>
              </motion.div>
            )}

            {/* native range = drag + keyboard + screen readers */}
            {!reduce && (
              <input
                type="range"
                min={2}
                max={98}
                value={value}
                aria-label={t("landing.banners.progress.compareLabel")}
                aria-valuetext={`${value}%`}
                onChange={(e) => {
                  setTouched(true);
                  split.stop();
                  split.set(Number(e.target.value));
                }}
                className="absolute inset-0 size-full cursor-ew-resize opacity-0"
              />
            )}

            <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-[#f4f1ea]/12 bg-[#0b0b0c]/50 px-3 py-1 text-[11px] text-[#d6d0c4] opacity-90 backdrop-blur-md transition-opacity group-hover:opacity-0 sm:bottom-6">
              {t("landing.banners.progress.drag")}
            </div>
          </div>
        </InView>

        {/* stage timeline */}
        <InView as="ol" className="relative mt-6 grid grid-cols-5 gap-2 sm:gap-3" aria-label={t("landing.banners.progress.compareLabel")}>
          <div aria-hidden className="absolute -top-3 left-0 right-0 h-px bg-line-strong">
            <motion.div
              className="h-full origin-left bg-gold-gradient shadow-[0_0_10px_rgb(201_164_100/0.6)]"
              animate={{ scaleX: (active + 1) / STAGES.length }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          {STAGES.map((s, i) => {
            const r = RENDERS[s.key];
            const on = i === active;
            return (
              <li key={s.key} className="eka-iv-up" style={{ "--d": `${200 + i * 80}ms` } as React.CSSProperties}>
                <button
                  type="button"
                  onClick={() => {
                    setTouched(true);
                    setActive(i);
                  }}
                  aria-pressed={on}
                  aria-label={t("landing.banners.progress.stageLabel", { name: names[i] ?? "" }) + ` · ${s.pct}%`}
                  className={cn(
                    "group/st relative block w-full cursor-pointer overflow-hidden rounded-xl border text-left transition-colors duration-300 sm:rounded-2xl",
                    on ? "border-gold-400/70" : "border-line hover:border-gold-500/40",
                  )}
                >
                  <span className="relative block aspect-[16/10] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={r.srcSet.split(", ")[1]?.split(" ")[0] ?? r.src}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className={cn("size-full object-cover transition-[scale,opacity] duration-700", on ? "scale-105 opacity-100" : "opacity-60 group-hover/st:opacity-90")}
                    />
                    {on && <motion.span layoutId="eka-stage-ring" className="absolute inset-0 rounded-[inherit] ring-2 ring-inset ring-gold-400/80" transition={{ type: "spring", stiffness: 380, damping: 34 }} />}
                  </span>
                  <span className="flex items-center justify-between gap-1 px-2 py-1.5 sm:px-3 sm:py-2">
                    <span className={cn("truncate text-[11px] font-semibold sm:text-xs", on ? "text-stone-100" : "text-ink-300")}>{names[i]}</span>
                    <span className={cn("hidden font-mono text-[10px] sm:inline", on ? "text-gold-300" : "text-ink-400")}>{s.pct}%</span>
                  </span>
                </button>
              </li>
            );
          })}
        </InView>
        <p className="sr-only" aria-live="polite">
          {t("landing.banners.progress.ready", { n: stage.pct })} — {stageName}
        </p>
      </Container>
    </section>
  );
}
