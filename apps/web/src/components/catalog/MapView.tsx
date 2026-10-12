"use client";
import * as React from "react";
import dynamic from "next/dynamic";
import { motion } from "motion/react";
import { InfoCircle, Location } from "iconsax-reactjs";
import type { ProjectCard } from "@/lib/types";
import { api } from "@/lib/api";
import { useI18n } from "@/i18n/client";
import { Spinner } from "@/components/ui/spinner";
import type { MapItem } from "./CatalogMap";
import type { CatalogFilters } from "./filters";

const CatalogMap = dynamic(() => import("./CatalogMap"), {
  ssr: false,
  loading: () => <MapLoading />,
});

function MapLoading() {
  const { t } = useI18n();
  return (
    <div className="bg-blueprint grid size-full place-items-center bg-ink-900">
      <div className="flex items-center gap-2 text-sm text-ink-300">
        <Spinner className="text-gold-400" /> {t("catalog.map.loading")}
      </div>
    </div>
  );
}

/** Catalog map view: all published projects from GET /projects/map (falls back to the current page). */
export function MapView({ fallback, filters }: { fallback: ProjectCard[]; filters: CatalogFilters }) {
  const { t } = useI18n();
  const [items, setItems] = React.useState<MapItem[] | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    api
      .get<MapItem[] | { items: MapItem[] }>("/projects/map")
      .then((r) => alive && setItems(Array.isArray(r) ? r : (r?.items ?? [])))
      .catch(() => {
        if (!alive) return;
        setFailed(true);
        setItems(fallback);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = React.useMemo(() => {
    if (!items) return [];
    // The map endpoint only knows the status; other filters apply to the list views.
    return filters.status ? items.filter((i) => i.status === filters.status) : items;
  }, [items, filters.status]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="relative isolate h-[min(72vh,680px)] min-h-[420px] overflow-hidden rounded-3xl border border-line bg-ink-900 shadow-card"
    >
      {items ? <CatalogMap items={shown} /> : <MapLoading />}

      <div className="pointer-events-none absolute inset-x-3 top-3 z-[500] flex flex-wrap items-start justify-between gap-2">
        <div className="glass pointer-events-auto flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-ink-100 shadow-card">
          <Location size={16} variant="Bold" className="text-gold-300" />
          {items ? (shown.length ? t("catalog.map.count", { count: shown.length }) : t("catalog.map.empty")) : t("catalog.map.loading")}
        </div>
        <div className="glass pointer-events-auto hidden items-center gap-2 rounded-xl px-3 py-2 text-xs text-ink-300 shadow-card sm:flex">
          <span className="grid size-5 place-items-center rounded-full bg-gold-gradient font-mono text-[9px] font-bold text-onyx">87</span>
          {t("catalog.map.legend")}
        </div>
      </div>
      {failed && (
        <div className="glass absolute inset-x-3 bottom-3 z-[500] flex items-start gap-2 rounded-xl px-3 py-2 text-xs text-warning shadow-card sm:right-auto sm:max-w-md">
          <InfoCircle size={16} className="mt-px shrink-0" />
          {t("catalog.map.fallback")}
        </div>
      )}
    </motion.div>
  );
}
