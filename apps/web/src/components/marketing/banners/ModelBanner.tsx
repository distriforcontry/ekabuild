import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRight, I3DCubeScan, I3DRotate, Layer, Mouse, Sun1 } from "iconsax-reactjs";
import { Button } from "@/components/ui/button";
import { getI18n } from "@/i18n/server";
import { cn } from "@/lib/utils";
import { Container } from "../primitives";
import { InView, Magnetic, Tilt } from "../motion";
import { RevealHeading } from "../text";
import { SmartImg } from "../SmartImg";
import { RENDERS } from "../renders";

const FEATURE_ICONS = [I3DRotate, Layer, Sun1];

/**
 * "3D'da ko'ring" — aerial Cycles render on a tilting stage with orbit rings, a floating 3D chip
 * and a CTA that opens a project straight on its 3D tab (`#model`).
 */
export async function ModelBanner({ href = "/projects", className, compact = false }: { href?: string; className?: string; compact?: boolean }) {
  const { t, raw } = await getI18n();
  const features = raw<string[]>("landing.banners.model.features") ?? [];
  const img = RENDERS["model-aerial"];

  return (
    <section className={cn("relative py-20 md:py-28", compact && "py-14 md:py-20", className)}>
      <Container>
        <div className="eka-border rounded-[2rem] shadow-lift">
          <div aria-hidden className="eka-border-spin" />
          <div className="relative isolate overflow-hidden rounded-[calc(2rem-1px)] bg-ink-900">
            <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
              <div className="bg-blueprint absolute inset-0 opacity-70 [mask-image:radial-gradient(ellipse_at_30%_50%,black_10%,transparent_70%)]" />
              <div className="absolute -left-24 top-1/2 size-[520px] -translate-y-1/2 rounded-full bg-gold-500 opacity-[0.12] blur-[120px]" />
            </div>

            <div className="grid items-center gap-10 p-5 sm:p-8 lg:grid-cols-12 lg:gap-12 lg:p-12">
              {/* stage */}
              <InView className="eka-iv-scale relative lg:col-span-7">
                <Tilt max={5} className="rounded-3xl">
                  <div className="eka-dark relative aspect-[16/11] overflow-hidden rounded-3xl border border-gold-500/25 bg-ink-850">
                    <SmartImg src={img.src} srcSet={img.srcSet} sizes="(min-width: 1024px) 50vw, 92vw" lqip={img.lqip} imgClassName="transition-[scale] duration-[1600ms] group-hover/tilt:scale-[1.04]" />
                    <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgb(11_11_12/0.45))]" />
                    {/* orbit rings in perspective */}
                    <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center [perspective:900px]">
                      <div className="aspect-square w-[78%] [transform:rotateX(72deg)]">
                        <div className="eka-orbit size-full rounded-full border border-[#e9d5a8]/50 [border-top-color:#fff1cc] shadow-[0_0_30px_rgb(233_213_168/0.25)]" />
                      </div>
                    </div>
                    <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center [perspective:900px]">
                      <div className="aspect-square w-[58%] [transform:rotateX(72deg)]">
                        <div className="eka-orbit-rev size-full rounded-full border border-dashed border-[#e9d5a8]/35" />
                      </div>
                    </div>
                    {/* 3D chip */}
                    <div className="absolute left-4 top-4 sm:left-6 sm:top-6">
                      <div className="eka-float flex items-center gap-3 rounded-2xl border border-[#e9d5a8]/30 bg-[#0b0b0c]/60 py-2 pl-2 pr-4 text-[#f4f1ea] shadow-lift backdrop-blur-xl">
                        <span className="relative grid size-10 place-items-center rounded-xl bg-gradient-to-br from-[#e9d5a8] via-[#c9a464] to-[#8e6e3c] text-[#1f1a12]">
                          <span aria-hidden className="absolute inset-0 animate-pulse-ring rounded-xl bg-[#d4af6a]" />
                          <I3DCubeScan size={20} variant="Bold" className="relative" />
                        </span>
                        <span className="leading-tight">
                          <span className="block text-sm font-semibold">{t("landing.banners.model.chip")}</span>
                          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[#e0c285]">
                            <span className="size-1.5 rounded-full bg-[#3fb68b]" />
                            {t("landing.banners.model.live")}
                          </span>
                        </span>
                      </div>
                    </div>
                    <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6">
                      <div className="eka-float flex items-center gap-2 rounded-full border border-[#f4f1ea]/15 bg-[#0b0b0c]/55 px-3.5 py-2 text-xs font-medium text-[#ece6da] backdrop-blur-xl" style={{ "--fd": "-3s" } as CSSProperties}>
                        <Mouse size={16} variant="Bulk" className="text-[#e0c285]" />
                        {t("landing.banners.model.hint")}
                      </div>
                    </div>
                    <span aria-hidden className="absolute bottom-5 left-5 hidden font-mono text-[11px] tracking-[0.2em] text-[#e0c285]/90 sm:block">
                      360°
                    </span>
                  </div>
                </Tilt>
              </InView>

              {/* copy */}
              <div className="lg:col-span-5">
                <RevealHeading
                  size="md"
                  eyebrow={t("landing.banners.model.eyebrow")}
                  title={t("landing.banners.model.title")}
                  accent={t("landing.banners.model.accent")}
                  description={t("landing.banners.model.text")}
                />
                <InView as="ul" className="mt-7 space-y-2.5">
                  {features.map((f, i) => {
                    const Icon = FEATURE_ICONS[i % FEATURE_ICONS.length]!;
                    return (
                      <li
                        key={f}
                        className="eka-iv-up flex items-center gap-3 rounded-2xl border border-line bg-ink-850/60 px-3.5 py-2.5 text-sm font-medium text-ink-100 transition hover:border-gold-500/35"
                        style={{ "--d": `${350 + i * 100}ms` } as CSSProperties}
                      >
                        <span className="grid size-8 place-items-center rounded-lg bg-gold-500/12 text-gold-300">
                          <Icon size={17} variant="Bulk" />
                        </span>
                        {f}
                      </li>
                    );
                  })}
                </InView>
                <InView className="eka-iv-up mt-8" style={{ "--d": "650ms" } as CSSProperties}>
                  <Magnetic>
                    <Button asChild variant="gold" size="xl" className="eka-shine group">
                      <Link href={href}>
                        <I3DRotate variant="Bulk" />
                        {t("landing.banners.model.cta")}
                        <ArrowRight className="transition-transform group-hover:translate-x-1" />
                      </Link>
                    </Button>
                  </Magnetic>
                </InView>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
