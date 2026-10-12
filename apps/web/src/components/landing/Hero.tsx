import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowDown, ArrowRight, Courthouse, Map1, PenTool2, ScanBarcode } from "iconsax-reactjs";
import { Button } from "@/components/ui/button";
import { getI18n } from "@/i18n/server";
import { Container } from "@/components/marketing/primitives";
import { Magnetic } from "@/components/marketing/motion";
import { SplitWords, wordCount } from "@/components/marketing/text";
import { HeroVisual } from "./HeroVisual";

const d = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

/**
 * Landing hero. The entrance is CSS-driven (.eka-in / .eka-word), so it plays from the first paint and —
 * on a full load of "/" — waits for the intro curtain via --gate instead of waiting for hydration.
 */
export async function Hero() {
  const { t } = await getI18n();
  const chips = [
    { Icon: PenTool2, label: t("landing.hero.chipEimzo") },
    { Icon: Map1, label: t("landing.hero.chipCadastre") },
    { Icon: Courthouse, label: t("landing.hero.chipExpertise") },
  ];
  const a = t("landing.hero.titleA");
  const accent = t("landing.hero.titleAccent");
  const b = t("landing.hero.titleB");
  const nA = wordCount(a);
  const nAcc = wordCount(accent);

  return (
    <section className="relative isolate -mt-20 overflow-hidden pb-16 pt-28 sm:pt-32 lg:pb-20 lg:pt-28">
      {/* backdrop: blueprint grid + breathing gold glows */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-blueprint eka-in-fade absolute inset-0 [mask-image:radial-gradient(ellipse_80%_70%_at_60%_40%,black_15%,transparent_75%)]" />
        <div className="eka-pulse-soft absolute -top-32 right-[-10%] h-[620px] w-[620px]">
          <div className="size-full rounded-full bg-gold-500 opacity-[0.13] blur-[140px]" />
        </div>
        <div className="eka-float absolute -left-40 top-1/3 h-[420px] w-[420px] rounded-full bg-gold-300 opacity-[0.07] blur-[120px]" style={{ "--fd": "-3s" } as CSSProperties} />
        <div className="bg-noise absolute inset-0" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-ink-950" />
      </div>

      <Container className="grid items-center gap-6 lg:min-h-[calc(100dvh-7rem)] lg:grid-cols-12 lg:gap-6">
        <div className="relative z-10 lg:col-span-6">
          <div className="eka-in" style={d(0)}>
            <div className="glass inline-flex items-center gap-2.5 rounded-full py-1.5 pl-2 pr-4 text-xs font-medium text-ink-200">
              <span className="relative flex size-5 items-center justify-center rounded-full bg-success/15">
                <span className="absolute size-2 animate-ping rounded-full bg-success opacity-60" />
                <span className="relative size-2 rounded-full bg-success" />
              </span>
              {t("landing.hero.eyebrow")}
            </div>
          </div>

          <h1
            className="mt-7 font-display text-[44px] font-medium leading-[1.0] tracking-[-0.015em] text-stone-100 sm:text-6xl lg:text-[68px] xl:text-[80px]"
            style={d(90)}
          >
            <span className="block">
              <SplitWords text={a} />
            </span>
            <span className="block">
              <SplitWords text={accent} start={nA} wordClassName="text-gold-shimmer pr-[0.06em] italic" />
            </span>
            <span className="block">
              <SplitWords text={b} start={nA + nAcc} />
            </span>
          </h1>

          <div aria-hidden className="eka-draw-x mt-7 h-px w-40 bg-gradient-to-r from-gold-400 via-gold-500/50 to-transparent" style={d(520)} />

          <p className="eka-in mt-6 max-w-xl text-base leading-relaxed text-ink-300 sm:text-lg" style={d(480)}>
            {t("landing.hero.subtitle")}
          </p>

          <div className="eka-in mt-9 flex flex-col gap-3 sm:flex-row sm:items-center" style={d(600)}>
            <Magnetic className="w-full sm:w-auto">
              <Button asChild variant="gold" size="xl" className="eka-shine group w-full sm:w-auto">
                <Link href="/projects">
                  {t("landing.hero.ctaProjects")}
                  <ArrowRight className="transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </Button>
            </Magnetic>
            <Button asChild variant="outline" size="xl" className="group">
              <Link href="/verify">
                <ScanBarcode variant="Bulk" className="text-gold-300" />
                {t("landing.hero.ctaVerify")}
              </Link>
            </Button>
          </div>

          <ul className="mt-9 flex flex-wrap gap-2.5">
            {chips.map(({ Icon, label }, i) => (
              <li
                key={label}
                style={d(740 + i * 90)}
                className="eka-in inline-flex items-center gap-2 rounded-full border border-line bg-ink-900/60 px-3.5 py-1.5 text-xs font-medium text-ink-200 backdrop-blur-sm transition hover:border-gold-500/40 hover:text-stone-100"
              >
                <Icon size={14} variant="Bulk" className="text-gold-400" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative lg:col-span-6">
          <HeroVisual />
        </div>
      </Container>

      <a
        href="#trust"
        style={d(1300)}
        className="eka-in group absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2.5 text-[10px] font-medium uppercase tracking-[0.3em] text-ink-400 transition hover:text-gold-300 lg:flex"
      >
        <span className="relative grid h-10 w-6 justify-center overflow-hidden rounded-full border border-line-strong pt-1.5 transition group-hover:border-gold-500/50">
          <ArrowDown size={12} className="animate-float text-gold-400" />
        </span>
        {t("landing.hero.scroll")}
      </a>
    </section>
  );
}
