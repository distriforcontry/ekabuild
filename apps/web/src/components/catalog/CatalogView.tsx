"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, LayoutGroup, motion, MotionConfig } from "motion/react";
import { SearchStatus, Sort } from "iconsax-reactjs";
import type { Paginated, ProjectCard as ProjectCardType } from "@/lib/types";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { FilterBar } from "./FilterBar";
import { ViewToggle } from "./ViewToggle";
import { ProjectCard } from "./ProjectCard";
import { ProjectsTable } from "./ProjectsTable";
import { MapView } from "./MapView";
import { Pagination } from "./Pagination";
import { ErrorCard } from "./states";
import { EMPTY_FILTERS, PAGE_SIZE, SORTS, hrefFor, type CatalogFilters } from "./filters";

/**
 * Client side of /projects: URL-driven filters (router.push in a transition so results dim while the
 * server re-renders), Grid / List / Map views, animated layout on every change.
 */
export function CatalogView({ data, filters, failed }: { data: Paginated<ProjectCardType> | null; filters: CatalogFilters; failed: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [optimistic, setOptimistic] = React.useState(filters);
  React.useEffect(() => setOptimistic(filters), [filters]);

  const navigate = React.useCallback(
    (patch: Partial<CatalogFilters>) => {
      const next = { ...optimistic, ...("page" in patch ? {} : { page: 1 }), ...patch };
      setOptimistic(next);
      startTransition(() => router.push(hrefFor(next, {}, false), { scroll: false }));
    },
    [optimistic, router],
  );

  const goPage = (page: number) => {
    navigate({ page });
    document.getElementById("catalog-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const items = (data?.items ?? []).filter((p) => !optimistic.verified || (p.verificationStatus === "VERIFIED" && p.developer.status === "VERIFIED"));
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / (data?.pageSize || PAGE_SIZE)));
  const view = optimistic.view;

  const sortOptions = SORTS.map((s) => ({ value: s, label: t(`catalog.sort.${s}`) }));

  return (
    <MotionConfig reducedMotion="user">
      <FilterBar filters={optimistic} onChange={navigate} pending={pending} />

      <div id="catalog-results" className="scroll-mt-28 pt-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div aria-live="polite">
            <div className="font-display text-3xl text-stone-100">
              {failed ? "—" : t("catalog.hero.found", { count: total })}
            </div>
            <div className="mt-0.5 text-xs text-ink-400">{t("catalog.hero.foundHint")}</div>
          </div>
          <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
            {view !== "map" && (
              <div className="min-w-0 flex-1 sm:w-56 sm:flex-none">
                <Combobox
                  aria-label={t("catalog.filters.sort")}
                  options={sortOptions.map((o) => ({ ...o, icon: <Sort size={16} className="text-ink-400" /> }))}
                  value={optimistic.sort}
                  onChange={(v) => v && navigate({ sort: v as CatalogFilters["sort"] })}
                  searchable={false}
                  clearable={false}
                />
              </div>
            )}
            <ViewToggle value={view} onChange={(v) => navigate({ view: v, page: optimistic.page })} />
          </div>
        </div>

        <div className={cn("transition-opacity duration-300", pending && "pointer-events-none opacity-55")} aria-busy={pending}>
          {failed ? (
            <ErrorCard />
          ) : view === "map" ? (
            <MapView fallback={items} filters={optimistic} />
          ) : view === "list" ? (
            <ProjectsTable items={items} total={total} filters={optimistic} loading={false} onChange={navigate} />
          ) : items.length === 0 ? (
            <EmptyState
              icon={SearchStatus}
              title={t("catalog.empty.title")}
              description={t("catalog.empty.hint")}
              className="py-20"
              action={
                <Button variant="outline" onClick={() => navigate({ ...EMPTY_FILTERS })}>
                  {t("catalog.empty.reset")}
                </Button>
              }
            />
          ) : (
            <LayoutGroup>
              <motion.ul layout className="grid gap-5 sm:grid-cols-2 md:gap-6 xl:grid-cols-3">
                <AnimatePresence mode="popLayout" initial={true}>
                  {items.map((p, i) => (
                    <motion.li
                      key={p.id}
                      layout
                      initial={{ opacity: 0, y: 28, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.2 } }}
                      transition={{ duration: 0.7, delay: Math.min(i, 8) * 0.06, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <ProjectCard project={p} />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </motion.ul>
            </LayoutGroup>
          )}
        </div>

        {!failed && view === "grid" && (
          <Pagination
            page={optimistic.page}
            pages={pages}
            hrefFor={(page) => hrefFor(optimistic, { page }, false)}
            onNavigate={goPage}
          />
        )}
      </div>
    </MotionConfig>
  );
}
