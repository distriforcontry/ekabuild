import type { Metadata } from "next";
import { getI18n } from "@/i18n/server";
import { getCurrentUser, homeForRole } from "@/lib/api-server";
import type { Paginated, ProjectCard, PublicStats } from "@/lib/types";
import { fetchPublic } from "@/components/marketing/server-data";
import { asList } from "@/components/marketing/format";
import { Hero } from "@/components/landing/Hero";
import { TrustMarquee } from "@/components/landing/TrustMarquee";
import { ProblemSolution } from "@/components/landing/ProblemSolution";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { VerifySection } from "@/components/landing/VerifySection";
import { FeaturesBento } from "@/components/landing/FeaturesBento";
import { FeaturedProjects } from "@/components/landing/FeaturedProjects";
import { AudienceTabs } from "@/components/landing/AudienceTabs";
import { StatsBand } from "@/components/landing/StatsBand";
import { Testimonials } from "@/components/landing/Testimonials";
import { Faq } from "@/components/landing/Faq";
import { ContactStrip, FinalCta } from "@/components/landing/FinalCta";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: { absolute: t("landing.meta.title") },
    description: t("landing.meta.description"),
    openGraph: { title: t("landing.meta.title"), description: t("landing.meta.description") },
  };
}

export default async function Home() {
  const [featured, stats, user] = await Promise.all([
    fetchPublic<Paginated<ProjectCard> | ProjectCard[]>("/projects", { featured: true, pageSize: 6 }),
    fetchPublic<PublicStats>("/stats/public"),
    getCurrentUser(),
  ]);

  return (
    <>
      <Hero />
      <TrustMarquee />
      <ProblemSolution />
      <HowItWorks />
      <VerifySection />
      <FeaturesBento />
      <FeaturedProjects projects={asList<ProjectCard>(featured.data)} />
      <AudienceTabs />
      <StatsBand stats={stats.data} />
      <Testimonials />
      <Faq />
      <FinalCta cabinetHref={user ? homeForRole(user.role) : null} />
      <ContactStrip />
    </>
  );
}
