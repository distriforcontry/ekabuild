import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, BookSquare, ExportSquare, InfoCircle, MessageQuestion } from "iconsax-reactjs";
import { InfoRow } from "@/components/ui/misc";
import { Reveal } from "@/components/ui/reveal";
import { getI18n } from "@/i18n/server";
import type { RuleItem } from "@/lib/types";
import { Backdrop, Breadcrumbs, Container } from "@/components/marketing/primitives";
import { fetchPublic } from "@/components/marketing/server-data";
import { ApiErrorState } from "@/components/marketing/ApiErrorState";
import { OpenSupportButton } from "@/components/support/OpenSupportButton";

type Params = { params: Promise<{ slug: string }> };

const getRule = cache((slug: string) => fetchPublic<RuleItem>(`/rules/${encodeURIComponent(slug)}`));

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const [{ t, tr }, res] = await Promise.all([getI18n(), getRule(slug)]);
  if (!res.data) return { title: t("landing.pages.rules.metaTitle") };
  return {
    title: res.data.code ? `${tr(res.data.title)} (${res.data.code})` : tr(res.data.title),
    description: res.data.summary ? tr(res.data.summary) : t("landing.pages.rules.metaDescription"),
  };
}

export default async function RulePage({ params }: Params) {
  const { slug } = await params;
  const [{ t, tr }, res] = await Promise.all([getI18n(), getRule(slug)]);

  if (res.error) {
    return (
      <section className="pb-24 pt-16">
        <Container>
          <ApiErrorState retryHref={`/rules/${encodeURIComponent(slug)}`} />
        </Container>
      </section>
    );
  }
  const rule = res.data;
  if (!rule) notFound();

  return (
    <>
      <section className="relative isolate -mt-20 overflow-hidden pb-10 pt-32 md:pt-40">
        <Backdrop intensity="sm" />
        <Container>
          <Breadcrumbs
            items={[
              { href: "/", label: t("landing.common.breadcrumbHome") },
              { href: "/rules", label: t("common.nav.rules") },
              { label: tr(rule.title) },
            ]}
          />
          <Reveal>
            <div className="flex flex-wrap items-center gap-2">
              {rule.code && (
                <span className="rounded-lg border border-gold-500/30 bg-gold-500/10 px-2.5 py-1 font-mono text-xs font-semibold text-gold-200">{rule.code}</span>
              )}
              <Link
                href={`/rules?category=${encodeURIComponent(rule.category)}`}
                className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium uppercase tracking-wider text-ink-300 transition hover:border-line-strong hover:text-stone-100"
              >
                {tr(rule.category)}
              </Link>
            </div>
            <h1 className="mt-5 max-w-4xl font-display text-4xl leading-[1.05] text-stone-100 sm:text-5xl md:text-6xl">{tr(rule.title)}</h1>
            {rule.summary && <p className="mt-5 max-w-3xl text-base leading-relaxed text-ink-300 md:text-lg">{tr(rule.summary)}</p>}
          </Reveal>
        </Container>
      </section>

      <section className="pb-24">
        <Container className="grid items-start gap-6 lg:grid-cols-12">
          <Reveal className="lg:col-span-8">
            <article className="rounded-3xl border border-line bg-ink-900/70 p-6 shadow-card sm:p-10">
              {rule.body ? (
                <div className="prose-eka max-w-none">
                  <Markdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      a: ({ href, children }) => (
                        <a href={href} target={href?.startsWith("http") ? "_blank" : undefined} rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}>
                          {children}
                        </a>
                      ),
                      table: ({ children }) => (
                        <div className="overflow-x-auto">
                          <table>{children}</table>
                        </div>
                      ),
                    }}
                  >
                    {tr(rule.body)}
                  </Markdown>
                </div>
              ) : (
                <p className="text-ink-300">{rule.summary ? tr(rule.summary) : "—"}</p>
              )}
              <p className="mt-10 flex items-start gap-2 border-t border-line pt-5 text-xs leading-relaxed text-ink-400">
                <InfoCircle size={16} className="mt-0.5 shrink-0" />
                {t("landing.pages.rule.disclaimer")}
              </p>
            </article>
          </Reveal>

          <aside className="space-y-6 lg:sticky lg:top-24 lg:col-span-4">
            <Reveal delay={0.06}>
              <div className="rounded-3xl border border-line bg-ink-900/70 p-6 shadow-card">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl border border-gold-500/25 bg-gold-500/10 text-gold-300">
                    <BookSquare size={18} variant="Bulk" />
                  </span>
                  <span className="font-semibold text-stone-100">{t("landing.pages.rules.eyebrow")}</span>
                </div>
                <div className="mt-3">
                  {rule.code && <InfoRow label={t("landing.pages.rule.code")} value={rule.code} mono />}
                  <InfoRow label={t("landing.pages.rule.category")} value={tr(rule.category)} />
                </div>
                {rule.sourceUrl && (
                  <a
                    href={rule.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-line bg-ink-850 px-4 py-3 text-sm text-ink-200 transition hover:border-gold-500/40 hover:text-gold-200"
                  >
                    <span>
                      <span className="block text-[11px] uppercase tracking-wider text-ink-400">{t("landing.pages.rule.source")}</span>
                      {t("landing.pages.rule.openSource")}
                    </span>
                    <ExportSquare size={18} />
                  </a>
                )}
              </div>
            </Reveal>
            <Reveal delay={0.12}>
              <div className="relative overflow-hidden rounded-3xl border border-gold-500/20 bg-gradient-to-br from-gold-500/10 to-ink-900 p-6">
                <MessageQuestion size={28} variant="Bulk" className="text-gold-400" />
                <h2 className="mt-3 font-semibold text-stone-100">{t("landing.pages.rule.helpTitle")}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-300">{t("landing.pages.rule.helpText")}</p>
                <OpenSupportButton variant="gold" size="md" className="mt-5">
                  {t("landing.pages.rule.helpCta")}
                </OpenSupportButton>
              </div>
            </Reveal>
            <Link href="/rules" className="inline-flex items-center gap-2 px-2 text-sm text-ink-300 transition hover:text-gold-300">
              <ArrowLeft size={16} />
              {t("landing.pages.rule.back")}
            </Link>
          </aside>
        </Container>
      </section>
    </>
  );
}
