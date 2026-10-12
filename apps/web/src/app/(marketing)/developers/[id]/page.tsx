import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ArrowLeft, Buildings2, Calendar, Global, Location, Verify } from "iconsax-reactjs";
import { EmptyState, InfoRow } from "@/components/ui/misc";
import { Reveal } from "@/components/ui/reveal";
import { TrustRing } from "@/components/ui/trust-ring";
import { getI18n } from "@/i18n/server";
import type { Org, ProjectCard as ProjectCardData } from "@/lib/types";
import { Backdrop, Breadcrumbs, Container } from "@/components/marketing/primitives";
import { fetchPublic } from "@/components/marketing/server-data";
import { ApiErrorState } from "@/components/marketing/ApiErrorState";
import { ReportFraudDialog } from "@/components/marketing/ReportFraudDialog";
import { DeveloperLogo } from "@/components/marketing/developers/DevelopersGrid";
import { ProjectCard } from "@/components/landing/ProjectCard";

type Developer = Org & { projects?: ProjectCardData[]; projectsCount?: number; avgTrust?: number | null };
type Params = { params: Promise<{ id: string }> };

const getDeveloper = cache((id: string) => fetchPublic<Developer>(`/developers/${encodeURIComponent(id)}`));

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const [{ t, tr }, res] = await Promise.all([getI18n(), getDeveloper(id)]);
  if (!res.data) return { title: t("landing.pages.developers.metaTitle") };
  return {
    title: t("landing.pages.developer.metaTitle", { name: tr(res.data.name) }),
    description: res.data.description ? tr(res.data.description).slice(0, 160) : t("landing.pages.developers.metaDescription"),
  };
}

export default async function DeveloperPage({ params }: Params) {
  const { id } = await params;
  const [{ t, tr }, res] = await Promise.all([getI18n(), getDeveloper(id)]);

  if (res.error) {
    return (
      <section className="pb-24 pt-16">
        <Container>
          <ApiErrorState retryHref={`/developers/${encodeURIComponent(id)}`} />
        </Container>
      </section>
    );
  }
  const dev = res.data;
  if (!dev) notFound();

  const projects = dev.projects ?? [];
  const avgTrust =
    typeof dev.avgTrust === "number"
      ? Math.round(dev.avgTrust)
      : projects.length
        ? Math.round(projects.reduce((s, p) => s + (p.trustScore ?? 0), 0) / projects.length)
        : null;
  const website = dev.website ? (dev.website.startsWith("http") ? dev.website : `https://${dev.website}`) : null;

  return (
    <>
      <section className="relative isolate -mt-20 overflow-hidden pb-12 pt-32 md:pt-40">
        <Backdrop />
        <Container>
          <Breadcrumbs
            items={[
              { href: "/", label: t("landing.common.breadcrumbHome") },
              { href: "/developers", label: t("common.nav.developers") },
              { label: tr(dev.name) },
            ]}
          />
          <Reveal>
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                <DeveloperLogo dev={dev} size="lg" />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    {dev.status === "VERIFIED" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                        <Verify size={14} variant="Bold" />
                        {t("landing.pages.developer.verified")}
                      </span>
                    )}
                    {dev.region && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs text-ink-300">
                        <Location size={13} variant="Bulk" className="text-gold-400" />
                        {tr(dev.region)}
                      </span>
                    )}
                    {dev.foundedYear && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs text-ink-300">
                        <Calendar size={13} variant="Bulk" className="text-gold-400" />
                        {t("landing.pages.developers.founded", { year: dev.foundedYear })}
                      </span>
                    )}
                  </div>
                  <h1 className="mt-3 font-display text-4xl leading-tight text-stone-100 sm:text-5xl md:text-6xl">{tr(dev.name)}</h1>
                  {dev.legalName && dev.legalName !== dev.name && <p className="mt-1 text-sm text-ink-400">{tr(dev.legalName)}</p>}
                </div>
              </div>

              <div className="flex items-center gap-5 self-start rounded-3xl border border-line bg-ink-900/80 p-4 pr-6 shadow-card backdrop-blur lg:self-auto">
                {avgTrust !== null && (
                  <div className="flex items-center gap-3">
                    <TrustRing score={avgTrust} size={64} stroke={6} />
                    <div className="max-w-[9rem] text-[11px] uppercase leading-snug tracking-wider text-ink-400">{t("landing.pages.developer.avgTrust")}</div>
                  </div>
                )}
                <div className={avgTrust !== null ? "border-l border-line pl-5" : undefined}>
                  <div className="text-[11px] uppercase tracking-wider text-ink-400">{t("landing.pages.developer.projectsCount")}</div>
                  <div className="mt-1 font-mono text-3xl font-semibold text-stone-100">{dev.projectsCount ?? projects.length}</div>
                </div>
              </div>
            </div>
          </Reveal>
        </Container>
      </section>

      <section className="pb-24">
        <Container className="grid items-start gap-6 lg:grid-cols-12">
          <aside className="space-y-6 lg:sticky lg:top-24 lg:col-span-4">
            {dev.description && (
              <Reveal>
                <div className="rounded-3xl border border-line bg-ink-900/70 p-6 shadow-card">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-400">{t("landing.pages.developer.about")}</h2>
                  <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-200">{tr(dev.description)}</p>
                </div>
              </Reveal>
            )}
            <Reveal delay={0.05}>
              <div className="rounded-3xl border border-line bg-ink-900/70 p-6 shadow-card">
                <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-400">{t("landing.pages.developer.requisites")}</h2>
                <div className="mt-2">
                  <InfoRow label={t("landing.pages.developer.tin")} value={dev.tin} mono />
                  {dev.director && <InfoRow label={t("landing.pages.developer.director")} value={tr(dev.director)} />}
                  {dev.licenseNumber && <InfoRow label={t("landing.pages.developer.license")} value={dev.licenseNumber} mono />}
                  {dev.foundedYear && <InfoRow label={t("landing.pages.developer.founded")} value={dev.foundedYear} mono />}
                  {dev.address && <InfoRow label={t("landing.pages.developer.address")} value={tr(dev.address)} />}
                  {dev.phone && (
                    <InfoRow
                      label={t("landing.pages.developer.phone")}
                      value={
                        <a href={`tel:${dev.phone.replace(/\s/g, "")}`} className="font-mono hover:text-gold-300">
                          {dev.phone}
                        </a>
                      }
                    />
                  )}
                  {dev.email && (
                    <InfoRow
                      label={t("landing.pages.developer.email")}
                      value={
                        <a href={`mailto:${dev.email}`} className="hover:text-gold-300">
                          {dev.email}
                        </a>
                      }
                    />
                  )}
                  {website && (
                    <InfoRow
                      label={t("landing.pages.developer.website")}
                      value={
                        <a href={website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 hover:text-gold-300">
                          <Global size={14} />
                          {website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                        </a>
                      }
                    />
                  )}
                </div>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="flex flex-col gap-3">
                <ReportFraudDialog
                  context={`${t("landing.pages.verifyResult.developer")}: ${dev.name} (${t("landing.pages.developer.tin")} ${dev.tin})`}
                  label={t("landing.pages.developer.report")}
                  defaultCategory="FRAUD"
                  variant="ghost"
                  size="md"
                  className="justify-start text-danger hover:bg-danger/10 hover:text-danger"
                />
                <Link href="/developers" className="inline-flex items-center gap-2 px-4 text-sm text-ink-300 transition hover:text-gold-300">
                  <ArrowLeft size={16} />
                  {t("landing.pages.developer.back")}
                </Link>
              </div>
            </Reveal>
          </aside>

          <div className="lg:col-span-8">
            <Reveal>
              <h2 className="flex items-center gap-3 font-display text-3xl text-stone-100 md:text-4xl">
                {t("landing.pages.developer.projects")}
                <span className="rounded-full border border-line px-2.5 py-0.5 font-mono text-sm text-ink-300">{projects.length}</span>
              </h2>
            </Reveal>
            {projects.length === 0 ? (
              <EmptyState className="mt-6" icon={Buildings2} title={t("landing.pages.developer.noProjects")} />
            ) : (
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                {projects.map((p, i) => (
                  <Reveal key={p.id} delay={(i % 2) * 0.06}>
                    <ProjectCard project={p} className="h-full" />
                  </Reveal>
                ))}
              </div>
            )}
          </div>
        </Container>
      </section>
    </>
  );
}
