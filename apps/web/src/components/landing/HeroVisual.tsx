"use client";
import * as React from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { motion, useReducedMotion } from "motion/react";
import { Buildings2, I3DRotate, Gallery, Map1, Verify } from "iconsax-reactjs";
import { TrustRing } from "@/components/ui/trust-ring";
import { useI18n } from "@/i18n/client";
import { SPLASH_ATTR, SPLASH_DONE_EVENT } from "@/components/brand/Splash";
import { cn } from "@/lib/utils";

const HeroBuilding = dynamic(() => import("./HeroBuilding"), { ssr: false, loading: () => null });
const BuildingViewer = dynamic(() => import("@/components/three").then((m) => m.BuildingViewer), { ssr: false, loading: () => null });

// Photoreal Cycles render + the same building as an interactive GLB (tools/blender/build_models.py)
const HERO_RENDER = "/renders/hero-tower.jpg";
const HERO_MODEL = { id: "hero-tower", url: "/models/hero-tower.glb", originalName: "hero-tower.glb", mime: "model/gltf-binary", size: 0, sha256: "" };

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
  const [mode, setMode] = React.useState<"render" | "3d">("render");
  const [renderFailed, setRenderFailed] = React.useState(false);

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

      <div role="img" aria-label={t("landing.hero.visualLabel")} className="absolute inset-[6%] lg:inset-x-[8%] lg:inset-y-[7%]">
        <motion.div
          className="relative size-full overflow-hidden rounded-[2rem] border border-gold-500/25 bg-ink-900 shadow-[0_40px_120px_-40px_rgb(201_164_100/0.45)]"
          initial={reduce ? false : { opacity: 0, scale: 0.94, y: 24 }}
          animate={started || reduce ? { opacity: 1, scale: 1, y: 0 } : undefined}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        >
          {mode === "render" ? (
            <>
              {/* slow cinematic push-in on the Cycles render */}
              <motion.img
                src={HERO_RENDER}
                alt=""
                className="absolute inset-0 size-full object-cover"
                initial={{ scale: 1.12 }}
                animate={{ scale: reduce ? 1.04 : [1.12, 1.02] }}
                transition={{ duration: 14, ease: "easeOut" }}
                onError={() => setRenderFailed(true)}
                style={{ objectPosition: "50% 35%" }}
              />
              {renderFailed && webgl && <HeroBuilding active={active} started={started} theme={theme} reduced={reduce} onReady={() => setReady(true)} />}
              {renderFailed && !webgl && <TowerFallback />}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0b0c0e]/85 via-transparent to-[#0b0c0e]/10" />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_55%,rgb(0_0_0/0.35))]" />
            </>
          ) : (
            <BuildingViewer model3d={HERO_MODEL} floors={22} progress={100} variant="compact" autoRotate className="h-full rounded-none border-0 shadow-none" />
          )}
          {/* caption + mode switch */}
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 sm:p-5">
            <div className="min-w-0 leading-tight">
              <div className="truncate font-display text-xl text-[#f4f1ea] sm:text-2xl">{t("landing.hero.renderCaption")}</div>
              {mode === "3d" && <div className="mt-1 text-[11px] text-[#c4c7ce]">{t("landing.hero.view3dHint")}</div>}
            </div>
            <button
              type="button"
              onClick={() => setMode((m) => (m === "render" ? "3d" : "render"))}
              className="glass inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-xl px-3.5 text-xs font-semibold text-[#f4f1ea] transition hover:border-gold-400/60 hover:text-gold-200"
            >
              {mode === "render" ? <I3DRotate size={18} variant="Bulk" /> : <Gallery size={18} variant="Bulk" />}
              {mode === "render" ? t("landing.hero.view3d") : t("landing.hero.viewRender")}
            </button>
          </div>
        </motion.div>
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
