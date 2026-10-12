"use client";
import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Icon as IconType } from "iconsax-reactjs";
import { ClipboardTick, Map1, PenTool, ScanBarcode, ShieldTick, Verify } from "iconsax-reactjs";
import { LogoMark } from "@/components/brand/Logo";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";

const FACT_ICONS: IconType[] = [ScanBarcode, Map1, PenTool, ShieldTick, ClipboardTick];
const ROTATE_MS = 5500;

/** Right-hand brand panel of the auth screens: logo, blueprint grid, drifting gold glow, rotating trust facts. */
export function AuthBrandPanel({ className }: { className?: string }) {
  const { t, raw } = useI18n();
  const facts = raw<{ title: string; text: string }[]>("auth.brand.facts") ?? [];
  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);

  React.useEffect(() => {
    if (paused || facts.length < 2) return;
    const id = setTimeout(() => setIndex((i) => (i + 1) % facts.length), ROTATE_MS);
    return () => clearTimeout(id);
  }, [index, paused, facts.length]);

  const fact = facts[index];
  const FactIcon = FACT_ICONS[index % FACT_ICONS.length]!;

  return (
    <aside
      className={cn(
        "relative m-3 flex-col overflow-hidden rounded-[28px] border border-line bg-ink-900 shadow-card",
        className,
      )}
      aria-label={t("auth.brand.factsLabel")}
    >
      {/* layers */}
      <div className="bg-blueprint pointer-events-none absolute inset-0 opacity-90 [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_80%)]" />
      <div className="bg-noise pointer-events-none absolute inset-0" />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-[12%] size-[420px] rounded-full bg-gold-500/20 blur-[110px]"
        animate={{ x: [0, 80, -20, 0], y: [0, 40, 90, 0], scale: [1, 1.15, 0.95, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-20 size-[460px] rounded-full bg-gold-400/15 blur-[120px]"
        animate={{ x: [0, -60, 20, 0], y: [0, -50, -10, 0], scale: [1, 0.9, 1.1, 1] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* blueprint corner marks */}
      <CornerMarks />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col justify-between overflow-y-auto p-10 no-scrollbar xl:p-14">
        <div className="inline-flex items-center gap-2 self-start rounded-full border border-gold-500/25 bg-gold-500/[0.07] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-gold-300">
          <Verify size={14} variant="Bold" />
          {t("auth.brand.eyebrow")}
        </div>

        <div className="flex min-h-[170px] flex-1 items-center justify-center py-6">
          <div className="relative grid place-items-center">
            <span className="absolute size-40 animate-pulse-ring rounded-full border border-gold-500/30" aria-hidden />
            <span className="absolute size-40 animate-pulse-ring rounded-full border border-gold-500/20 [animation-delay:1.2s]" aria-hidden />
            <span className="absolute size-56 rounded-full bg-gold-500/10 blur-3xl" aria-hidden />
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="animate-float"
            >
              <LogoMark className="h-28 drop-shadow-[0_20px_40px_rgb(201_164_100/0.35)] xl:h-36 [@media(min-height:900px)]:h-44" />
            </motion.div>
          </div>
        </div>

        <div>
          <motion.h2
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-xl font-display text-4xl font-medium leading-[1.08] text-stone-100 xl:text-5xl"
          >
            {t("auth.brand.title")}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="mt-4 max-w-lg text-[15px] leading-relaxed text-ink-300"
          >
            {t("auth.brand.subtitle")}
          </motion.p>

          {fact && (
            <div
              className="glass mt-8 max-w-xl rounded-2xl p-5"
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
            >
              <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.24em] text-ink-400">{t("auth.brand.factsLabel")}</div>
              <div className="relative min-h-[92px]" aria-live="polite">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
                    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                    className="flex gap-4"
                  >
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gold-gradient text-onyx shadow-glow">
                      <FactIcon size={20} variant="Bold" />
                    </span>
                    <div>
                      <div className="font-semibold text-stone-100">{fact.title}</div>
                      <p className="mt-1 text-sm leading-relaxed text-ink-300">{fact.text}</p>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
              <div className="mt-4 flex items-center gap-1.5">
                {facts.map((f, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-label={f.title}
                    aria-current={i === index}
                    className="group relative h-1.5 flex-1 cursor-pointer overflow-hidden rounded-full bg-fg/10"
                  >
                    {i === index ? (
                      <motion.span
                        key={`${index}-${paused}`}
                        className="absolute inset-y-0 left-0 rounded-full bg-gold-400"
                        initial={{ width: paused ? "100%" : "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: paused ? 0 : ROTATE_MS / 1000, ease: "linear" }}
                      />
                    ) : (
                      <span className={cn("absolute inset-0 rounded-full transition", i < index ? "bg-gold-500/40" : "group-hover:bg-fg/10")} />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-2">
            {(["eimzo", "sha", "qr"] as const).map((b) => (
              <span key={b} className="rounded-full border border-line-strong bg-fg/[0.03] px-3 py-1 font-mono text-[11px] font-medium tracking-wider text-ink-300">
                {t(`auth.brand.badges.${b}`)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

function CornerMarks() {
  const mark = "pointer-events-none absolute size-6 border-gold-500/40";
  return (
    <>
      <span className={cn(mark, "left-5 top-5 border-l border-t")} aria-hidden />
      <span className={cn(mark, "bottom-5 left-5 border-b border-l")} aria-hidden />
      <span className={cn(mark, "bottom-5 right-5 border-b border-r")} aria-hidden />
    </>
  );
}
