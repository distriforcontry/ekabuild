"use client";
// Client-only (Leaflet touches `window`): import through next/dynamic with { ssr: false }.
import "leaflet/dist/leaflet.css";
import * as React from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, Tooltip as LTooltip, useMap, useMapEvents } from "react-leaflet";

const pin = (tone: "gold" | "info") =>
  L.divIcon({
    className: "",
    iconSize: [30, 40],
    iconAnchor: [15, 38],
    html: `<span style="display:block;width:30px;height:40px;filter:drop-shadow(0 6px 10px rgba(0,0,0,.45))">
      <svg viewBox="0 0 30 40" width="30" height="40"><path d="M15 39s13-13.3 13-23.5A13 13 0 0 0 2 15.5C2 25.7 15 39 15 39Z" fill="${tone === "gold" ? "#c9a464" : "#5b9bd5"}" stroke="#121214" stroke-width="1.5"/><circle cx="15" cy="15.5" r="5" fill="#121214"/></svg>
    </span>`,
  });

export type MapPoint = { lat: number; lng: number; label?: string; tone?: "gold" | "info" };

function ClickToPlace({ onPick }: { onPick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick?.(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)));
    },
  });
  return null;
}

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  React.useEffect(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const c = map.getCenter();
    if (Math.abs(c.lat - lat) > 0.0005 || Math.abs(c.lng - lng) > 0.0005) map.panTo([lat, lng], { animate: true });
  }, [lat, lng, map]);
  return null;
}

function FitPoints({ points }: { points: MapPoint[] }) {
  const map = useMap();
  React.useEffect(() => {
    if (points.length < 2) return;
    map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), { padding: [40, 40], maxZoom: 17 });
  }, [points, map]);
  return null;
}

/** Small map: click (or drag the pin) to set coordinates; or show several labelled points. */
export default function LocationPicker({
  value,
  onChange,
  points,
  zoom = 14,
  className,
}: {
  value?: { lat: number; lng: number } | null;
  onChange?: (lat: number, lng: number) => void;
  points?: MapPoint[];
  zoom?: number;
  className?: string;
}) {
  const center: [number, number] =
    value && Number.isFinite(value.lat) && Number.isFinite(value.lng)
      ? [value.lat, value.lng]
      : points?.length
        ? [points[0]!.lat, points[0]!.lng]
        : [41.311081, 69.240562];
  return (
    <MapContainer center={center} zoom={zoom} scrollWheelZoom={false} className={className ?? "h-72 w-full"} style={{ cursor: onChange ? "crosshair" : undefined }}>
      <TileLayer
        className="eka-tiles"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {onChange && <ClickToPlace onPick={onChange} />}
      {value && Number.isFinite(value.lat) && Number.isFinite(value.lng) && (
        <>
          <Recenter lat={value.lat} lng={value.lng} />
          <Marker
            position={[value.lat, value.lng]}
            icon={pin("gold")}
            draggable={Boolean(onChange)}
            eventHandlers={{
              dragend: (e) => {
                const ll = (e.target as L.Marker).getLatLng();
                onChange?.(Number(ll.lat.toFixed(6)), Number(ll.lng.toFixed(6)));
              },
            }}
          />
        </>
      )}
      {points?.map((p, i) => (
        <Marker key={i} position={[p.lat, p.lng]} icon={pin(p.tone ?? "gold")}>
          {p.label && (
            <LTooltip direction="top" offset={[0, -36]} permanent className="!rounded-lg !border-line-strong !bg-ink-800 !px-2 !py-1 !text-xs !font-semibold !text-stone-100 !shadow-lift">
              {p.label}
            </LTooltip>
          )}
        </Marker>
      ))}
      {points && <FitPoints points={points} />}
    </MapContainer>
  );
}
