import Link from "next/link";
import { ArrowRight, Call, Clock } from "iconsax-reactjs";
import { LogoMark } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { getI18n } from "@/i18n/server";
import { Container } from "@/components/marketing/primitives";
import { OpenSupportButton } from "@/components/support/OpenSupportButton";

export async function FinalCta({ cabinetHref }: { cabinetHref: string | null }) {
  const { t } = await getI18n();
  return (
    <section className="relative py-24 md:py-32">
      <Container>
        <Reveal>
          <div className="relative isolate overflow-hidden rounded-[2rem] border border-gold-500/25 bg-ink-900 px-6 py-16 text-center shadow-lift sm:px-12 md:py-24">
            <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
              <div className="bg-blueprint absolute inset-0 opacity-80 [mask-image:radial-gradient(ellipse_at_center,black_10%,transparent_70%)]" />
              <div className="absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-gold-500 opacity-25 blur-[120px]" />
              <div className="absolute -bottom-32 left-1/2 h-64 w-[520px] -translate-x-1/2 rounded-full bg-gold-300 opacity-10 blur-[100px]" />
              <div className="bg-noise absolute inset-0" />
            </div>
            <LogoMark className="mx-auto h-20 drop-shadow-[0_10px_40px_rgb(201_164_100/0.45)]" />
            <div className="mt-8 text-xs font-semibold uppercase tracking-[0.28em] text-gold-400">{t("landing.cta.eyebrow")}</div>
            <h2 className="mx-auto mt-4 max-w-3xl font-display text-4xl leading-[1.05] text-stone-100 sm:text-5xl md:text-6xl">{t("landing.cta.title")}</h2>
            <p className="mx-auto mt-5 max-w-xl text-base text-ink-300 md:text-lg">{t("landing.cta.text")}</p>
            <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild variant="gold" size="xl" className="group">
                <Link href={cabinetHref ?? "/register"}>
                  {cabinetHref ? t("common.nav.cabinet") : t("landing.cta.primary")}
                  <ArrowRight className="transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button asChild variant="secondary" size="xl">
                <Link href="/projects">{t("landing.cta.secondary")}</Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

export async function ContactStrip() {
  const { t } = await getI18n();
  return (
    <section aria-label={t("common.nav.contact")} className="border-t border-line bg-ink-900/40">
      <Container className="flex flex-col items-start gap-6 py-10 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl">
          <h2 className="text-xl font-semibold text-stone-100 md:text-2xl">{t("landing.contactStrip.title")}</h2>
          <p className="mt-1.5 text-sm text-ink-300">{t("landing.contactStrip.text")}</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <a
            href={t("common.contact.phoneHref")}
            className="group flex items-center gap-3 rounded-2xl border border-line bg-ink-900 px-4 py-2.5 transition hover:border-gold-500/40"
            aria-label={`${t("landing.contactStrip.call")}: ${t("common.contact.phone")}`}
          >
            <span className="relative grid size-10 place-items-center rounded-xl bg-gold-gradient text-onyx">
              <span aria-hidden className="absolute inset-0 animate-pulse-ring rounded-xl bg-gold-400" />
              <Call size={18} variant="Bold" className="relative" />
            </span>
            <span>
              <span className="flex items-center gap-1.5 text-[11px] text-ink-400">
                <Clock size={12} />
                {t("common.contact.hours")}
              </span>
              <span className="block font-mono text-lg font-semibold tracking-wide text-stone-100 transition group-hover:text-gold-300">{t("common.contact.phone")}</span>
            </span>
          </a>
          <OpenSupportButton variant="outline" size="lg">
            {t("landing.contactStrip.chat")}
          </OpenSupportButton>
        </div>
      </Container>
    </section>
  );
}
