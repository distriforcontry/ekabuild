"use client";
// Leaflet map of projects. Loaded with next/dynamic (ssr:false) from MapView.
import "leaflet/dist/leaflet.css";
import * as React from "react";
import Link from "next/link";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, ZoomControl, useMap } from "react-leaflet";
import { ArrowRight } from "iconsax-reactjs";
import type { ProjectStatus } from "@eka/shared";
import { useI18n } from "@/i18n/client";
import { StatusBadge } from "@/components/ui/status-badge";
import { ProjectCover } from "./ProjectCover";
import { TASHKENT, trustPin } from "./markers";
import { useFormat } from "./use-format";

export type MapItem = {
  id: string;
  slug: string;
  name: string;
  lat: number;
  lng: number;
  trustScore: number;
  status: ProjectStatus;
  coverUrl: string | null;
};

function FitBounds({ items }: { items: MapItem[] }) {
  const map = useMap();
  const key = items.map((i) => i.id).join(",");
  React.useEffect(() => {
    const pts = items.filter((i) => Number.isFinite(i.lat) && Number.isFinite(i.lng)).map((i) => [i.lat, i.lng] as [number, number]);
    if (pts.length === 1) map.setView(pts[0]!, 14, { animate: true });
    else if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [60, 60], maxZoom: 15, animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

export default function CatalogMap({ items }: { items: MapItem[] }) {
  const { t, tr } = useI18n();
  const fmt = useFormat();
  const [active, setActive] = React.useState<string | null>(null);
  const valid = items.filter((i) => Number.isFinite(i.lat) && Number.isFinite(i.lng));

  return (
    <MapContainer center={TASHKENT} zoom={11} scrollWheelZoom={false} zoomControl={false} className="size-full" attributionControl>
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        className="eka-tiles"
        maxZoom={19}
      />
      <ZoomControl position="bottomright" />
      <FitBounds items={valid} />
      {valid.map((p) => (
        <Marker
          key={p.id}
          position={[p.lat, p.lng]}
          icon={trustPin(p.trustScore, { active: active === p.id })}
          title={tr(p.name)}
          eventHandlers={{ popupopen: () => setActive(p.id), popupclose: () => setActive((a) => (a === p.id ? null : a)) }}
        >
          <Popup minWidth={240} maxWidth={260} closeButton={false}>
            <div className="w-[236px] font-sans">
              <div className="relative h-28 overflow-hidden rounded-xl">
                <ProjectCover src={p.coverUrl} name={tr(p.name)} seed={p.slug} showInitial={false} />
                <div className="absolute left-2 top-2">
                  <StatusBadge kind="projectStatus" value={p.status} className="bg-ink-950/70 backdrop-blur" />
                </div>
              </div>
              <div className="mt-2.5 font-display text-xl leading-tight text-stone-100">{tr(p.name)}</div>
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="text-ink-300">
                  {t("catalog.card.trust")}: <b className="font-mono text-stone-100">{p.trustScore}</b> · {fmt.trustLabel(p.trustScore)}
                </span>
              </div>
              <Link
                href={`/projects/${p.slug}`}
                className="mt-3 flex h-9 items-center justify-center gap-1.5 rounded-lg bg-gold-gradient text-xs font-semibold text-onyx! no-underline shadow-glow transition hover:brightness-110"
              >
                {t("catalog.map.open")} <ArrowRight size={14} />
              </Link>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
