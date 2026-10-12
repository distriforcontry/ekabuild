"use client";
import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { ExportSquare, InfoCircle, Map1, SearchStatus } from "iconsax-reactjs";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Label } from "@/components/ui/input";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { useI18n } from "@/i18n/client";
import { api, errorMessage } from "@/lib/api";
import type { CadastreCheckItem, ProjectDetail } from "@/lib/types";
import { cn } from "@/lib/utils";
import { unwrap } from "../hooks";
import { useFmt } from "../format";
import { KV } from "../ui";
import type { MapPoint } from "../developer/editor/LocationPicker";
import { useProjectSearch } from "./useProjectSearch";

const LocationPicker = dynamic(() => import("../developer/editor/LocationPicker"), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full rounded-none" />,
});

const RESULT_RING: Record<string, string> = {
  MATCH: "border-success/40 from-success/15",
  PARTIAL: "border-warning/40 from-warning/15",
  MISMATCH: "border-danger/40 from-danger/15",
  NOT_FOUND: "border-danger/40 from-danger/15",
  ERROR: "border-danger/40 from-danger/15",
};

export function CadastreView() {
  const { t, tr } = useI18n();
  const fmt = useFmt();
  const [projectId, setProjectId] = React.useState<string | null>(null);
  const search = useProjectSearch(projectId);
  const [detail, setDetail] = React.useState<ProjectDetail | null>(null);
  const [result, setResult] = React.useState<CadastreCheckItem | null>(null);
  const [running, setRunning] = React.useState(false);

  // load the project's last check when selected
  React.useEffect(() => {
    setResult(null);
    setDetail(null);
    const slug = search.selected?.slug;
    if (!slug) return;
    let alive = true;
    api
      .get<ProjectDetail>(`/projects/${slug}`)
      .then((d) => {
        if (!alive) return;
        setDetail(d);
        if (d.cadastre) setResult(d.cadastre);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [search.selected?.slug]);

  const run = async () => {
    if (!projectId) return;
    setRunning(true);
    try {
      const res = await api.post<unknown>("/cadastre/check", { projectId });
      setResult(unwrap<CadastreCheckItem>(res, "check"));
    } catch (e) {
      toast.error(errorMessage(e, t("common.errors.generic")));
    } finally {
      setRunning(false);
    }
  };

  const project = detail ?? search.selected;
  const points = React.useMemo<MapPoint[]>(() => {
    const out: MapPoint[] = [];
    if (project) out.push({ lat: project.lat, lng: project.lng, label: t("app.inspector.cadastre.result.projectData"), tone: "gold" });
    if (result?.details.registryLat != null && result.details.registryLng != null)
      out.push({ lat: result.details.registryLat, lng: result.details.registryLng, label: t("app.inspector.cadastre.result.registryData"), tone: "info" });
    return out;
  }, [project, result, t]);

  return (
    <div>
      <PageHeader eyebrow={t("app.shell.sections.inspector")} title={t("app.inspector.cadastre.title")} description={t("app.inspector.cadastre.subtitle")} />

      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-line bg-ink-900 p-4 shadow-card md:flex-row md:items-end md:p-5">
        <div className="flex-1">
          <Label>{t("app.inspector.cadastre.project")}</Label>
          <Combobox
            options={search.options}
            value={projectId}
            onChange={setProjectId}
            onSearch={search.onSearch}
            loading={search.loading}
            placeholder={t("app.inspector.inspection.fields.projectPlaceholder")}
            aria-label={t("app.inspector.cadastre.project")}
          />
        </div>
        <Button variant="gold" size="lg" onClick={run} disabled={!projectId} loading={running} className="md:min-w-56">
          {!running && <SearchStatus size={18} variant="Bold" />} {running ? t("app.inspector.cadastre.running") : t("app.inspector.cadastre.run")}
        </Button>
      </div>

      {!projectId ? (
        <EmptyState icon={Map1} title={t("app.inspector.cadastre.empty")} description={t("app.inspector.cadastre.emptyHint")} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <AnimatePresence mode="wait">
            {running ? (
              <motion.div key="scan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative grid min-h-80 place-items-center overflow-hidden rounded-2xl border border-gold-500/30 bg-ink-900">
                <div className="bg-blueprint absolute inset-0 opacity-70" />
                <motion.div
                  className="absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-gold-500/20 to-transparent"
                  animate={{ top: ["-20%", "100%"] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                />
                <div className="relative flex flex-col items-center gap-3 text-center">
                  <span className="relative grid size-16 place-items-center rounded-2xl bg-gold-gradient text-onyx shadow-glow">
                    <span className="absolute inset-0 animate-pulse-ring rounded-2xl border border-gold-400/60" />
                    <SearchStatus size={28} variant="Bold" />
                  </span>
                  <span className="text-sm text-ink-200">{t("app.inspector.cadastre.running")}</span>
                </div>
              </motion.div>
            ) : result ? (
              <motion.section
                key={result.id}
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className={cn("overflow-hidden rounded-2xl border bg-gradient-to-b to-transparent shadow-card", RESULT_RING[result.result] ?? "border-line from-ink-900")}
              >
                <div className="bg-ink-900/70 p-5 md:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-400">{t("app.inspector.cadastre.result.title")}</div>
                      <div className="mt-2">
                        <StatusBadge kind="cadastreResult" value={result.result} className="px-3 py-1 text-sm" />
                      </div>
                    </div>
                    {result.distanceM != null && (
                      <div className="text-right">
                        <div className="text-xs text-ink-400">{t("app.inspector.cadastre.result.distance")}</div>
                        <div className={cn("font-mono text-2xl font-semibold", result.distanceM <= 50 ? "text-success" : result.distanceM <= 300 ? "text-warning" : "text-danger")}>
                          {t("app.inspector.cadastre.result.distanceValue", { n: Math.round(result.distanceM) })}
                        </div>
                      </div>
                    )}
                  </div>
                  <KV
                    className="mt-5"
                    items={[
                      { label: t("app.inspector.cadastre.result.number"), value: result.cadastreNumber, mono: true },
                      { label: t("app.inspector.cadastre.result.provider"), value: result.provider },
                      ...(result.details.registryAddress ? [{ label: t("app.inspector.cadastre.result.registryAddress"), value: tr(result.details.registryAddress) }] : []),
                      ...(result.details.registryArea != null ? [{ label: t("app.inspector.cadastre.result.registryArea"), value: fmt.area(result.details.registryArea) }] : []),
                      ...(result.details.owner ? [{ label: t("app.inspector.cadastre.result.owner"), value: tr(result.details.owner) }] : []),
                      ...(result.details.purpose ? [{ label: t("app.inspector.cadastre.result.purpose"), value: tr(result.details.purpose) }] : []),
                      { label: t("app.inspector.cadastre.result.checkedAt"), value: fmt.dateTime(result.createdAt) },
                    ]}
                  />
                  {result.details.messages?.length > 0 && (
                    <div className="mt-5">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">{t("app.inspector.cadastre.result.messages")}</div>
                      <ul className="space-y-1.5">
                        {result.details.messages.map((m, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-ink-200">
                            <InfoCircle size={16} variant="Bulk" className="mt-0.5 shrink-0 text-gold-300" /> {tr(m)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </motion.section>
            ) : (
              <motion.div key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <EmptyState icon={SearchStatus} title={t("app.inspector.cadastre.run")} description={detail && !detail.cadastreNumber ? t("app.inspector.cadastre.noCadastre") : t("app.inspector.cadastre.emptyHint")} className="h-full" />
              </motion.div>
            )}
          </AnimatePresence>

          <section className="overflow-hidden rounded-2xl border border-line bg-ink-900 shadow-card">
            {points.length > 0 ? (
              <LocationPicker key={project?.id ?? "none"} points={points} zoom={15} className="h-72 w-full" />
            ) : (
              <Skeleton className="h-72 w-full rounded-none" />
            )}
            {project && (
              <div className="p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-400">{t("app.inspector.cadastre.result.projectData")}</div>
                <div className="mt-1 font-semibold text-stone-100">{tr(project.name)}</div>
                <KV
                  className="mt-3"
                  items={[
                    { label: t("app.common.address"), value: tr(project.address) },
                    { label: t("app.inspector.cadastre.result.number"), value: detail?.cadastreNumber ?? "—", mono: true },
                    ...(detail?.landArea != null ? [{ label: t("app.developer.editor.basic.fields.landArea"), value: fmt.area(detail.landArea) }] : []),
                    { label: t("app.developer.editor.basic.sections.location"), value: `${project.lat.toFixed(5)}, ${project.lng.toFixed(5)}`, mono: true },
                  ]}
                />
                <Button asChild variant="ghost" size="sm" className="mt-3">
                  <Link href={`/projects/${project.slug}`} target="_blank">
                    {t("app.common.viewProject")} <ExportSquare size={14} />
                  </Link>
                </Button>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
