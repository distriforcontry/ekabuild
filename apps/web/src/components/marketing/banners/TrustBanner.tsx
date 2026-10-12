import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRight, Chart, ShieldTick, TickCircle, Buildings2 } from "iconsax-reactjs";
import { Button } from "@/components/ui/button";
import { CountUp } from "@/components/ui/reveal";
import { getI18n } from "@/i18n/server";
import type { PublicStats } from "@/lib/types";
import { Container } from "../primitives";
import { InView, Magnetic, ParallaxLayer } from "../motion";
import { RevealHeading } from "../text";
import { SmartImg } from "../SmartImg";
import { RENDERS } from "../renders";

/**
 * Full-bleed "Ishonch bilan tanlang" banner: Cycles render with scroll parallax, cinematic grading,
 * gold CTA and live platform numbers. Always dark (text sits on the render) in both themes.
 */
export async function TrustBanner({ stats }: { stats: PublicStats | null }) {
  const { t, raw } = await getI18n();
  const points = raw<string[]>("landing.banners.trust.points") ?? [];
  const img = RENDERS["trust-courtyard"];
  const numbers = [
    { Icon: ShieldTick, value: stats?.verifiedCertificates ?? 0, label: t("landing.banners.trust.statCerts") },
    { Icon: Chart, value: stats?.avgTrust ?? 0, label: t("landing.banners.trust.statTrust"), suffix: "/100" },
    { Icon: Buildings2, value: stats?.projects ?? 0, label: t("landing.banners.trust.statProjects") },
  ];

  return (
    <section aria-labelledby="trust-banner-title" className="relative isolate overflow-hidden bg-[#0b0b0c]">
      <ParallaxLayer range={90} scale={1.22}>
        <SmartImg src={img.src} srcSet={img.srcSet} sizes="100vw" lqip={img.lqip} imgStyle={{ objectPosition: "60% 40%" }} />
      </ParallaxLayer>
      {/* grading: graphite from the left for legibility, gold dusk glow, film grain, gold hairlines */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-[-5]">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#0b0b0c_0%,rgb(11_11_12/0.9)_32%,rgb(11_11_12/0.45)_62%,rgb(11_11_12/0.2)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,#0b0b0c_0%,rgb(11_11_12/0)_45%)]" />
        <div className="absolute -bottom-40 -left-20 size-[620px] rounded-full bg-[#c9a464] opacity-[0.16] blur-[140px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgb(201_164_100/0.06)_1px,transparent_1px),linear-gradient(90deg,rgb(201_164_100/0.06)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:linear-gradient(90deg,black,transparent_55%)]" />
        <div className="bg-noise absolute inset-0" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#c9a464]/50 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#c9a464]/50 to-transparent" />
      </div>

      <Container className="grid min-h-[640px] items-end gap-12 py-24 md:py-32 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-7">
          <RevealHeading
            id="trust-banner-title"
            onImage
            size="xl"
            eyebrow={t("landing.banners.trust.eyebrow")}
            title={t("landing.banners.trust.title")}
            accent={t("landing.banners.trust.accent")}
            description={t("landing.banners.trust.text")}
          />
          <InView as="ul" className="mt-8 space-y-3">
            {points.map((p, i) => (
              <li key={p} className="eka-iv-up flex items-center gap-3 text-[15px] text-[#ece6da]" style={{ "--d": `${450 + i * 110}ms` } as CSSProperties}>
                <span className="grid size-7 shrink-0 place-items-center rounded-full border border-[#e0c285]/40 bg-[#c9a464]/15 text-[#e0c285]">
                  <TickCircle size={16} variant="Bold" />
                </span>
                {p}
              </li>
            ))}
          </InView>
          <InView className="eka-iv-up mt-10 flex flex-col gap-3 sm:flex-row sm:items-center" style={{ "--d": "800ms" } as CSSProperties}>
            <Magnetic className="w-full sm:w-auto">
              <Button asChild variant="gold" size="xl" className="eka-shine group w-full sm:w-auto">
                <Link href="/projects?verified=1">
                  {t("landing.banners.trust.cta")}
                  <ArrowRight className="transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </Magnetic>
            <Link
              href="/about#trust-score"
              className="group inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-[#f4f1ea]/15 bg-[#f4f1ea]/[0.04] px-6 text-sm font-semibold text-[#f4f1ea] backdrop-blur-md transition hover:border-[#e0c285]/50 hover:text-[#f1dfb2]"
            >
              {t("landing.banners.trust.secondary")}
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </Link>
          </InView>
        </div>

        <InView className="grid gap-3 sm:grid-cols-3 lg:col-span-5 lg:grid-cols-1 lg:justify-self-end">
          {numbers.map(({ Icon, value, label, suffix }, i) => (
            <div
              key={label}
              className="eka-iv-up flex items-center gap-4 rounded-2xl border border-[#f4f1ea]/12 bg-[#0b0b0c]/45 px-5 py-4 backdrop-blur-xl lg:w-72"
              style={{ "--d": `${300 + i * 140}ms` } as CSSProperties}
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#e9d5a8] via-[#c9a464] to-[#8e6e3c] text-[#1f1a12] shadow-glow">
                <Icon size={20} variant="Bold" />
              </span>
              <div className="min-w-0">
                <div className="font-mono text-2xl font-semibold tracking-tight text-[#f4f1ea]">
                  <CountUp value={value} />
                  {suffix && <span className="text-sm text-[#a39e94]">{suffix}</span>}
                </div>
                <div className="truncate text-xs text-[#c9c4ba]">{label}</div>
              </div>
            </div>
          ))}
          <p className="eka-iv-fade mt-1 text-[11px] uppercase tracking-[0.22em] text-[#a39e94] lg:text-right" style={{ "--d": "800ms" } as CSSProperties}>
            {t("landing.banners.trust.caption")}
          </p>
        </InView>
      </Container>
    </section>
  );
}
