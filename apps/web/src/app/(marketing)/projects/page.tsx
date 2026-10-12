import type { Metadata } from "next";
import { Map1, SearchStatus, ShieldTick } from "iconsax-reactjs";
import type { Paginated, ProjectCard } from "@/lib/types";
import { serverApiSafe } from "@/lib/api-server";
import { getI18n } from "@/i18n/server";
import type { CSSProperties } from "react";
import { ParallaxLayer } from "@/components/marketing/motion";
import { SmartImg } from "@/components/marketing/SmartImg";
import { SplitWords, wordCount } from "@/components/marketing/text";
import { RENDERS } from "@/components/marketing/renders";
import { ModelBanner } from "@/components/marketing/banners/ModelBanner";
import { CatalogView } from "@/components/catalog/CatalogView";
import { parseFilters, toApiQuery, type SearchParamsRecord } from "@/components/catalog/filters";
import { IS_STATIC, staticSearchParams } from "@/lib/static";

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
  const filters = parseFilters(await staticSearchParams(searchParams));

  let data: Paginated<ProjectCard> | null = null;
  let failed = false;
  try {
    // static demo: every project is prerendered once and filtered in the browser (CatalogView)
    data = await serverApiSafe<Paginated<ProjectCard>>("/projects", { query: IS_STATIC ? { pageSize: 100 } : toApiQuery(filters) });
    if (data && !Array.isArray(data.items)) data = { items: [], total: 0, page: 1, pageSize: 12 };
  } catch {
    failed = true;
  }

  const features = [
    { icon: ShieldTick, text: t("catalog.hero.stats.verified") },
    { icon: Map1, text: t("catalog.hero.stats.cadastre") },
    { icon: SearchStatus, text: t("catalog.hero.stats.inspections") },
  ];

  // the 3D banner opens the first project of the current results straight on its 3D tab
  const first = data?.items?.[0];
  const modelHref = first ? `/projects/${first.slug}#model` : "/projects";
  const band = RENDERS["catalog-band"];
  const nTitle = wordCount(t("catalog.hero.title"));

  return (
    <div className="relative isolate pb-8">
      {/* header band: Cycles render with parallax, dark in both themes */}
      <section className="eka-dark relative isolate -mt-20 overflow-hidden bg-[#0b0b0c]">
        <ParallaxLayer range={70} scale={1.18}>
          <SmartImg src={band.src} srcSet={band.srcSet} sizes="100vw" lqip={band.lqip} priority imgStyle={{ objectPosition: "50% 45%" }} />
        </ParallaxLayer>
        <div aria-hidden className="pointer-events-none absolute inset-0 z-[-5]">
          <div className="absolute inset-0 bg-[linear-gradient(90deg,#0b0b0c_0%,rgb(11_11_12/0.88)_38%,rgb(11_11_12/0.35)_75%,rgb(11_11_12/0.25)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(0deg,rgb(11_11_12/0.9)_0%,transparent_45%,rgb(11_11_12/0.55)_100%)]" />
          <div className="absolute -left-20 top-1/3 size-[520px] rounded-full bg-[#c9a464] opacity-[0.14] blur-[130px]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgb(201_164_100/0.06)_1px,transparent_1px),linear-gradient(90deg,rgb(201_164_100/0.06)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:linear-gradient(90deg,black,transparent_60%)]" />
          <div className="bg-noise absolute inset-0" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#c9a464]/50 to-transparent" />
        </div>

        <div className="mx-auto max-w-7xl px-4 pb-24 pt-36 sm:px-6 md:pb-28 md:pt-44 lg:px-8">
          <div className="mb-5 inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.28em] text-gold-300">
            <span className="eka-draw-x h-px w-8 bg-gold-400/80" />
            <span className="eka-in" style={{ "--d": "60ms" } as CSSProperties}>
              {t("catalog.hero.eyebrow")}
            </span>
          </div>
          <h1 className="max-w-4xl font-display text-5xl font-medium leading-[1.02] text-stone-100 sm:text-6xl md:text-7xl" style={{ "--d": "100ms" } as CSSProperties}>
            <SplitWords text={t("catalog.hero.title")} /> <SplitWords text={t("catalog.hero.titleAccent")} start={nTitle} wordClassName="text-gold-shimmer italic" />
          </h1>
          <p className="eka-in mt-5 max-w-2xl text-base leading-relaxed text-ink-200 md:text-lg" style={{ "--d": "380ms" } as CSSProperties}>
            {t("catalog.hero.subtitle")}
          </p>
          <ul className="mt-7 flex flex-wrap gap-2.5">
            {features.map(({ icon: I, text }, i) => (
              <li
                key={text}
                style={{ "--d": `${480 + i * 90}ms` } as CSSProperties}
                className="eka-in inline-flex items-center gap-2 rounded-full border border-line-strong bg-ink-950/45 px-3.5 py-1.5 text-xs font-medium text-ink-100 backdrop-blur-md"
              >
                <I size={15} variant="Bulk" className="text-gold-300" />
                {text}
              </li>
            ))}
          </ul>
          <p className="eka-in-fade absolute bottom-24 right-8 hidden text-[11px] uppercase tracking-[0.22em] text-ink-300 lg:block" style={{ "--d": "900ms" } as CSSProperties}>
            {t("catalog.hero.bandCaption")}
          </p>
        </div>
      </section>

      {/* results: the elevated glass filter bar overlaps the band */}
      <div className="relative z-10 mx-auto -mt-14 max-w-7xl px-4 sm:px-6 md:-mt-16 lg:px-8">
        <CatalogView data={data ?? { items: [], total: 0, page: 1, pageSize: 12 }} filters={filters} failed={failed} />
      </div>

      <ModelBanner href={modelHref} compact />
    </div>
  );
}
