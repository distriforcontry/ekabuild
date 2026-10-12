import type { Metadata } from "next";
import { ArrowRight, Call, Clock, Location, Send2, Sms } from "iconsax-reactjs";
import type { Icon as IconType } from "iconsax-reactjs";
import { Reveal } from "@/components/ui/reveal";
import { getI18n } from "@/i18n/server";
import { getCurrentUser } from "@/lib/api-server";
import { Container, PageHero } from "@/components/marketing/primitives";
import { ContactForm } from "@/components/marketing/ContactForm";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("landing.pages.contact.metaTitle"), description: t("landing.pages.contact.metaDescription") };
}

export default async function ContactPage() {
  const [{ t }, user] = await Promise.all([getI18n(), getCurrentUser()]);
  const telegram = t("common.contact.telegram");

  const cards: { Icon: IconType; title: string; value: string; hint: string; href?: string; mono?: boolean; external?: boolean }[] = [
    { Icon: Call, title: t("landing.pages.contact.phone"), value: t("common.contact.phone"), hint: t("landing.pages.contact.phoneText"), href: t("common.contact.phoneHref"), mono: true },
    { Icon: Sms, title: t("landing.pages.contact.email"), value: t("common.contact.email"), hint: t("landing.pages.contact.emailText"), href: `mailto:${t("common.contact.email")}` },
    {
      Icon: Send2,
      title: t("landing.pages.contact.telegram"),
      value: `@${telegram.replace(/^https?:\/\/t\.me\//, "")}`,
      hint: t("landing.pages.contact.telegramText"),
      href: telegram,
      external: true,
    },
    { Icon: Clock, title: t("landing.pages.contact.hours"), value: t("common.contact.hours"), hint: t("common.contact.address") },
  ];

  return (
    <>
      <PageHero
        eyebrow={t("landing.pages.contact.eyebrow")}
        title={t("landing.pages.contact.title")}
        description={t("landing.pages.contact.description")}
        crumbs={[{ href: "/", label: t("landing.common.breadcrumbHome") }, { label: t("common.nav.contact") }]}
      />

      <section className="pb-12">
        <Container>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((c, i) => {
              const inner = (
                <>
                  <div className="flex items-center justify-between">
                    <span className="grid size-12 place-items-center rounded-2xl border border-gold-500/25 bg-gold-500/10 text-gold-300 transition group-hover:bg-gold-gradient group-hover:text-onyx">
                      <c.Icon size={22} variant="Bulk" />
                    </span>
                    {c.href && <ArrowRight size={18} className="-rotate-45 text-ink-500 transition group-hover:rotate-0 group-hover:text-gold-300" />}
                  </div>
                  <div className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-ink-400">{c.title}</div>
                  <div className={c.mono ? "mt-1.5 font-mono text-lg font-semibold tracking-wide text-stone-100" : "mt-1.5 text-lg font-semibold text-stone-100"}>{c.value}</div>
                  <div className="mt-1 text-sm text-ink-400">{c.hint}</div>
                </>
              );
              const cls =
                "group block h-full rounded-3xl border border-line bg-ink-900/70 p-6 shadow-card transition-all duration-500 hover:-translate-y-1 hover:border-gold-500/30 hover:shadow-lift";
              return (
                <Reveal as="li" key={c.title} delay={i * 0.06}>
                  {c.href ? (
                    <a href={c.href} className={cls} {...(c.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                      {inner}
                    </a>
                  ) : (
                    <div className={cls}>{inner}</div>
                  )}
                </Reveal>
              );
            })}
          </ul>
        </Container>
      </section>

      <section className="pb-24">
        <Container className="grid items-stretch gap-6 lg:grid-cols-12">
          <Reveal className="lg:col-span-7">
            <div className="h-full rounded-[2rem] border border-line bg-ink-900/80 p-6 shadow-card sm:p-10">
              <h2 className="font-display text-3xl text-stone-100 md:text-4xl">{t("landing.pages.contact.formTitle")}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-300">{t("landing.pages.contact.formText")}</p>
              <div className="mt-8">
                <ContactForm defaultName={user?.fullName ?? ""} />
              </div>
            </div>
          </Reveal>

          <Reveal className="lg:col-span-5" delay={0.08}>
            <div className="relative isolate flex h-full min-h-[420px] flex-col justify-end overflow-hidden rounded-[2rem] border border-gold-500/20 bg-ink-900 p-8 shadow-lift">
              {/* stylised city map */}
              <div aria-hidden className="absolute inset-0 -z-10">
                <div className="bg-blueprint absolute inset-0" />
                <svg viewBox="0 0 400 420" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
                  <g className="stroke-ink-600" strokeWidth="10" fill="none" strokeLinecap="round">
                    <path d="M-20 120 C 80 140, 160 90, 260 130 S 380 170, 440 150" />
                    <path d="M60 -20 C 90 120, 70 260, 120 440" />
                    <path d="M300 -20 C 260 120, 330 260, 290 440" />
                    <path d="M-20 300 C 120 280, 260 330, 440 290" />
                  </g>
                  <g className="stroke-ink-700" strokeWidth="4" fill="none">
                    <path d="M-20 210 L 440 230" />
                    <path d="M190 -20 L 210 440" />
                    <path d="M-20 40 L 440 70" />
                  </g>
                  <path d="M150 160 L 240 150 L 250 230 L 160 240 Z" fill="rgb(201 164 100 / 0.14)" stroke="#c9a464" strokeWidth="1.5" strokeDasharray="5 4" />
                </svg>
                <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/60 to-transparent" />
              </div>
              <span className="absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2">
                <span className="absolute left-1/2 top-1/2 size-10 -translate-x-1/2 -translate-y-1/2 animate-pulse-ring rounded-full bg-gold-400" />
                <span className="relative grid size-12 place-items-center rounded-full bg-gold-gradient text-onyx shadow-glow">
                  <Location size={22} variant="Bold" />
                </span>
              </span>
              <div className="relative">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-400">{t("landing.pages.contact.address")}</div>
                <div className="mt-2 font-display text-3xl text-stone-100">{t("landing.pages.contact.mapTitle")}</div>
                <p className="mt-2 text-sm text-ink-300">{t("landing.pages.contact.mapText")}</p>
                <a
                  href={t("common.contact.phoneHref")}
                  className="mt-6 inline-flex items-center gap-3 rounded-2xl border border-line bg-ink-950/60 px-4 py-3 backdrop-blur transition hover:border-gold-500/40"
                >
                  <Call size={18} variant="Bold" className="text-gold-400" />
                  <span className="font-mono text-base font-semibold text-stone-100">{t("common.contact.phone")}</span>
                </a>
              </div>
            </div>
          </Reveal>
        </Container>
      </section>
    </>
  );
}
