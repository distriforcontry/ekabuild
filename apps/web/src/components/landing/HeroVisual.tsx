"use client";
import * as React from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { motion, useReducedMotion } from "motion/react";
import { Buildings2, Map1, Verify } from "iconsax-reactjs";
import { TrustRing } from "@/components/ui/trust-ring";
import { useI18n } from "@/i18n/client";
import { SPLASH_ATTR, SPLASH_DONE_EVENT } from "@/components/brand/Splash";
import { cn } from "@/lib/utils";

const HeroBuilding = dynamic(() => import("./HeroBuilding"), { ssr: false, loading: () => null });

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Static tower silhouette shown while three.js loads (and when WebGL is unavailable). */
export function TowerFallback({ className }: { className?: string }) {
  const floors = 18;
  return (
    <svg viewBox="0 0 400 520" className={cn("absolute inset-0 m-auto h-[82%] w-auto", className)} aria-hidden>
      <defs>
        <linearGradient id="tf-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "var(--color-ink-700)" }} />
          <stop offset="1" style={{ stopColor: "var(--color-ink-850)" }} />
        </linearGradient>
        <linearGradient id="tf-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e6cb8f" />
          <stop offset="1" stopColor="#8e6e3c" />
        </linearGradient>
        <radialGradient id="tf-floor" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#c9a464" stopOpacity="0.28" />
          <stop offset="1" stopColor="#c9a464" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="200" cy="486" rx="170" ry="26" fill="url(#tf-floor)" />
      <ellipse cx="200" cy="486" rx="150" ry="20" fill="none" stroke="#c9a464" strokeOpacity="0.45" />
      {/* podium */}
      <rect x="112" y="440" width="176" height="44" className="fill-ink-800" />
      <rect x="110" y="438" width="180" height="3" fill="url(#tf-gold)" />
      {/* tower */}
      <path d="M140 438 L150 92 L250 92 L260 438 Z" fill="url(#tf-glass)" />
      {Array.from({ length: floors }, (_, i) => {
        const y = 438 - (i + 1) * (346 / floors);
        const inset = ((i + 1) / floors) * 10;
        return <line key={i} x1={140 + inset} x2={260 - inset} y1={y} y2={y} className="stroke-ink-500" strokeOpacity="0.55" strokeWidth="1.2" />;
      })}
      {Array.from({ length: 9 }, (_, i) => {
        const xb = 140 + (i * 120) / 8;
        const xt = 150 + (i * 100) / 8;
        return <line key={i} x1={xb} y1="438" x2={xt} y2="92" stroke="url(#tf-gold)" strokeWidth={i === 0 || i === 8 ? 2.2 : 1.1} strokeOpacity="0.9" />;
      })}
      {/* crown + "1" blade */}
      <rect x="148" y="78" width="104" height="14" fill="none" stroke="url(#tf-gold)" strokeWidth="2" />
      <path d="M232 78 L232 30 L242 30 L242 78 Z M232 30 L218 46 L218 38 Z" fill="url(#tf-gold)" />
    </svg>
  );
}

function FloatCard({
  className,
  delay,
  children,
  started,
  floatDelay = "0s",
}: {
  className?: string;
  delay: number;
  children: React.ReactNode;
  started: boolean;
  floatDelay?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={cn("absolute z-10", className)}
      initial={reduce ? false : { opacity: 0, y: 18, scale: 0.96 }}
      animate={started || reduce ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 18, scale: 0.96 }}
      transition={{ delay, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="glass animate-float rounded-2xl px-4 py-3 shadow-lift" style={{ animationDelay: floatDelay }}>
        {children}
      </div>
    </motion.div>
  );
}

export function HeroVisual() {
  const { t } = useI18n();
  const { resolvedTheme } = useTheme();
  const reduce = useReducedMotion() ?? false;
  const ref = React.useRef<HTMLDivElement>(null);
  const [webgl, setWebgl] = React.useState<boolean | null>(null);
  const [active, setActive] = React.useState(true);
  const [ready, setReady] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [started, setStarted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    setWebgl(hasWebGL());
  }, []);

  // wait for the brand intro to lift before assembling the tower
  React.useEffect(() => {
    const state = document.documentElement.getAttribute(SPLASH_ATTR);
    if (state === "off" || state === "done") {
      setStarted(true);
      return;
    }
    const go = () => setStarted(true);
    window.addEventListener(SPLASH_DONE_EVENT, go);
    const fallback = setTimeout(go, 4000);
    return () => {
      window.removeEventListener(SPLASH_DONE_EVENT, go);
      clearTimeout(fallback);
    };
  }, []);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setActive(!!entry?.isIntersecting), { rootMargin: "120px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const theme = mounted && resolvedTheme === "light" ? "light" : "dark";

  return (
    <div ref={ref} className="relative mx-auto aspect-[4/5] w-full max-w-[560px] lg:aspect-auto lg:h-[660px] lg:max-w-none">
      {/* rings + glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[55%] size-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold-500 opacity-[0.12] blur-[90px]" />
        <div className="absolute left-1/2 top-[52%] aspect-square w-[92%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold-500/10" />
        <div className="absolute left-1/2 top-[52%] aspect-square w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-gold-500/15" />
      </div>

      <div role="img" aria-label={t("landing.hero.visualLabel")} className="absolute inset-0">
        <TowerFallback className={cn("transition-opacity duration-1000", ready && webgl ? "opacity-0" : "opacity-100")} />
        {webgl && <HeroBuilding active={active} started={started} theme={theme} reduced={reduce} onReady={() => setReady(true)} />}
      </div>

      {/* floating proof cards */}
      <FloatCard className="left-0 top-[8%] sm:-left-2" delay={1.1} started={started}>
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-success/15 text-success">
            <Verify size={18} variant="Bold" />
          </span>
          <div className="leading-tight">
            <div className="text-[11px] text-ink-400">{t("landing.hero.cardPermit")}</div>
            <div className="text-[13px] font-semibold text-stone-100">{t("landing.hero.cardPermitValue")}</div>
          </div>
        </div>
      </FloatCard>

      <FloatCard className="right-0 top-[30%] hidden sm:block lg:-right-4" delay={1.35} started={started} floatDelay="-2s">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-gold-500/15 text-gold-300">
            <Map1 size={18} variant="Bulk" />
          </span>
          <div className="leading-tight">
            <div className="text-[11px] text-ink-400">{t("landing.hero.cardCadastre")}</div>
            <div className="flex items-center gap-1.5 text-[13px] font-semibold text-stone-100">
              <span className="size-1.5 rounded-full bg-success" />
              {t("landing.hero.cardCadastreValue")}
            </div>
          </div>
        </div>
      </FloatCard>

      <FloatCard className="bottom-[9%] left-0 sm:left-2" delay={1.6} started={started} floatDelay="-4s">
        <div className="flex items-center gap-3">
          <TrustRing score={94} size={48} stroke={4} />
          <div className="leading-tight">
            <div className="text-[11px] text-ink-400">{t("landing.hero.cardTrust")}</div>
            <div className="text-[13px] font-semibold text-success">{t("landing.hero.cardTrustValue")}</div>
          </div>
        </div>
      </FloatCard>

      <FloatCard className="bottom-[22%] right-0 hidden w-52 sm:block lg:-right-2" delay={1.85} started={started} floatDelay="-1s">
        <div className="flex items-center gap-2 text-[11px] text-ink-400">
          <Buildings2 size={14} variant="Bulk" className="text-gold-400" />
          {t("landing.hero.cardLive")}
          <span className="relative ml-auto flex size-2">
            <span className="absolute inset-0 animate-ping rounded-full bg-success opacity-60" />
            <span className="relative size-2 rounded-full bg-success" />
          </span>
        </div>
        <div className="mt-1.5 text-[13px] font-semibold text-stone-100">{t("landing.hero.cardLiveValue")}</div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-fg/10">
          <motion.div
            className="h-full rounded-full bg-gold-gradient"
            initial={{ width: 0 }}
            animate={{ width: started ? "72%" : 0 }}
            transition={{ delay: 2.1, duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </FloatCard>
    </div>
  );
}
