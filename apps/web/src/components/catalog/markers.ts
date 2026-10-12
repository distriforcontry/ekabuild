// Leaflet DivIcon builders (client-only: imported exclusively by ssr:false map modules).
import L from "leaflet";
import { trustLevel } from "@eka/shared";

export const TONE_HEX = { success: "#3FB68B", info: "#5B9BD5", warning: "#E8B04B", danger: "#E5484D" } as const;

export const TASHKENT: [number, number] = [41.3111, 69.2797];

/** Gold pin with the trust score inside and a small tone dot. */
export function trustPin(score: number, opts: { active?: boolean } = {}) {
  const tone = TONE_HEX[trustLevel(score).tone];
  const s = Math.max(0, Math.min(100, Math.round(score)));
  return L.divIcon({
    className: "eka-marker",
    iconSize: [46, 58],
    iconAnchor: [23, 56],
    popupAnchor: [0, -52],
    html: `<div class="group relative flex flex-col items-center transition-transform duration-300 ease-out hover:-translate-y-1 hover:scale-110 ${opts.active ? "scale-110" : ""}">
      ${opts.active ? '<span class="absolute left-1/2 top-0 size-11 -translate-x-1/2 rounded-full bg-gold-400/40 animate-pulse-ring"></span>' : ""}
      <span class="relative grid size-11 place-items-center rounded-full bg-gold-gradient font-mono text-[13px] font-bold text-onyx shadow-glow ring-[3px] ring-ink-950">
        ${s}
        <span class="absolute -right-0.5 -top-0.5 size-3 rounded-full ring-2 ring-ink-950" style="background:${tone}"></span>
      </span>
      <span class="-mt-2 size-3.5 rotate-45 rounded-[2px] bg-gold-700 ring-[3px] ring-ink-950 [clip-path:polygon(100%_0,100%_100%,0_100%)]"></span>
    </div>`,
  });
}

/** Round marker for a secondary point (e.g. cadastre registry). */
export function dotPin(color: string, label: string) {
  return L.divIcon({
    className: "eka-marker",
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -16],
    html: `<div class="relative grid size-[34px] place-items-center">
      <span class="absolute inset-0 rounded-full opacity-30 animate-pulse-ring" style="background:${color}"></span>
      <span class="relative grid size-7 place-items-center rounded-full font-mono text-[11px] font-bold text-onyx ring-[3px] ring-ink-950" style="background:${color}">${label}</span>
    </div>`,
  });
}
