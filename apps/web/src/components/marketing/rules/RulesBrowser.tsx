"use client";
import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, BookSquare, ExportSquare, SearchNormal1 } from "iconsax-reactjs";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";
import type { RuleItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const norm = (s: string) => s.toLowerCase().replace(/['‘’ʻʼ`]/g, "");

/** Category chips + search over the public rules list. */
export function RulesBrowser({ rules, initialCategory }: { rules: RuleItem[]; initialCategory?: string }) {
  const { t, tr } = useI18n();
  const [q, setQ] = React.useState("");
  const [category, setCategory] = React.useState<string | null>(initialCategory && rules.some((r) => r.category === initialCategory) ? initialCategory : null);

  const categories = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rules) m.set(r.category, (m.get(r.category) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [rules]);

  const list = React.useMemo(() => {
    const nq = norm(q.trim());
    return rules.filter((r) => {
      if (category && r.category !== category) return false;
      if (!nq) return true;
      const hay = `${r.title} ${r.code ?? ""} ${r.summary ?? ""} ${r.category}`;
      return norm(hay).includes(nq) || norm(tr(hay)).includes(nq);
    });
  }, [rules, q, category, tr]);

  const selectCategory = (c: string | null) => {
    setCategory(c);
    const url = new URL(window.location.href);
    if (c) url.searchParams.set("category", c);
    else url.searchParams.delete("category");
    window.history.replaceState(null, "", url.toString());
  };

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0" role="group" aria-label={t("landing.pages.rule.category")}>
          {[{ key: null as string | null, label: t("landing.pages.rules.all"), count: rules.length }, ...categories.map(([c, n]) => ({ key: c, label: tr(c), count: n }))].map((c) => {
            const active = category === c.key;
            return (
              <button
                key={c.key ?? "__all"}
                type="button"
                aria-pressed={active}
                onClick={() => selectCategory(c.key)}
                className={cn(
                  "relative inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors",
                  active ? "border-transparent text-onyx" : "border-line text-ink-300 hover:border-line-strong hover:text-stone-100",
                )}
              >
                {active && <motion.span layoutId="rules-cat" className="absolute inset-0 rounded-full bg-gold-gradient shadow-glow" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
                <span className="relative">{c.label}</span>
                <span className={cn("relative rounded-full px-1.5 font-mono text-[10px]", active ? "bg-onyx/15" : "bg-fg/5 text-ink-400")}>{c.count}</span>
              </button>
            );
          })}
        </div>
        <div className="relative w-full lg:w-80">
          <SearchNormal1 size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" />
          <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("landing.pages.rules.searchPlaceholder")} aria-label={t("landing.common.search")} className="pl-11" />
        </div>
      </div>

      <p className="mt-5 text-sm text-ink-400" aria-live="polite">
        {t("landing.common.results", { count: list.length })}
      </p>

      {list.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={BookSquare}
          title={t("landing.pages.rules.emptyTitle")}
          description={t("landing.pages.rules.emptyText")}
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setQ("");
                selectCategory(null);
              }}
            >
              {t("landing.common.clearFilters")}
            </Button>
          }
        />
      ) : (
        <motion.ul layout className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence initial={false} mode="popLayout">
            {list.map((r, i) => (
              <motion.li
                key={r.id}
                layout
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.4, delay: Math.min(i, 9) * 0.03, ease: [0.16, 1, 0.3, 1] }}
                className="group relative flex flex-col rounded-3xl border border-line bg-ink-900/70 p-6 shadow-card transition-all duration-500 hover:-translate-y-1 hover:border-gold-500/30 hover:shadow-lift"
              >
                <div className="flex items-center justify-between gap-3">
                  {r.code ? (
                    <span className="rounded-lg border border-gold-500/30 bg-gold-500/10 px-2.5 py-1 font-mono text-[11px] font-semibold text-gold-200">{r.code}</span>
                  ) : (
                    <span className="grid size-8 place-items-center rounded-lg border border-gold-500/30 bg-gold-500/10 text-gold-300">
                      <BookSquare size={16} variant="Bulk" />
                    </span>
                  )}
                  <span className="truncate text-[11px] font-medium uppercase tracking-wider text-ink-400">{tr(r.category)}</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold leading-snug text-stone-100 transition-colors group-hover:text-gold-200">
                  <Link href={`/rules/${r.slug}`} className="after:absolute after:inset-0 after:rounded-3xl after:content-['']">
                    {tr(r.title)}
                  </Link>
                </h3>
                {r.summary && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-300">{tr(r.summary)}</p>}
                <div aria-hidden className="min-h-5 flex-1" />
                <div className="flex items-center justify-between border-t border-line pt-4 text-sm">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-gold-300">
                    {t("landing.pages.rules.read")}
                    <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
                  </span>
                  {r.sourceUrl && (
                    <a
                      href={r.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative z-10 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-ink-400 transition hover:bg-fg/5 hover:text-stone-100"
                      aria-label={t("landing.common.external")}
                      title={t("landing.common.external")}
                    >
                      <ExportSquare size={14} />
                    </a>
                  )}
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
    </div>
  );
}
