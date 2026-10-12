import Link from "next/link";
import { ArrowRight, Buildings2 } from "iconsax-reactjs";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { getI18n } from "@/i18n/server";
import type { ProjectCard as ProjectCardData } from "@/lib/types";
import { Container } from "@/components/marketing/primitives";
import { Magnetic, Stagger, StaggerItem } from "@/components/marketing/motion";
import { RevealHeading } from "@/components/marketing/text";
import { ProjectCard } from "./ProjectCard";

export async function FeaturedProjects({ projects }: { projects: ProjectCardData[] }) {
  const { t } = await getI18n();

  return (
    <section id="projects" className="relative scroll-mt-24 border-t border-line bg-ink-900/30 py-24 md:py-32">
      <Container>
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <RevealHeading eyebrow={t("landing.projects.eyebrow")} title={t("landing.projects.title")} description={t("landing.projects.description")} />
          {projects.length > 0 && (
            <Reveal delay={0.1}>
              <Magnetic>
                <Button asChild variant="outline" size="lg" className="group shrink-0">
                  <Link href="/projects">
                    {t("landing.projects.seeAll")}
                    <ArrowRight className="transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
              </Magnetic>
            </Reveal>
          )}
        </div>

        {projects.length > 0 ? (
          <Stagger className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {projects.slice(0, 6).map((p, i) => (
              <StaggerItem key={p.id} className="h-full">
                <ProjectCard project={p} pick={i === 0} className="h-full" />
              </StaggerItem>
            ))}
          </Stagger>
        ) : (
          <Reveal delay={0.1}>
            <div className="relative mt-14 overflow-hidden rounded-3xl border border-dashed border-line-strong">
              {/* ghost cards behind the message */}
              <div aria-hidden className="grid gap-6 p-6 opacity-50 [mask-image:linear-gradient(to_bottom,black,transparent)] sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className={i > 0 ? "hidden sm:block" : undefined}>
                    <div className="skeleton aspect-[16/11] rounded-2xl" />
                    <div className="skeleton mt-4 h-6 w-2/3 rounded-lg" />
                    <div className="skeleton mt-2 h-4 w-1/2 rounded-lg" />
                  </div>
                ))}
              </div>
              <div className="absolute inset-0 grid place-items-center p-6 text-center">
                <div className="max-w-md">
                  <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-gold-500/25 bg-ink-900 text-gold-300 shadow-glow">
                    <Buildings2 size={26} variant="Bulk" />
                  </div>
                  <h3 className="mt-5 font-display text-3xl text-stone-100">{t("landing.projects.emptyTitle")}</h3>
                  <p className="mt-2 text-sm text-ink-300">{t("landing.projects.emptyText")}</p>
                  <Button asChild variant="gold" size="lg" className="mt-6">
                    <Link href="/projects">
                      {t("landing.projects.seeAll")}
                      <ArrowRight />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </Reveal>
        )}
      </Container>
    </section>
  );
}
