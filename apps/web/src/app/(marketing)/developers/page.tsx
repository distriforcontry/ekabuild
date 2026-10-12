import type { Metadata } from "next";
import { Buildings2, Card, Personalcard, ShieldTick, UserTick } from "iconsax-reactjs";
import { EmptyState } from "@/components/ui/misc";
import { Reveal } from "@/components/ui/reveal";
import { getI18n } from "@/i18n/server";
import { Container, PageHero } from "@/components/marketing/primitives";
import { fetchPublic } from "@/components/marketing/server-data";
import { asList } from "@/components/marketing/format";
import { ApiErrorState } from "@/components/marketing/ApiErrorState";
import { DevelopersGrid, type DeveloperListItem } from "@/components/marketing/developers/DevelopersGrid";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("landing.pages.developers.metaTitle"), description: t("landing.pages.developers.metaDescription") };
}

const HOW_ICONS = [Card, ShieldTick, UserTick, Personalcard];

export default async function DevelopersPage() {
  const { t, raw } = await getI18n();
  const res = await fetchPublic<unknown>("/developers", { pageSize: 100 });
  const developers = asList<DeveloperListItem>(res.data);
  const how = raw<{ title: string; text: string }[]>("landing.pages.developers.how") ?? [];

  return (
    <>
      <PageHero
        eyebrow={t("landing.pages.developers.eyebrow")}
        title={t("landing.pages.developers.title")}
        description={t("landing.pages.developers.description")}
        crumbs={[{ href: "/", label: t("landing.common.breadcrumbHome") }, { label: t("common.nav.developers") }]}
      />

      <section className="pb-20">
        <Container>
          {res.error ? (
            <ApiErrorState retryHref="/developers" />
          ) : developers.length === 0 ? (
            <EmptyState icon={Buildings2} title={t("landing.pages.developers.noDataTitle")} description={t("landing.pages.developers.noDataText")} />
          ) : (
            <DevelopersGrid developers={developers} />
          )}
        </Container>
      </section>

      <section className="border-t border-line bg-ink-900/30 py-20 md:py-24">
        <Container>
          <Reveal>
            <h2 className="font-display text-4xl text-stone-100 md:text-5xl">{t("landing.pages.developers.howTitle")}</h2>
          </Reveal>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {how.map((s, i) => {
              const Icon = HOW_ICONS[i % HOW_ICONS.length]!;
              return (
                <Reveal as="li" key={i} delay={i * 0.07}>
                  <div className="group relative h-full rounded-3xl border border-line bg-ink-900/70 p-6 transition-all duration-500 hover:-translate-y-1 hover:border-gold-500/30">
                    <div className="flex items-center justify-between">
                      <span className="grid size-12 place-items-center rounded-2xl border border-gold-500/25 bg-gold-500/10 text-gold-300 transition group-hover:bg-gold-gradient group-hover:text-onyx">
                        <Icon size={22} variant="Bulk" />
                      </span>
                      <span className="font-mono text-xs text-ink-500">{String(i + 1).padStart(2, "0")}</span>
                    </div>
                    <h3 className="mt-5 font-semibold text-stone-100">{s.title}</h3>
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
