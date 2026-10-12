import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Building,
  Clipboard,
  DocumentText,
  Eye,
  Hierarchy,
  Lock1,
  Map1,
  MessageQuestion,
  People,
  SearchStatus,
  SecuritySafe,
  ShieldTick,
  Timer1,
  UserTick,
} from "iconsax-reactjs";
import { LogoMark } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { TrustRing } from "@/components/ui/trust-ring";
import { getI18n } from "@/i18n/server";
import { Container, GoldDivider, PageHero } from "@/components/marketing/primitives";
import { DemoBar } from "@/components/landing/FeatureVisuals";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("landing.pages.about.metaTitle"), description: t("landing.pages.about.metaDescription") };
}

type TitleText = { title: string; text: string };
type Factor = TitleText & { max: string };
type Level = TitleText & { range: string };

const VALUE_ICONS = [Eye, SearchStatus, SecuritySafe, People];
const FACTOR_ICONS = [UserTick, DocumentText, Map1, Clipboard, Timer1, MessageQuestion];
const PIPE_ICONS = [UserTick, DocumentText, Map1, SearchStatus, Hierarchy];
const LEVEL_TONES = [
  { text: "text-success", border: "border-success/30", bg: "bg-success/10" },
  { text: "text-info", border: "border-info/30", bg: "bg-info/10" },
  { text: "text-warning", border: "border-warning/30", bg: "bg-warning/10" },
  { text: "text-danger", border: "border-danger/30", bg: "bg-danger/10" },
];
// example breakdown used for the demo ring (sums to the ring's score)
const DEMO = [15, 36, 15, 13, 12, 0];

export default async function AboutPage() {
  const { t, raw } = await getI18n();
  const values = raw<TitleText[]>("landing.pages.about.values") ?? [];
  const factors = raw<Factor[]>("landing.pages.about.factors") ?? [];
  const levels = raw<Level[]>("landing.pages.about.levels") ?? [];
  const pipeline = raw<TitleText[]>("landing.pages.about.pipeline") ?? [];
  const demoScore = DEMO.reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHero
        eyebrow={t("landing.pages.about.eyebrow")}
        title={t("landing.pages.about.title")}
        description={t("landing.pages.about.description")}
        crumbs={[{ href: "/", label: t("landing.common.breadcrumbHome") }, { label: t("common.nav.about") }]}
      />

      {/* mission */}
      <section className="pb-20 md:pb-28">
        <Container className="grid items-center gap-10 lg:grid-cols-12">
          <Reveal className="lg:col-span-7">
            <h2 className="text-xs font-semibold uppercase tracking-[0.24em] text-gold-400">{t("landing.pages.about.missionTitle")}</h2>
            <p className="mt-5 text-lg leading-relaxed text-ink-200 md:text-xl">{t("landing.pages.about.mission")}</p>
          </Reveal>
          <Reveal className="lg:col-span-5" delay={0.1}>
            <figure className="relative overflow-hidden rounded-[2rem] border border-gold-500/25 bg-gradient-to-br from-gold-500/10 via-ink-900 to-ink-900 p-8 shadow-lift md:p-10">
              <div aria-hidden className="bg-blueprint absolute inset-0 opacity-60" />
              <LogoMark className="relative h-14" />
              <blockquote className="relative mt-6 font-display text-3xl italic leading-snug text-stone-100 md:text-4xl">“{t("landing.pages.about.quote")}”</blockquote>
              <figcaption className="relative mt-5 text-sm text-gold-300">— {t("landing.pages.about.quoteAuthor")}</figcaption>
            </figure>
          </Reveal>
        </Container>
      </section>

      {/* values */}
      <section className="border-y border-line bg-ink-900/30 py-20 md:py-28">
        <Container>
          <Reveal>
            <h2 className="font-display text-4xl text-stone-100 md:text-5xl">{t("landing.pages.about.valuesTitle")}</h2>
          </Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((v, i) => {
              const Icon = VALUE_ICONS[i % VALUE_ICONS.length]!;
              return (
                <Reveal key={v.title} delay={i * 0.07}>
                  <div className="group h-full rounded-3xl border border-line bg-ink-900/70 p-6 transition-all duration-500 hover:-translate-y-1 hover:border-gold-500/30 hover:shadow-lift">
                    <span className="grid size-12 place-items-center rounded-2xl border border-gold-500/25 bg-gold-500/10 text-gold-300 transition group-hover:bg-gold-gradient group-hover:text-onyx">
                      <Icon size={22} variant="Bulk" />
                    </span>
                    <h3 className="mt-5 text-lg font-semibold text-stone-100">{v.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-300">{v.text}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </Container>
      </section>

      {/* trust score explained */}
      <section id="trust-score" className="scroll-mt-24 py-20 md:py-28">
        <Container>
          <div className="grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <Reveal>
                <div className="mb-4 inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.28em] text-gold-400">
                  <span className="h-px w-8 bg-gold-500/60" />
                  {t("landing.features.trust.title")}
                </div>
                <h2 className="font-display text-4xl leading-[1.05] text-stone-100 md:text-5xl">{t("landing.pages.about.trustTitle")}</h2>
                <p className="mt-5 text-base leading-relaxed text-ink-300">{t("landing.pages.about.trustText")}</p>
              </Reveal>

              <Reveal delay={0.1}>
                <div className="mt-8 rounded-3xl border border-line bg-ink-900/70 p-6 shadow-card">
                  <div className="text-xs font-semibold uppercase tracking-wider text-ink-400">{t("landing.pages.about.demoTitle")}</div>
                  <div className="mt-5 flex items-center gap-6">
                    <TrustRing score={demoScore} size={120} stroke={9} />
                    <ul className="min-w-0 flex-1 space-y-2">
                      {factors.map((f, i) => (
                        <li key={f.title}>
                          <div className="mb-1 flex justify-between gap-2 text-[11px]">
                            <span className="truncate text-ink-300">{f.title}</span>
                            <span className="font-mono text-ink-400">
                              {DEMO[i] ?? 0}/{f.max}
                            </span>
                          </div>
                          <DemoBar value={DEMO[i] ?? 0} max={Number(f.max) || 1} delay={i * 0.08} />
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Reveal>

              <Reveal delay={0.15}>
                <h3 className="mt-10 text-xs font-semibold uppercase tracking-[0.22em] text-ink-400">{t("landing.pages.about.levelsTitle")}</h3>
                <ul className="mt-4 space-y-2.5">
                  {levels.map((l, i) => {
                    const tone = LEVEL_TONES[i % LEVEL_TONES.length]!;
                    return (
                      <li key={l.range} className={cn("flex items-start gap-4 rounded-2xl border p-4", tone.border, tone.bg)}>
                        <span className={cn("w-16 shrink-0 font-mono text-sm font-semibold", tone.text)}>{l.range}</span>
                        <span>
                          <span className={cn("block text-sm font-semibold", tone.text)}>{l.title}</span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-ink-300">{l.text}</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </Reveal>
            </div>

            <div className="lg:col-span-7">
              <ol className="grid gap-4 sm:grid-cols-2">
                {factors.map((f, i) => {
                  const Icon = FACTOR_ICONS[i % FACTOR_ICONS.length]!;
                  return (
                    <Reveal as="li" key={f.title} delay={i * 0.06}>
                      <div className="group relative h-full overflow-hidden rounded-3xl border border-line bg-ink-900/70 p-6 shadow-card transition-all duration-500 hover:-translate-y-1 hover:border-gold-500/30">
                        <div className="flex items-start justify-between gap-3">
                          <span className="grid size-11 place-items-center rounded-2xl border border-gold-500/25 bg-gold-500/10 text-gold-300 transition group-hover:bg-gold-gradient group-hover:text-onyx">
                            <Icon size={20} variant="Bulk" />
                          </span>
                          <span className="rounded-full border border-gold-500/30 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-gold-200">
                            {t("landing.pages.about.trustMax", { n: f.max })}
                          </span>
                        </div>
                        <h3 className="mt-5 text-lg font-semibold text-stone-100">{f.title}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-ink-300">{f.text}</p>
                        <div className="mt-5 h-1 overflow-hidden rounded-full bg-fg/8">
                          <div className="h-full rounded-full bg-gold-gradient" style={{ width: `${Math.min(100, (Number(f.max) / 40) * 100)}%` }} />
                        </div>
                      </div>
                    </Reveal>
                  );
                })}
              </ol>
              <p className="mt-5 text-xs text-ink-400">{t("landing.pages.about.trustNote")}</p>
            </div>
          </div>
        </Container>
      </section>

      {/* pipeline */}
      <section className="relative isolate overflow-hidden border-y border-line bg-ink-900/30 py-20 md:py-28">
        <div aria-hidden className="bg-blueprint pointer-events-none absolute inset-0 -z-10 opacity-60 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
        <Container>
          <Reveal>
            <h2 className="text-center font-display text-4xl text-stone-100 md:text-5xl">{t("landing.pages.about.pipelineTitle")}</h2>
          </Reveal>
          <ol className="relative mt-14 grid gap-6 md:grid-cols-5">
            <div aria-hidden className="absolute left-[10%] right-[10%] top-7 hidden h-px bg-gradient-to-r from-gold-500/0 via-gold-500/50 to-gold-500/0 md:block" />
            {pipeline.map((p, i) => {
              const Icon = PIPE_ICONS[i % PIPE_ICONS.length]!;
              return (
                <Reveal as="li" key={p.title} delay={i * 0.08} className="relative text-center">
                  <span className="relative mx-auto grid size-14 place-items-center rounded-2xl border border-gold-400/50 bg-ink-900 text-gold-300 shadow-glow">
                    <Icon size={24} variant="Bulk" />
                  </span>
                  <h3 className="mt-5 font-semibold text-stone-100">{p.title}</h3>
                  <p className="mx-auto mt-1.5 max-w-[24ch] text-sm leading-relaxed text-ink-300">{p.text}</p>
                </Reveal>
              );
            })}
          </ol>
        </Container>
      </section>

      {/* legal */}
      <section className="py-20 md:py-24">
        <Container>
          <Reveal>
            <h2 className="font-display text-3xl text-stone-100 md:text-4xl">{t("landing.pages.about.legalTitle")}</h2>
          </Reveal>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <Reveal>
              <div id="privacy" className="h-full scroll-mt-28 rounded-3xl border border-line bg-ink-900/70 p-6 md:p-8">
                <Lock1 size={24} variant="Bulk" className="text-gold-400" />
                <h3 className="mt-4 text-lg font-semibold text-stone-100">{t("landing.pages.about.privacyTitle")}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-300">{t("landing.pages.about.privacyText")}</p>
              </div>
            </Reveal>
            <Reveal delay={0.07}>
              <div id="terms" className="h-full scroll-mt-28 rounded-3xl border border-line bg-ink-900/70 p-6 md:p-8">
                <ShieldTick size={24} variant="Bulk" className="text-gold-400" />
                <h3 className="mt-4 text-lg font-semibold text-stone-100">{t("landing.pages.about.termsTitle")}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-300">{t("landing.pages.about.termsText")}</p>
              </div>
            </Reveal>
          </div>

          <GoldDivider className="my-16" />

          <Reveal className="flex flex-col items-center text-center">
            <Building size={30} variant="Bulk" className="text-gold-400" />
            <h2 className="mt-4 max-w-2xl font-display text-4xl text-stone-100 md:text-5xl">{t("landing.cta.title")}</h2>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="gold" size="lg" className="group">
                <Link href="/projects">
                  {t("landing.cta.secondary")}
                  <ArrowRight className="transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/contact">{t("common.nav.contact")}</Link>
              </Button>
            </div>
          </Reveal>
        </Container>
      </section>
    </>
  );
}
