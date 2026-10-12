import Link from "next/link";
import { ArrowRight, Courthouse, Map1, MouseCircle, PenTool2, ScanBarcode } from "iconsax-reactjs";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { getI18n } from "@/i18n/server";
import { Container } from "@/components/marketing/primitives";
import { HeroVisual } from "./HeroVisual";

export async function Hero() {
  const { t } = await getI18n();
  const chips = [
    { Icon: PenTool2, label: t("landing.hero.chipEimzo") },
    { Icon: Map1, label: t("landing.hero.chipCadastre") },
    { Icon: Courthouse, label: t("landing.hero.chipExpertise") },
  ];

  return (
    <section className="relative isolate -mt-20 overflow-hidden pb-16 pt-28 sm:pt-32 lg:pb-20 lg:pt-28">
      {/* backdrop: blueprint grid + radial glows */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-blueprint absolute inset-0 [mask-image:radial-gradient(ellipse_80%_70%_at_60%_40%,black_15%,transparent_75%)]" />
        <div className="absolute -top-32 right-[-10%] h-[620px] w-[620px] rounded-full bg-gold-500 opacity-[0.14] blur-[140px]" />
        <div className="absolute -left-40 top-1/3 h-[420px] w-[420px] rounded-full bg-gold-300 opacity-[0.06] blur-[120px]" />
        <div className="bg-noise absolute inset-0" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-ink-950" />
      </div>

      <Container className="grid items-center gap-6 lg:min-h-[calc(100dvh-7rem)] lg:grid-cols-12 lg:gap-6">
        <div className="relative z-10 lg:col-span-6 xl:col-span-6">
          <Reveal>
            <div className="glass inline-flex items-center gap-2.5 rounded-full py-1.5 pl-2 pr-4 text-xs font-medium text-ink-200">
              <span className="relative flex size-5 items-center justify-center rounded-full bg-success/15">
                <span className="absolute size-2 animate-ping rounded-full bg-success opacity-60" />
                <span className="relative size-2 rounded-full bg-success" />
              </span>
              {t("landing.hero.eyebrow")}
            </div>
          </Reveal>

          <h1 className="mt-7 font-display text-[44px] font-medium leading-[0.98] tracking-[-0.015em] text-stone-100 sm:text-6xl lg:text-[68px] xl:text-[80px]">
            <Reveal as="span" delay={0.05} className="block">
              {t("landing.hero.titleA")}
            </Reveal>
            <Reveal as="span" delay={0.14} className="block">
              <span className="text-gold-gradient animate-[shimmer_7s_linear_infinite] pr-2 italic">{t("landing.hero.titleAccent")}</span>
            </Reveal>
            <Reveal as="span" delay={0.23} className="block">
              {t("landing.hero.titleB")}
            </Reveal>
          </h1>

          <Reveal delay={0.32}>
            <p className="mt-7 max-w-xl text-base leading-relaxed text-ink-300 sm:text-lg">{t("landing.hero.subtitle")}</p>
          </Reveal>

          <Reveal delay={0.4}>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="gold" size="xl" className="group">
                <Link href="/projects">
                  {t("landing.hero.ctaProjects")}
                  <ArrowRight className="transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="xl" className="group">
                <Link href="/verify">
                  <ScanBarcode variant="Bulk" />
                  {t("landing.hero.ctaVerify")}
                </Link>
              </Button>
            </div>
          </Reveal>

          <Reveal delay={0.5}>
            <ul className="mt-9 flex flex-wrap gap-2.5">
              {chips.map(({ Icon, label }) => (
                <li
                  key={label}
                  className="inline-flex items-center gap-2 rounded-full border border-line bg-ink-900/60 px-3.5 py-1.5 text-xs font-medium text-ink-200 backdrop-blur-sm transition hover:border-gold-500/40 hover:text-stone-100"
                >
                  <Icon size={14} variant="Bulk" className="text-gold-400" />
                  {label}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <div className="relative lg:col-span-6 xl:col-span-6">
          <HeroVisual />
        </div>
      </Container>

      <a
        href="#trust"
        className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-[10px] font-medium uppercase tracking-[0.3em] text-ink-400 transition hover:text-gold-300 lg:flex"
      >
        <MouseCircle size={22} className="animate-float" />
        {t("landing.hero.scroll")}
      </a>
    </section>
  );
}
