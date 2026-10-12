"use client";
import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Buildings2, CloseCircle, Location, SearchNormal1, Verify } from "iconsax-reactjs";
import { REGIONS } from "@eka/shared";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { TrustRing } from "@/components/ui/trust-ring";
import { EmptyState } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";
import type { Org } from "@/lib/types";
import { initials } from "@/lib/utils";

export type DeveloperListItem = Org & { projectsCount?: number; avgTrust?: number | null };

type Sort = "trust" | "projects" | "name";
const norm = (s: string) => s.toLowerCase().replace(/['‘’ʻʼ`]/g, "");

/** Searchable / filterable grid of verified developers. */
export function DevelopersGrid({ developers }: { developers: DeveloperListItem[] }) {
  const { t, tr } = useI18n();
  const [q, setQ] = React.useState("");
  const [region, setRegion] = React.useState<string | null>(null);
  const [sort, setSort] = React.useState<Sort>("trust");

  const regionOptions = React.useMemo(() => {
    const used = new Set(developers.map((d) => d.region).filter(Boolean) as string[]);
    const all = [...REGIONS, ...[...used].filter((r) => !(REGIONS as readonly string[]).includes(r))];
    return all.map((r) => ({ value: r, label: tr(r) }));
  }, [developers, tr]);

  const list = React.useMemo(() => {
    const nq = norm(q.trim());
    const filtered = developers.filter((d) => {
      if (region && d.region !== region) return false;
      if (!nq) return true;
      return norm(`${d.name} ${d.legalName ?? ""} ${d.tin} ${d.region ?? ""}`).includes(nq) || norm(tr(d.name)).includes(nq);
    });
    return filtered.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "projects") return (b.projectsCount ?? 0) - (a.projectsCount ?? 0);
      return (b.avgTrust ?? 0) - (a.avgTrust ?? 0);
    });
  }, [developers, q, region, sort, tr]);

  const hasFilters = !!q || !!region;

  return (
    <div>
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-ink-900/70 p-3 shadow-card md:flex-row md:items-center">
        <div className="relative flex-1">
          <SearchNormal1 size={18} variant="TwoTone" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gold-400" />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("landing.pages.developers.searchPlaceholder")}
            aria-label={t("landing.common.search")}
            className="pl-11"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 md:flex md:w-auto">
          <Combobox
            aria-label={t("landing.common.region")}
            className="md:w-56"
            placeholder={t("landing.common.allRegions")}
            options={regionOptions}
            value={region}
            onChange={setRegion}
          />
          <Combobox
            aria-label={t("landing.pages.developers.sort")}
            className="md:w-56"
            searchable={false}
            clearable={false}
            options={[
              { value: "trust", label: t("landing.pages.developers.sortTrust") },
              { value: "projects", label: t("landing.pages.developers.sortProjects") },
              { value: "name", label: t("landing.pages.developers.sortName") },
            ]}
            value={sort}
            onChange={(v) => setSort((v as Sort) ?? "trust")}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-ink-400" aria-live="polite">
        <span>{t("landing.common.results", { count: list.length })}</span>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setRegion(null);
            }}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-ink-300 transition hover:bg-fg/5 hover:text-stone-100"
          >
            <CloseCircle size={14} />
            {t("landing.common.clearFilters")}
          </button>
        )}
      </div>

      {list.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={SearchNormal1}
          title={t("landing.pages.developers.emptyTitle")}
          description={t("landing.pages.developers.emptyText")}
          action={
            hasFilters ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setQ("");
                  setRegion(null);
                }}
              >
                {t("landing.common.clearFilters")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <motion.ul layout className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence initial={false} mode="popLayout">
            {list.map((d, i) => (
              <motion.li
                key={d.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.4, delay: Math.min(i, 8) * 0.03, ease: [0.16, 1, 0.3, 1] }}
              >
                <DeveloperCard dev={d} />
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
    </div>
  );
}

export function DeveloperLogo({ dev, size = "md" }: { dev: Pick<Org, "name" | "logoUrl">; size?: "md" | "lg" }) {
  const [ok, setOk] = React.useState(!!dev.logoUrl);
  const cls = size === "lg" ? "size-24 rounded-3xl text-2xl" : "size-14 rounded-2xl text-base";
  return (
    <div className={`relative grid shrink-0 place-items-center overflow-hidden border border-gold-500/30 bg-ink-850 ${cls}`}>
      {ok && dev.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={dev.logoUrl} alt="" className="size-full object-cover" onError={() => setOk(false)} />
      ) : (
        <span className="text-gold-gradient font-display font-semibold">{initials(dev.name) || "EB"}</span>
      )}
    </div>
  );
}

function DeveloperCard({ dev }: { dev: DeveloperListItem }) {
  const { t, tr } = useI18n();
  const trust = typeof dev.avgTrust === "number" ? Math.round(dev.avgTrust) : null;
  return (
    <Link
      href={`/developers/${dev.id}`}
      className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-ink-900/70 p-6 shadow-card transition-all duration-500 ease-[var(--ease-out-expo)] hover:-translate-y-1 hover:border-gold-500/30 hover:shadow-lift"
    >
      <div aria-hidden className="absolute -right-16 -top-16 size-40 rounded-full bg-gold-500/0 blur-3xl transition-colors duration-500 group-hover:bg-gold-500/15" />
      <div className="relative flex items-start gap-4">
        <DeveloperLogo dev={dev} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold text-stone-100 transition-colors group-hover:text-gold-200">{tr(dev.name)}</h3>
          {dev.status === "VERIFIED" && (
            <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-success">
              <Verify size={14} variant="Bold" />
              {t("landing.pages.developer.verified")}
            </span>
          )}
        </div>
        {trust !== null && <TrustRing score={trust} size={48} stroke={4} />}
      </div>
      {dev.description && <p className="relative mt-4 line-clamp-2 text-sm leading-relaxed text-ink-300">{tr(dev.description)}</p>}
      <div aria-hidden className="min-h-5 flex-1" />
      <div className="relative flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-4 text-xs text-ink-400">
        {dev.region && (
          <span className="inline-flex items-center gap-1.5">
            <Location size={14} variant="Bulk" className="text-gold-400" />
            {tr(dev.region)}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <Buildings2 size={14} variant="Bulk" className="text-gold-400" />
          {t("landing.pages.developers.projects", { n: dev.projectsCount ?? 0 })}
        </span>
        {dev.foundedYear && <span>{t("landing.pages.developers.founded", { year: dev.foundedYear })}</span>}
        <ArrowRight size={16} className="ml-auto text-ink-500 transition-all group-hover:translate-x-1 group-hover:text-gold-300" />
      </div>
    </Link>
  );
}
