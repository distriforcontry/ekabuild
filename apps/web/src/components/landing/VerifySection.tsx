import Link from "next/link";
import { ArrowRight, Building, Calendar, DocumentCode, ShieldTick } from "iconsax-reactjs";
import { Reveal } from "@/components/ui/reveal";
import { RevealHeading } from "@/components/marketing/text";
import { getI18n } from "@/i18n/server";
import { Container } from "@/components/marketing/primitives";
import { VerifyWidget } from "./VerifyWidget";

const ICONS = [ShieldTick, Calendar, Building, DocumentCode];

export async function VerifySection() {
  const { t, raw } = await getI18n();
  const points = raw<{ title: string; text: string }[]>("landing.verify.points") ?? [];

  return (
    <section id="verify" className="relative isolate scroll-mt-24 overflow-hidden py-24 md:py-32">
      <div aria-hidden className="pointer-events-none absolute right-[-15%] top-1/4 -z-10 size-[640px] rounded-full bg-gold-500 opacity-[0.08] blur-[140px]" />
      <Container className="grid items-start gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:sticky lg:top-28 lg:col-span-5">
          <RevealHeading eyebrow={t("landing.verify.eyebrow")} title={t("landing.verify.title")} description={t("landing.verify.description")} />
          <Reveal delay={0.1}>
            <h3 className="mt-10 text-xs font-semibold uppercase tracking-[0.22em] text-ink-400">{t("landing.verify.pointsTitle")}</h3>
            <ul className="mt-5 space-y-4">
              {points.map((p, i) => {
                const Icon = ICONS[i % ICONS.length]!;
                return (
                  <li key={i} className="flex gap-4">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-gold-500/25 bg-gold-500/10 text-gold-300">
                      <Icon size={18} variant="Bulk" />
                    </span>
                    <div>
                      <div className="font-semibold text-stone-100">{p.title}</div>
                      <p className="mt-0.5 text-sm leading-relaxed text-ink-300">{p.text}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
            <Link href="/verify" className="group mt-8 inline-flex items-center gap-2 text-sm font-semibold text-gold-300">
              {t("common.actions.more")}
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </Link>
          </Reveal>
        </div>

        <Reveal delay={0.15} className="lg:col-span-7">
          <div className="relative">
            <div aria-hidden className="absolute -inset-px rounded-[28px] bg-gradient-to-br from-gold-400/40 via-gold-500/5 to-transparent" />
            <div className="relative rounded-[27px] bg-ink-900/95 p-5 shadow-lift backdrop-blur-xl sm:p-8">
              <div className="mb-6 flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-2xl bg-gold-gradient text-onyx shadow-glow">
                  <ShieldTick size={22} variant="Bold" />
                </span>
                <div>
                  <div className="font-semibold text-stone-100">{t("landing.verify.eyebrow")}</div>
                  <div className="font-mono text-xs text-ink-400">ekabuild.uz/verify</div>
                </div>
              </div>
              <VerifyWidget />
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
