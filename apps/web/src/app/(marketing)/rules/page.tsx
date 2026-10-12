import type { Metadata } from "next";
import { BookSquare } from "iconsax-reactjs";
import { EmptyState } from "@/components/ui/misc";
import { getI18n } from "@/i18n/server";
import type { RuleItem } from "@/lib/types";
import { Container, PageHero } from "@/components/marketing/primitives";
import { fetchPublic } from "@/components/marketing/server-data";
import { asList } from "@/components/marketing/format";
import { ApiErrorState } from "@/components/marketing/ApiErrorState";
import { RulesBrowser } from "@/components/marketing/rules/RulesBrowser";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("landing.pages.rules.metaTitle"), description: t("landing.pages.rules.metaDescription") };
}

export default async function RulesPage({ searchParams }: { searchParams: Promise<{ category?: string | string[] }> }) {
  const sp = await searchParams;
  const { t } = await getI18n();
  const res = await fetchPublic<unknown>("/rules");
  const rules = asList<RuleItem>(res.data);
  const category = typeof sp.category === "string" ? sp.category : undefined;

  return (
    <>
      <PageHero
        eyebrow={t("landing.pages.rules.eyebrow")}
        title={t("landing.pages.rules.title")}
        description={t("landing.pages.rules.description")}
        crumbs={[{ href: "/", label: t("landing.common.breadcrumbHome") }, { label: t("common.nav.rules") }]}
      />
      <section className="pb-24">
        <Container>
          {res.error ? (
            <ApiErrorState retryHref="/rules" />
          ) : rules.length === 0 ? (
            <EmptyState icon={BookSquare} title={t("landing.pages.rules.noDataTitle")} description={t("landing.pages.rules.noDataText")} />
          ) : (
            <RulesBrowser rules={rules} initialCategory={category} />
          )}
        </Container>
      </section>
    </>
  );
}
