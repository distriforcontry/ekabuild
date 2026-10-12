"use client";
import * as React from "react";
import Link from "next/link";
import { MotionConfig, motion } from "motion/react";
import { ArrowLeft, Call, ShieldTick } from "iconsax-reactjs";
import { Logo } from "@/components/brand/Logo";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useI18n } from "@/i18n/client";
import { AuthBrandPanel } from "./AuthBrandPanel";

/** Split-screen premium frame for /login, /register, /forgot. */
export function AuthFrame({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <MotionConfig reducedMotion="user">
      <div className="relative grid min-h-dvh bg-ink-950 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]">
        {/* subtle background for the form side */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden lg:right-[52%]" aria-hidden>
          <div className="absolute -left-40 -top-40 size-[420px] rounded-full bg-gold-500/[0.06] blur-[100px]" />
        </div>

        <div className="relative flex min-h-dvh flex-col px-4 pb-6 pt-5 sm:px-8 lg:px-12 xl:px-20">
          <header className="flex h-10 items-center pr-28">
            <Link href="/" className="group inline-flex items-center gap-3 rounded-xl" aria-label={t("auth.frame.backHome")}>
              <Logo />
            </Link>
          </header>

          <main className="flex flex-1 items-center justify-center py-10">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-[440px]"
            >
              {children}
            </motion.div>
          </main>

          <footer className="flex flex-col items-center justify-between gap-3 text-xs text-ink-400 sm:flex-row">
            <Link href="/" className="inline-flex items-center gap-1.5 transition hover:text-stone-100">
              <ArrowLeft size={14} /> {t("auth.frame.backHome")}
            </Link>
            <span className="inline-flex items-center gap-1.5">
              <ShieldTick size={14} variant="Bulk" className="text-success" /> {t("auth.frame.secure")}
            </span>
            <a href={t("common.contact.phoneHref")} className="inline-flex items-center gap-1.5 transition hover:text-stone-100">
              <Call size={14} /> {t("auth.frame.help")} <span className="font-mono text-ink-200">{t("common.contact.phone")}</span>
            </a>
          </footer>
        </div>

        <AuthBrandPanel className="hidden lg:sticky lg:top-0 lg:flex lg:h-[calc(100dvh-1.5rem)] lg:self-start" />

        <div className="absolute right-4 top-5 z-20 flex items-center gap-2 sm:right-8 lg:right-8 lg:top-8">
          <LanguageSwitcher className="bg-ink-900/60 backdrop-blur" />
          <ThemeToggle className="bg-ink-900/60 backdrop-blur" />
        </div>
      </div>
    </MotionConfig>
  );
}

/** Title block at the top of each auth form. */
export function AuthHeading({ title, subtitle, eyebrow }: { title: string; subtitle?: string; eyebrow?: React.ReactNode }) {
  return (
    <div className="mb-8">
      {eyebrow && <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-gold-400">{eyebrow}</div>}
      <h1 className="font-display text-4xl font-medium leading-tight text-stone-100 sm:text-[44px]">{title}</h1>
      {subtitle && <p className="mt-2.5 text-[15px] leading-relaxed text-ink-300">{subtitle}</p>}
    </div>
  );
}

/** Horizontal step indicator with animated connector. */
export function AuthStepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="mb-8 flex items-center">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex flex-1 items-center last:flex-none" aria-current={active ? "step" : undefined}>
            <div className="flex items-center gap-2.5">
              <motion.span
                initial={false}
                animate={{ scale: active ? 1 : 0.92 }}
                className={
                  "relative grid size-8 shrink-0 place-items-center rounded-full border text-xs font-bold transition-colors duration-300 " +
                  (done
                    ? "border-gold-400 bg-gold-gradient text-onyx"
                    : active
                      ? "border-gold-400 bg-gold-500/10 text-gold-200 shadow-glow"
                      : "border-line-strong bg-ink-850 text-ink-400")
                }
              >
                {done ? (
                  <svg viewBox="0 0 12 12" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                    <motion.path d="m2.5 6.2 2.4 2.4 4.6-5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.35 }} />
                  </svg>
                ) : (
                  i + 1
                )}
              </motion.span>
              <span className={"hidden text-xs font-semibold sm:block " + (active ? "text-stone-100" : done ? "text-ink-200" : "text-ink-400")}>{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className="mx-3 h-px flex-1 overflow-hidden bg-line-strong">
                <motion.div
                  className="h-full bg-gold-400"
                  initial={false}
                  animate={{ width: done ? "100%" : "0%" }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Slide transition between form steps. */
export const stepMotion = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 },
  transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
};
