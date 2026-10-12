import type { Metadata } from "next";
import { Danger, Mobile, ScanBarcode, TickSquare } from "iconsax-reactjs";
import { Reveal } from "@/components/ui/reveal";
import { StatusBadge } from "@/components/ui/status-badge";
import { getI18n } from "@/i18n/server";
import { Container, PageHero } from "@/components/marketing/primitives";
import { VerifyWidget } from "@/components/landing/VerifyWidget";
import { ReportFraudDialog } from "@/components/marketing/ReportFraudDialog";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("landing.pages.verify.metaTitle"), description: t("landing.pages.verify.metaDescription") };
}

const STATUSES = ["VERIFIED", "PENDING", "EXPIRED", "REVOKED", "REJECTED"] as const;
const STEP_ICONS = [Mobile, ScanBarcode, TickSquare];

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ number?: string | string[]; tab?: string | string[] }> }) {
  const sp = await searchParams;
  const { t, raw } = await getI18n();
  const number = typeof sp.number === "string" ? sp.number : "";
  const tab = typeof sp.tab === "string" ? sp.tab : "";
  const defaultTab = number ? "number" : tab === "file" || tab === "number" ? tab : "code";
  const steps = raw<{ title: string; text: string }[]>("landing.pages.verify.steps") ?? [];

  return (
    <>
      <PageHero
        eyebrow={t("landing.pages.verify.eyebrow")}
        title={t("landing.pages.verify.title")}
        description={t("landing.pages.verify.description")}
        crumbs={[{ href: "/", label: t("landing.common.breadcrumbHome") }, { label: t("common.nav.verify") }]}
      />

      <section className="pb-20 md:pb-28">
        <Container className="grid items-start gap-6 lg:grid-cols-12 lg:gap-8">
          <Reveal className="lg:col-span-7">
            <div id="check" className="relative scroll-mt-28">
              <div aria-hidden className="absolute -inset-px rounded-[28px] bg-gradient-to-br from-gold-400/40 via-gold-500/5 to-transparent" />
              <div className="relative rounded-[27px] bg-ink-900/95 p-5 shadow-lift sm:p-8">
                <VerifyWidget tabs={["code", "number", "file"]} defaultTab={defaultTab} initialNumber={number} />
              </div>
            </div>
          </Reveal>

          <aside className="space-y-6 lg:col-span-5">
            <Reveal delay={0.08}>
              <div className="rounded-3xl border border-line bg-ink-900/70 p-6 shadow-card">
                <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-ink-400">{t("landing.pages.verify.statusesTitle")}</h2>
                <ul className="mt-5 space-y-4">
                  {STATUSES.map((s) => (
                    <li key={s} className="flex items-start gap-3">
                      <StatusBadge kind="certificateStatus" value={s} className="mt-0.5 shrink-0" />
                      <span className="text-sm leading-relaxed text-ink-300">{t(`landing.pages.verify.statuses.${s}`)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal delay={0.14}>
              <div className="relative overflow-hidden rounded-3xl border border-danger/25 bg-danger/[0.05] p-6">
                <div aria-hidden className="absolute -right-12 -top-12 size-40 rounded-full bg-danger/15 blur-3xl" />
                <div className="relative flex items-start gap-3">
                  <Danger size={22} variant="Bulk" className="mt-0.5 shrink-0 text-danger" />
                  <div>
                    <h2 className="font-semibold text-stone-100">{t("landing.pages.verify.warnTitle")}</h2>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-300">{t("landing.pages.verify.warnText")}</p>
                  </div>
                </div>
                <ReportFraudDialog variant="outline" size="md" className="relative mt-5 border-danger/40 text-danger hover:border-danger hover:bg-danger/10" />
              </div>
            </Reveal>
          </aside>
        </Container>

        <Container className="mt-20">
          <Reveal>
            <h2 className="font-display text-3xl text-stone-100 md:text-4xl">{t("landing.pages.verify.stepsTitle")}</h2>
          </Reveal>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {steps.map((s, i) => {
              const Icon = STEP_ICONS[i % STEP_ICONS.length]!;
              return (
                <Reveal as="li" key={i} delay={i * 0.08}>
                  <div className="group relative h-full overflow-hidden rounded-3xl border border-line bg-ink-900/60 p-6 transition-all duration-500 hover:-translate-y-1 hover:border-gold-500/30">
                    <span aria-hidden className="absolute -right-2 -top-6 font-display text-[110px] leading-none text-fg/[0.04]">
                      {i + 1}
                    </span>
                    <span className="grid size-12 place-items-center rounded-2xl border border-gold-500/25 bg-gold-500/10 text-gold-300 transition group-hover:bg-gold-gradient group-hover:text-onyx">
                      <Icon size={22} variant="Bulk" />
                    </span>
                    <h3 className="mt-5 text-lg font-semibold text-stone-100">{s.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-300">{s.text}</p>
                  </div>
                </Reveal>
              );
            })}
          </ol>
        </Container>
      </section>
    </>
  );
}
