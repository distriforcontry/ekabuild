import "server-only";
import { serverApi } from "./api-server";
import { IS_STATIC } from "./static";

/**
 * generateStaticParams sources for the static demo export. In the normal server build they return [] so every
 * dynamic page keeps rendering on demand.
 */
type Card = { slug: string; developer: { id: string } };
type Detail = { certificates: { code: string }[] };

async function cards(): Promise<Card[]> {
  const res = await serverApi<{ items: Card[] }>("/projects", { query: { pageSize: 100 } });
  return res.items;
}

export async function staticProjectSlugs() {
  if (!IS_STATIC) return [];
  return (await cards()).map((p) => ({ slug: p.slug }));
}

export async function staticDeveloperIds() {
  if (!IS_STATIC) return [];
  return [...new Set((await cards()).map((p) => p.developer.id))].map((id) => ({ id }));
}

export async function staticRuleSlugs() {
  if (!IS_STATIC) return [];
  const rules = await serverApi<{ slug: string }[] | { items: { slug: string }[] }>("/rules");
  return (Array.isArray(rules) ? rules : rules.items).map((r) => ({ slug: r.slug }));
}

export async function staticCertificateCodes() {
  if (!IS_STATIC) return [];
  const codes: { code: string }[] = [];
  for (const p of await cards()) {
    const d = await serverApi<Detail>(`/projects/${encodeURIComponent(p.slug)}`);
    for (const c of d.certificates) if (c.code) codes.push({ code: c.code });
  }
  return codes;
}
