"use client";
// Project location vs. cadastre registry point. Loaded with next/dynamic (ssr:false).
import "leaflet/dist/leaflet.css";
import * as React from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, ZoomControl, useMap } from "react-leaflet";
import { TONE_HEX, dotPin, trustPin } from "@/components/catalog/markers";

const TIP = "rounded-lg! border-line! bg-ink-800! px-2! py-1! text-xs! text-ink-100! shadow-card! before:hidden!";

function Fit({ points }: { points: [number, number][] }) {
  const map = useMap();
  const key = points.map((p) => p.join(",")).join(";");
  React.useEffect(() => {
    if (points.length === 1) map.setView(points[0]!, 16);
    else if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [70, 70], maxZoom: 17 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

export default function CadastreMap({
  project,
  registry,
  trustScore,
  labels,
}: {
  project: [number, number];
  registry: [number, number] | null;
  trustScore: number;
  labels: { project: string; registry: string; distance: string | null };
}) {
  const points = registry ? [project, registry] : [project];
  return (
    <MapContainer center={project} zoom={16} scrollWheelZoom={false} zoomControl={false} className="size-full">
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        className="eka-tiles"
        maxZoom={19}
      />
      <ZoomControl position="bottomright" />
      <Fit points={points} />
      <Marker position={project} icon={trustPin(trustScore, { active: true })}>
        <Tooltip direction="top" offset={[0, -54]} className={TIP}>
          {labels.project}
        </Tooltip>
      </Marker>
      {registry && (
        <>
          <Polyline positions={[project, registry]} pathOptions={{ color: TONE_HEX.info, weight: 2.5, dashArray: "6 8", opacity: 0.9 }}>
            {labels.distance && (
              <Tooltip permanent direction="center" className={`${TIP} font-mono!`}>
                {labels.distance}
              </Tooltip>
            )}
          </Polyline>
          <Marker position={registry} icon={dotPin(TONE_HEX.info, "K")}>
            <Tooltip direction="top" offset={[0, -16]} className={TIP}>
              {labels.registry}
            </Tooltip>
          </Marker>
        </>
      )}
    </MapContainer>
  );
}
