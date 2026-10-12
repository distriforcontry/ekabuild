"use client";
import * as React from "react";
import dynamic from "next/dynamic";
import { DocumentText, Global, InfoCircle, Location, Map1, ShieldSearch, TickCircle, Warning2 } from "iconsax-reactjs";
import { useI18n } from "@/i18n/client";
import { InfoRow, EmptyState } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/status-badge";
import { Spinner } from "@/components/ui/spinner";
import { useFormat } from "@/components/catalog/use-format";
import { haversine } from "@/components/catalog/format";
import { useProject } from "../ProjectProvider";
import { CopyButton, Section } from "../bits";

const CadastreMap = dynamic(() => import("../CadastreMap"), {
  ssr: false,
  loading: () => (
    <div className="bg-blueprint grid size-full place-items-center bg-ink-900">
      <Spinner className="size-5 text-gold-400" />
    </div>
  ),
});

export function CadastreTab() {
  const { project: p } = useProject();
  const { t, tr } = useI18n();
  const fmt = useFormat();
  const cad = p.cadastre;
  const d = cad?.details;

  const hasCoords = Number.isFinite(p.lat) && Number.isFinite(p.lng);
  const projectPt: [number, number] = [p.lat, p.lng];
  const regPt: [number, number] | null =
    d && typeof d.registryLat === "number" && typeof d.registryLng === "number" ? [d.registryLat, d.registryLng] : null;
  const dist = cad?.distanceM ?? (regPt && hasCoords ? haversine(projectPt, regPt) : null);
  const showRegistry = regPt && dist !== null && dist > 3 ? regPt : null;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Section icon={Map1} title={t("catalog.cadastre.mapTitle")} bodyClassName="p-3 pt-4 md:p-3 md:pt-5">
          <div className="relative isolate h-[420px] overflow-hidden rounded-2xl border border-line">
            {hasCoords ? (
              <CadastreMap
                project={projectPt}
                registry={showRegistry}
                trustScore={p.trustScore}
                labels={{
                  project: t("catalog.cadastre.legendProject"),
                  registry: t("catalog.cadastre.legendRegistry"),
                  distance: dist !== null ? t("catalog.map.distance", { value: fmt.distance(dist) }) : null,
                }}
              />
            ) : (
              <EmptyState icon={Location} title={t("catalog.map.empty")} className="h-full border-0" />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-2 pt-3 text-xs text-ink-300">
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-full bg-gold-gradient" /> {t("catalog.cadastre.legendProject")}
            </span>
            {showRegistry && (
              <span className="flex items-center gap-1.5">
                <span className="size-3 rounded-full bg-info" /> {t("catalog.cadastre.legendRegistry")}
              </span>
            )}
            {dist !== null && (
              <span className="ml-auto font-mono text-ink-200">
                {t("catalog.cadastre.distance")}: {fmt.distance(dist)}
              </span>
            )}
          </div>
        </Section>

        <Section
          icon={ShieldSearch}
          title={t("catalog.cadastre.title")}
          action={cad ? <StatusBadge kind="cadastreResult" value={cad.result} /> : undefined}
        >
          {!cad ? (
            <div>
              <EmptyState icon={ShieldSearch} title={t("catalog.cadastre.none")} description={t("catalog.cadastre.noneHint")} className="py-10" />
              {p.cadastreNumber && (
                <div className="mt-4">
                  <InfoRow
                    label={t("catalog.cadastre.number")}
                    value={
                      <span className="inline-flex items-center gap-1 font-mono">
                        {p.cadastreNumber}
                        <CopyButton value={p.cadastreNumber} />
                      </span>
                    }
                  />
                </div>
              )}
            </div>
          ) : (
            <div>
              <InfoRow
                label={t("catalog.cadastre.number")}
                value={
                  <span className="inline-flex items-center gap-1 font-mono">
                    {cad.cadastreNumber}
                    <CopyButton value={cad.cadastreNumber} />
                  </span>
                }
              />
              {d?.registryAddress && <InfoRow label={t("catalog.cadastre.registryAddress")} value={tr(d.registryAddress)} />}
              {typeof d?.registryArea === "number" && <InfoRow label={t("catalog.cadastre.registryArea")} value={fmt.area(d.registryArea)} mono />}
              {d?.purpose && <InfoRow label={t("catalog.cadastre.purpose")} value={tr(d.purpose)} />}
              {d?.owner && <InfoRow label={t("catalog.cadastre.owner")} value={tr(d.owner)} />}
              {dist !== null && <InfoRow label={t("catalog.cadastre.distance")} value={fmt.distance(dist)} mono />}
              <InfoRow label={t("catalog.cadastre.provider")} value={<span className="font-mono text-xs uppercase">{cad.provider}</span>} />
              <InfoRow label={t("catalog.cadastre.checkedAt")} value={fmt.dateTime(cad.createdAt)} />

              {(d?.messages?.length ?? 0) > 0 && (
                <div className="mt-5">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">{t("catalog.cadastre.messages")}</div>
                  <ul className="space-y-2">
                    {d!.messages.map((m, i) => {
                      const ok = cad.result === "MATCH";
                      return (
                        <li key={i} className="flex items-start gap-2 rounded-xl border border-line bg-ink-850 px-3 py-2 text-sm text-ink-200">
                          {ok ? (
                            <TickCircle size={16} variant="Bold" className="mt-0.5 shrink-0 text-success" />
                          ) : cad.result === "PARTIAL" ? (
                            <Warning2 size={16} variant="Bold" className="mt-0.5 shrink-0 text-warning" />
                          ) : (
                            <InfoCircle size={16} variant="Bold" className="mt-0.5 shrink-0 text-danger" />
                          )}
                          {tr(m)}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Section>
      </div>

      <Section icon={Location} title={t("catalog.cadastre.location")} description={t("catalog.cadastre.nearbyHint")}>
        <div className="grid gap-x-10 md:grid-cols-2">
          <div>
            <InfoRow label={t("catalog.cadastre.region")} value={fmt.region(p.region)} />
            {p.district && <InfoRow label={t("catalog.cadastre.district")} value={tr(p.district)} />}
            <InfoRow label={t("catalog.cadastre.address")} value={tr(p.address)} />
          </div>
          <div>
            {hasCoords && (
              <InfoRow
                label={t("catalog.cadastre.coordinates")}
                value={
                  <span className="inline-flex items-center gap-1 font-mono text-xs">
                    {p.lat.toFixed(6)}, {p.lng.toFixed(6)}
                    <CopyButton value={`${p.lat}, ${p.lng}`} />
                  </span>
                }
              />
            )}
            {p.cadastreNumber && (
              <InfoRow
                label={t("catalog.cadastre.number")}
                value={
                  <span className="inline-flex items-center gap-1 font-mono text-xs">
                    <DocumentText size={14} variant="Bulk" className="text-gold-400" />
                    {p.cadastreNumber}
                  </span>
                }
              />
            )}
            {hasCoords && (
              <div className="flex flex-wrap gap-2 pt-4">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-xs font-medium text-ink-200 transition hover:border-gold-500/40 hover:text-gold-200"
                >
                  <Global size={15} variant="Bulk" className="text-gold-400" /> Google Maps
                </a>
                <a
                  href={`https://yandex.uz/maps/?pt=${p.lng},${p.lat}&z=17&l=map`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-xs font-medium text-ink-200 transition hover:border-gold-500/40 hover:text-gold-200"
                >
                  <Map1 size={15} variant="Bulk" className="text-gold-400" /> Yandex Maps
                </a>
              </div>
            )}
          </div>
        </div>
      </Section>
    </div>
  );
}
