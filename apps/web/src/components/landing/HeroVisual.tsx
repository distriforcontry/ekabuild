"use client";
import * as React from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { Buildings2, I3DRotate, Gallery, Map1, Verify } from "iconsax-reactjs";
import { TrustRing } from "@/components/ui/trust-ring";
import { useI18n } from "@/i18n/client";
import { useSplashSettled } from "@/components/brand/Splash";
import { Tilt } from "@/components/marketing/motion";
import { SmartImg } from "@/components/marketing/SmartImg";
import { RENDERS } from "@/components/marketing/renders";
import { cn } from "@/lib/utils";

const HeroBuilding = dynamic(() => import("./HeroBuilding"), { ssr: false, loading: () => null });
const BuildingViewer = dynamic(() => import("@/components/three").then((m) => m.BuildingViewer), { ssr: false, loading: () => null });

// Photoreal Cycles render (graded WebP) + the same building as an interactive GLB (tools/blender/build_models.py)
const HERO = RENDERS["hero-tower"];
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
      <rect x="112" y="440" width="176" height="44" className="fill-ink-800" />
      <rect x="110" y="438" width="180" height="3" fill="url(#tf-gold)" />
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
      <rect x="148" y="78" width="104" height="14" fill="none" stroke="url(#tf-gold)" strokeWidth="2" />
      <path d="M232 78 L232 30 L242 30 L242 78 Z M232 30 L218 46 L218 38 Z" fill="url(#tf-gold)" />
    </svg>
  );
}

/** Glass proof card: CSS entrance (waits for the intro), then a slow float. */
function FloatCard({ className, delay, children, floatDelay = "0s" }: { className?: string; delay: number; children: React.ReactNode; floatDelay?: string }) {
  return (
    <div className={cn("eka-in-scale absolute z-10", className)} style={{ "--d": `${delay}ms` } as React.CSSProperties}>
      <div className="eka-float glass rounded-2xl px-4 py-3 shadow-lift" style={{ "--fd": floatDelay } as React.CSSProperties}>
        {children}
      </div>
    </div>
  );
}

export function HeroVisual() {
  const { t } = useI18n();
  const { resolvedTheme } = useTheme();
  const reduce = useReducedMotion() ?? false;
  const ref = React.useRef<HTMLDivElement>(null);
  const [webgl, setWebgl] = React.useState<boolean | null>(null);
  const [active, setActive] = React.useState(true);
  const [mounted, setMounted] = React.useState(false);
  const started = useSplashSettled();
  const [mode, setMode] = React.useState<"render" | "3d">("render");
  const [renderFailed, setRenderFailed] = React.useState(false);

  // scroll parallax: the render drifts slower than the page, the proof cards a little faster
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const imgY = useTransform(scrollYProgress, [0, 1], [0, 90]);
  const cardsY = useTransform(scrollYProgress, [0, 1], [0, -60]);

  React.useEffect(() => {
    setMounted(true);
    setWebgl(hasWebGL());
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
      <div aria-hidden className="eka-in-fade pointer-events-none absolute inset-0" style={{ "--d": "200ms" } as React.CSSProperties}>
        <div className="absolute left-1/2 top-[55%] size-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold-500 opacity-[0.12] blur-[90px]" />
        <div className="absolute left-1/2 top-[52%] aspect-square w-[92%] -translate-x-1/2 -translate-y-1/2">
          <div className="eka-orbit size-full rounded-full border border-gold-500/10 [border-top-color:rgb(201_164_100/0.45)]" />
        </div>
        <div className="absolute left-1/2 top-[52%] aspect-square w-[70%] -translate-x-1/2 -translate-y-1/2">
          <div className="eka-orbit-rev size-full rounded-full border border-dashed border-gold-500/20" />
        </div>
      </div>

      <div role="img" aria-label={t("landing.hero.visualLabel")} className="absolute inset-[6%] lg:inset-x-[8%] lg:inset-y-[7%]">
        <div className="eka-in-scale size-full" style={{ "--d": "260ms" } as React.CSSProperties}>
          <Tilt max={4} disabled={mode === "3d"} className="size-full rounded-[2rem]">
            <div className="relative size-full overflow-hidden rounded-[2rem] border border-gold-500/25 bg-ink-900 shadow-[0_40px_120px_-40px_rgb(201_164_100/0.45)]">
              <AnimatePresence initial={false} mode="wait">
                {mode === "render" ? (
                  <motion.div
                    key="render"
                    className="absolute inset-0"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                  >
                    {/* parallax drift + slow cinematic push-in on the Cycles render */}
                    <motion.div className="absolute -inset-y-[8%] inset-x-0" style={{ y: reduce ? 0 : imgY }}>
                      <div className="eka-ken absolute inset-0">
                        <SmartImg
                          src={HERO.src}
                          srcSet={HERO.srcSet}
                          sizes="(min-width: 1024px) 45vw, 92vw"
                          lqip={HERO.lqip}
                          priority
                          imgStyle={{ objectPosition: "50% 35%" }}
                          onError={() => setRenderFailed(true)}
                        />
                      </div>
                    </motion.div>
                    {renderFailed && webgl && <HeroBuilding active={active} started={started} theme={theme} reduced={reduce} />}
                    {renderFailed && !webgl && <TowerFallback />}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0b0c0e]/85 via-transparent to-[#0b0c0e]/10" />
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_55%,rgb(0_0_0/0.35))]" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="3d"
                    className="absolute inset-0"
                    initial={{ opacity: 0, scale: 1.02 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                  >
                    <BuildingViewer model3d={HERO_MODEL} floors={22} progress={100} variant="compact" autoRotate className="h-full rounded-none border-0 shadow-none" />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* caption + mode switch */}
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 sm:p-5">
                <div className="min-w-0 leading-tight">
                  <div className="truncate font-display text-xl text-[#f4f1ea] sm:text-2xl">{t("landing.hero.renderCaption")}</div>
                  {mode === "3d" && <div className="mt-1 text-[11px] text-[#d6d0c4]">{t("landing.hero.view3dHint")}</div>}
                </div>
                <button
                  type="button"
                  onClick={() => setMode((m) => (m === "render" ? "3d" : "render"))}
                  aria-pressed={mode === "3d"}
                  className="group/3d relative inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 overflow-hidden rounded-xl border border-[#e9d5a8]/30 bg-[#0b0c0e]/55 px-3.5 text-xs font-semibold text-[#f4f1ea] backdrop-blur-md transition hover:border-[#e9d5a8]/70 hover:text-[#f1dfb2]"
                >
                  <span aria-hidden className="absolute inset-0 -z-0 bg-gradient-to-r from-[#c9a464]/0 via-[#c9a464]/25 to-[#c9a464]/0 opacity-0 transition-opacity group-hover/3d:opacity-100" />
                  {mode === "render" ? <I3DRotate size={18} variant="Bulk" className="relative text-[#e0c285]" /> : <Gallery size={18} variant="Bulk" className="relative text-[#e0c285]" />}
                  <span className="relative">{mode === "render" ? t("landing.hero.view3d") : t("landing.hero.viewRender")}</span>
                </button>
              </div>
            </div>
          </Tilt>
        </div>
      </div>

      {/* floating proof cards (drift against the render on scroll) */}
      <motion.div className="pointer-events-none absolute inset-0 [&>*]:pointer-events-auto" style={{ y: reduce ? 0 : cardsY }}>
        <FloatCard className="left-0 top-[8%] sm:-left-2" delay={900}>
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-success/15 text-success">
              <Verify size={18} variant="Bulk" />
            </span>
            <div className="leading-tight">
              <div className="text-[11px] text-ink-400">{t("landing.hero.cardPermit")}</div>
              <div className="text-[13px] font-semibold text-stone-100">{t("landing.hero.cardPermitValue")}</div>
            </div>
          </div>
        </FloatCard>

        <FloatCard className="right-0 top-[30%] hidden sm:block lg:-right-4" delay={1080} floatDelay="-2s">
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

        <FloatCard className="bottom-[9%] left-0 sm:left-2" delay={1260} floatDelay="-4s">
          <div className="flex items-center gap-3">
            <TrustRing score={94} size={48} stroke={4} />
            <div className="leading-tight">
              <div className="text-[11px] text-ink-400">{t("landing.hero.cardTrust")}</div>
              <div className="text-[13px] font-semibold text-success">{t("landing.hero.cardTrustValue")}</div>
            </div>
          </div>
        </FloatCard>

        <FloatCard className="bottom-[22%] right-0 hidden w-52 sm:block lg:-right-2" delay={1440} floatDelay="-1s">
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
            <div className="eka-draw-x h-full w-[72%] rounded-full bg-gold-gradient" style={{ "--d": "1900ms" } as React.CSSProperties} />
          </div>
        </FloatCard>
      </motion.div>
    </div>
  );
}
