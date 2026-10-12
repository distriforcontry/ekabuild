"use client";
import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { TOWER_POINTS } from "./Logo";
import { useI18n } from "@/i18n/client";

/**
 * Cinematic brand intro, once per browser session:
 * gold plate draws in → "E K A" rise → the "1"/tower slides up into its slot → "BUILD" letter-spaces in
 * → gold sheen sweep → the overlay lifts away. Click / any key skips it.
 *
 * The overlay is server-rendered so there is no flash of the page underneath. A tiny inline script hides it
 * before first paint when it was already seen this session, when the visitor prefers reduced motion, or on
 * a deep-linked certificate check (/verify/<code>) where the answer matters more than the show.
 * A CSS fail-safe removes it even if JavaScript never runs.
 */

const KEY = "eka_splash_seen";
/** Fired on window when the intro starts lifting away (or was skipped) — hero animations wait for it. */
export const SPLASH_DONE_EVENT = "eka:splash-done";
/** `<html data-eka-splash>`: "off" (skipped before paint) · "done" (finished). Absent while pending/playing. */
export const SPLASH_ATTR = "data-eka-splash";

function announceDone(state: "off" | "done") {
  document.documentElement.setAttribute(SPLASH_ATTR, state);
  window.dispatchEvent(new Event(SPLASH_DONE_EVENT));
}
const SCRIPT = `(function(){try{var d=document.documentElement;if(sessionStorage.getItem("${KEY}")||window.matchMedia("(prefers-reduced-motion: reduce)").matches||location.pathname.indexOf("/verify/")===0){d.setAttribute("data-eka-splash","off")}}catch(e){}})();`;
const STYLE = `html[data-eka-splash="off"] #eka-splash{display:none!important}#eka-splash{animation:eka-splash-failsafe .01s linear 7s forwards}@keyframes eka-splash-failsafe{to{opacity:0;visibility:hidden;pointer-events:none}}`;

const EASE = [0.16, 1, 0.3, 1] as const;
const VIEW = "0 0 120 200";
const LETTERS = [
  { ch: "E", y: 62 },
  { ch: "K", y: 122 },
  { ch: "A", y: 182 },
];

type Mode = "init" | "play" | "done";
let sessionDecision: "play" | "skip" | null = null;

export function Splash() {
  const { t } = useI18n();
  const [mode, setMode] = React.useState<Mode>("init");
  const uid = React.useId().replace(/:/g, "");

  // Decide once per page lifetime (survives StrictMode double effects and client-side remounts).
  // Layout effect → decided before paint, so a skipped intro never flashes on client navigations.
  React.useLayoutEffect(() => {
    if (sessionDecision === null) {
      const attr = document.documentElement.getAttribute(SPLASH_ATTR);
      let seen = false;
      try {
        seen = !!sessionStorage.getItem(KEY);
      } catch {}
      const skip = attr === "off" || attr === "done" || seen || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      sessionDecision = skip ? "skip" : "play";
      if (!skip) {
        try {
          sessionStorage.setItem(KEY, "1");
        } catch {}
      }
    }
    if (sessionDecision === "skip") {
      setMode("done");
      announceDone("off");
      return;
    }
    setMode("play");
  }, []);

  // announce once, when a played intro starts lifting away (StrictMode-safe: no cleanup side effects)
  const played = React.useRef(false);
  React.useEffect(() => {
    if (mode === "play") played.current = true;
    else if (mode === "done" && played.current) {
      played.current = false;
      sessionDecision = "skip";
      announceDone("done");
    }
  }, [mode]);

  React.useEffect(() => {
    if (mode !== "play") return;
    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    const timer = setTimeout(() => setMode("done"), 2350);
    const onKey = () => setMode("done");
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
      root.style.overflow = prevOverflow;
    };
  }, [mode]);

  const gold = `sp-gold-${uid}`;
  const goldHi = `sp-goldhi-${uid}`;
  const brushed = `sp-brushed-${uid}`;
  const cut = `sp-cut-${uid}`;

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />
      <AnimatePresence>
        {mode !== "done" && (
          <motion.div
            id="eka-splash"
            key="eka-splash"
            role="presentation"
            onClick={() => setMode("done")}
            className="fixed inset-0 z-[100] grid cursor-pointer place-items-center overflow-hidden bg-ink-950"
            exit={{ y: "-100%", transition: { duration: 0.85, ease: [0.83, 0, 0.17, 1] } }}
          >
            {/* atmosphere */}
            <div aria-hidden className="bg-blueprint absolute inset-0 opacity-70 [mask-image:radial-gradient(circle_at_50%_45%,black_0%,transparent_60%)]" />
            <motion.div
              aria-hidden
              className="absolute left-1/2 top-[42%] size-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold-500 blur-[130px]"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 0.18, scale: 1 }}
              transition={{ duration: 1.6, ease: EASE }}
            />
            <div aria-hidden className="bg-noise absolute inset-0" />

            <motion.div className="relative flex flex-col items-center" exit={{ y: -80, opacity: 0, transition: { duration: 0.5, ease: EASE } }}>
              <div className="relative aspect-[120/200] w-[92px] sm:w-[112px]">
                {/* 1 — plate outline draws in */}
                <svg viewBox={VIEW} className="absolute inset-0 size-full overflow-visible" aria-hidden>
                  <defs>
                    <linearGradient id={gold} x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0" stopColor="#E9D5A8" />
                      <stop offset="0.45" stopColor="#C9A464" />
                      <stop offset="1" stopColor="#8E6E3C" />
                    </linearGradient>
                  </defs>
                  <motion.rect
                    x="0.75"
                    y="0.75"
                    width="118.5"
                    height="198.5"
                    fill="none"
                    stroke={`url(#${gold})`}
                    strokeWidth="1.5"
                    initial={{ pathLength: 0, opacity: 1 }}
                    animate={{ pathLength: 1, opacity: [1, 1, 0] }}
                    transition={{ pathLength: { duration: 0.7, ease: [0.65, 0, 0.35, 1] }, opacity: { duration: 1.3, times: [0, 0.75, 1] } }}
                  />
                </svg>

                {/* 2 — plate fills from the bottom (slot already cut) */}
                <motion.div
                  className="absolute inset-0"
                  initial={{ clipPath: "inset(100% 0% 0% 0%)" }}
                  animate={{ clipPath: "inset(0% 0% 0% 0%)" }}
                  transition={{ delay: 0.3, duration: 0.75, ease: EASE }}
                >
                  <svg viewBox={VIEW} className="size-full" aria-hidden>
                    <defs>
                      <linearGradient id={`${gold}-f`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="#E9D5A8" />
                        <stop offset="0.45" stopColor="#C9A464" />
                        <stop offset="1" stopColor="#8E6E3C" />
                      </linearGradient>
                      <linearGradient id={brushed} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0" stopColor="#fff" stopOpacity="0" />
                        <stop offset="0.5" stopColor="#fff" stopOpacity="0.18" />
                        <stop offset="1" stopColor="#fff" stopOpacity="0" />
                      </linearGradient>
                      <mask id={cut} maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="200">
                        <rect width="120" height="200" fill="#fff" />
                        <polygon points={TOWER_POINTS} fill="#000" stroke="#000" strokeWidth="7" strokeLinejoin="miter" />
                      </mask>
                    </defs>
                    <g mask={`url(#${cut})`}>
                      <rect width="120" height="200" fill={`url(#${gold}-f)`} />
                      <rect width="120" height="200" fill={`url(#${brushed})`} opacity="0.6" />
                    </g>
                  </svg>
                </motion.div>

                {/* 3 — engraved letters rise one by one */}
                {LETTERS.map((l, i) => (
                  <motion.div
                    key={l.ch}
                    className="absolute inset-0"
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.62 + i * 0.13, duration: 0.55, ease: EASE }}
                  >
                    <svg viewBox={VIEW} className="size-full" aria-hidden>
                      <text
                        x="34"
                        y={l.y}
                        fill="#141416"
                        fontFamily="'Manrope Variable', Manrope, 'Helvetica Neue', Arial, sans-serif"
                        fontWeight={800}
                        fontSize="44"
                        textAnchor="middle"
                      >
                        {l.ch}
                      </text>
                    </svg>
                  </motion.div>
                ))}

                {/* 4 — the "1" / tower slides up into its slot */}
                <div className="absolute inset-0 overflow-hidden">
                  <motion.div
                    className="absolute inset-0"
                    initial={{ y: "102%" }}
                    animate={{ y: "0%" }}
                    transition={{ delay: 0.9, duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <svg viewBox={VIEW} className="size-full" aria-hidden>
                      <defs>
                        <linearGradient id={goldHi} x1="1" y1="0" x2="0" y2="1">
                          <stop offset="0" stopColor="#F4E9D2" />
                          <stop offset="0.5" stopColor="#D4AF6A" />
                          <stop offset="1" stopColor="#9B7A43" />
                        </linearGradient>
                      </defs>
                      <polygon points={TOWER_POINTS} fill={`url(#${goldHi})`} />
                    </svg>
                  </motion.div>
                </div>

                {/* 5 — sheen sweep */}
                <div className="pointer-events-none absolute inset-0 overflow-hidden mix-blend-overlay">
                  <motion.div
                    className="absolute -inset-y-1/4 w-1/2 -skew-x-[18deg]"
                    style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.75), transparent)" }}
                    initial={{ x: "-160%" }}
                    animate={{ x: "320%" }}
                    transition={{ delay: 1.35, duration: 0.85, ease: [0.45, 0, 0.25, 1] }}
                  />
                </div>
              </div>

              {/* 6 — BUILD letter-spaces in */}
              <motion.div
                className="mt-6 font-sans text-lg font-semibold text-gold-300 sm:text-xl"
                initial={{ opacity: 0, letterSpacing: "0.02em", paddingLeft: "0.02em" }}
                animate={{ opacity: 1, letterSpacing: "0.48em", paddingLeft: "0.48em" }}
                transition={{ delay: 1.15, duration: 0.9, ease: EASE }}
              >
                BUILD
              </motion.div>
              <motion.div
                aria-hidden
                className="mt-4 h-px w-40 bg-gradient-to-r from-transparent via-gold-400 to-transparent"
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{ delay: 1.3, duration: 0.8, ease: EASE }}
              />
              <motion.div
                className="mt-4 text-[10px] font-medium uppercase tracking-[0.34em] text-ink-300"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.5, duration: 0.6, ease: EASE }}
              >
                {t("landing.splash.tagline")}
              </motion.div>
            </motion.div>

            <motion.button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMode("done");
              }}
              className="absolute bottom-8 left-1/2 -translate-x-1/2 cursor-pointer rounded-full border border-line px-4 py-2 text-[11px] font-medium uppercase tracking-[0.2em] text-ink-400 transition hover:border-line-strong hover:text-stone-100"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              {t("landing.splash.skip")} <span className="ml-1 font-mono text-ink-500">Esc</span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
