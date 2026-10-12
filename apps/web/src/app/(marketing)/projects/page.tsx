import type { Metadata } from "next";
import { Map1, SearchStatus, ShieldTick } from "iconsax-reactjs";
import type { Paginated, ProjectCard } from "@/lib/types";
import { serverApiSafe } from "@/lib/api-server";
import { getI18n } from "@/i18n/server";
import { Reveal } from "@/components/ui/reveal";
import { CatalogView } from "@/components/catalog/CatalogView";
import { parseFilters, toApiQuery, type SearchParamsRecord } from "@/components/catalog/filters";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: t("catalog.meta.title"),
    description: t("catalog.meta.description"),
    alternates: { canonical: "/projects" },
    openGraph: { title: t("catalog.meta.title"), description: t("catalog.meta.description") },
  };
}

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const { t } = await getI18n();
  const filters = parseFilters(await searchParams);

  let data: Paginated<ProjectCard> | null = null;
  let failed = false;
  try {
    data = await serverApiSafe<Paginated<ProjectCard>>("/projects", { query: toApiQuery(filters) });
    if (data && !Array.isArray(data.items)) data = { items: [], total: 0, page: 1, pageSize: 12 };
  } catch {
    failed = true;
  }

  const features = [
    { icon: ShieldTick, text: t("catalog.hero.stats.verified") },
    { icon: Map1, text: t("catalog.hero.stats.cadastre") },
    { icon: SearchStatus, text: t("catalog.hero.stats.inspections") },
  ];

  return (
    <div className="relative isolate pb-24 pt-24 md:pb-32">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] overflow-hidden">
        <div className="bg-blueprint mask-fade-b absolute inset-0 opacity-70" />
        <div className="absolute left-1/2 top-[-120px] h-[420px] w-[min(980px,120vw)] -translate-x-1/2 rounded-full bg-gold-500/10 blur-[120px]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="pb-10 pt-8 md:pb-14 md:pt-16">
          <Reveal>
            <div className="mb-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-gold-400">
              <span className="h-px w-8 bg-gold-500/60" />
              {t("catalog.hero.eyebrow")}
            </div>
          </Reveal>
          <Reveal delay={0.06}>
            <h1 className="max-w-4xl font-display text-5xl font-medium leading-[1.02] text-stone-100 sm:text-6xl md:text-7xl">
              {t("catalog.hero.title")} <span className="text-gold-gradient italic">{t("catalog.hero.titleAccent")}</span>
            </h1>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-300 md:text-lg">{t("catalog.hero.subtitle")}</p>
          </Reveal>
          <Reveal delay={0.18}>
            <ul className="mt-7 flex flex-wrap gap-2.5">
              {features.map(({ icon: I, text }) => (
                <li key={text} className="inline-flex items-center gap-2 rounded-full border border-line bg-ink-900/60 px-3.5 py-1.5 text-xs font-medium text-ink-200 backdrop-blur">
                  <I size={15} variant="Bulk" className="text-gold-300" />
                  {text}
                </li>
              ))}
            </ul>
          </Reveal>
        </header>

        <CatalogView data={data ?? { items: [], total: 0, page: 1, pageSize: 12 }} filters={filters} failed={failed} />
      </div>
    </div>
  );
}
