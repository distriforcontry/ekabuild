import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { notFound } from "next/navigation";
import { ArrowRight2, InfoCircle } from "iconsax-reactjs";
import type { ProjectDetail } from "@/lib/types";
import { serverApi, ServerApiError } from "@/lib/api-server";
import { getI18n } from "@/i18n/server";
import { makeFormat } from "@/components/catalog/format";
import { ErrorCard } from "@/components/catalog/states";
import { ProjectProvider } from "@/components/project/ProjectProvider";
import { ProjectHero } from "@/components/project/ProjectHero";
import { ProjectTabs } from "@/components/project/ProjectTabs";
import { TrustPanel } from "@/components/project/TrustPanel";

type Params = { params: Promise<{ slug: string }> };
type Result = { project: ProjectDetail | null; notFound: boolean };

const getProject = cache(async (slug: string): Promise<Result> => {
  try {
    const project = await serverApi<ProjectDetail>(`/projects/${encodeURIComponent(slug)}`);
    return { project: normalize(project), notFound: false };
  } catch (e) {
    if (e instanceof ServerApiError && e.status === 404) return { project: null, notFound: true };
    return { project: null, notFound: false };
  }
});

/** Defensive defaults so a partial payload never crashes the client tabs. */
function normalize(p: ProjectDetail): ProjectDetail {
  return {
    ...p,
    gallery: Array.isArray(p.gallery) ? p.gallery.filter(Boolean) : [],
    trustBreakdown: p.trustBreakdown ?? [],
    certificates: p.certificates ?? [],
    documents: p.documents ?? [],
    inspections: (p.inspections ?? []).map((i) => ({ ...i, violations: i.violations ?? [], files: i.files ?? [] })),
    progressUpdates: (p.progressUpdates ?? []).map((u) => ({ ...u, media: u.media ?? [] })),
    unitsSummary: p.unitsSummary ?? { AVAILABLE: p.unitsAvailable ?? 0, RESERVED: 0, SOLD: Math.max(0, (p.unitsTotal ?? 0) - (p.unitsAvailable ?? 0)) },
    viewer: p.viewer ?? { authenticated: false, isFavorite: false, hasAccess: false, isOwner: false, purchases: [] },
    sections: p.sections ?? 1,
    views: p.views ?? 0,
  };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const { t, tr } = await getI18n();
  const { project: p, notFound: nf } = await getProject(slug);
  if (!p) return { title: nf ? t("catalog.detail.notFound.title") : t("catalog.meta.detailFallback") };
  const title = tr(p.name);
  const description = tr(p.tagline ?? p.description?.replace(/\s+/g, " ").slice(0, 170) ?? t("catalog.meta.description"));
  const image = p.coverUrl ?? p.gallery[0];
  return {
    title,
    description,
    alternates: { canonical: `/projects/${p.slug}` },
    openGraph: { title, description, type: "website", images: image ? [image] : undefined },
    twitter: { card: image ? "summary_large_image" : "summary", title, description },
  };
}

export default async function ProjectPage({ params }: Params) {
  const { slug } = await params;
  const { project: p, notFound: nf } = await getProject(slug);
  if (nf) notFound();
  const i18n = await getI18n();
  const { t, tr } = i18n;
  const fmt = makeFormat(i18n);

  if (!p) {
    return (
      <div className="mx-auto max-w-3xl px-4 pb-24 pt-32 sm:px-6">
        <ErrorCard title={t("catalog.detail.error.title")} hint={t("catalog.detail.error.hint")} backHref="/projects" backLabel={t("catalog.detail.error.back")} />
      </div>
    );
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ApartmentComplex",
    name: p.name,
    description: p.tagline ?? undefined,
    image: p.coverUrl ?? p.gallery[0] ?? undefined,
    address: { "@type": "PostalAddress", streetAddress: p.address, addressRegion: p.region, addressCountry: "UZ" },
    geo: Number.isFinite(p.lat) ? { "@type": "GeoCoordinates", latitude: p.lat, longitude: p.lng } : undefined,
  };

  return (
    <div className="relative isolate pb-24 pt-24 md:pb-32">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[620px] overflow-hidden">
        <div className="bg-blueprint mask-fade-b absolute inset-0 opacity-60" />
        <div className="absolute right-[-10%] top-[-160px] h-[460px] w-[760px] rounded-full bg-gold-500/10 blur-[130px]" />
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <nav aria-label="breadcrumb" className="mb-6 pt-4 md:mb-8 md:pt-8">
          <ol className="flex min-w-0 items-center gap-1.5 text-xs text-ink-400">
            <li>
              <Link href="/projects" className="transition hover:text-gold-300">
                {t("catalog.detail.breadcrumb")}
              </Link>
            </li>
            <li aria-hidden>
              <ArrowRight2 size={12} />
            </li>
            <li>
              <Link href={`/projects?region=${encodeURIComponent(p.region)}`} className="transition hover:text-gold-300">
                {fmt.region(p.region)}
              </Link>
            </li>
            <li aria-hidden>
              <ArrowRight2 size={12} />
            </li>
            <li className="truncate text-ink-200" aria-current="page">
              {tr(p.name)}
            </li>
          </ol>
        </nav>

        {p.published === false && (
          <div className="mb-6 flex items-center gap-2 rounded-2xl border border-warning/30 bg-warning/8 px-4 py-3 text-sm text-warning">
            <InfoCircle size={18} variant="Bold" />
            {t("catalog.detail.unpublished")}
          </div>
        )}

        <ProjectProvider project={p}>
          <ProjectHero />
          <div className="mt-14 grid gap-8 lg:mt-20 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px] xl:gap-10">
            <aside className="min-w-0 lg:order-2">
              <div className="lg:sticky lg:top-24">
                <TrustPanel />
              </div>
            </aside>
            <div className="min-w-0 lg:order-1">
              <ProjectTabs />
            </div>
          </div>
        </ProjectProvider>
      </div>
    </div>
  );
}
