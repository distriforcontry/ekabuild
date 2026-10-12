import crypto from "node:crypto";
import type { CadastreResult } from "@prisma/client";

/**
 * Cadastre provider adapter. The official registry (kadastr.uz / davreestr) has no public API yet, so the default
 * provider is a deterministic mock: the same cadastre number always yields the same registry record.
 * Implement `CadastreProvider` for the real integration and switch with CADASTRE_PROVIDER.
 */
export type CadastreLookup = {
  found: boolean;
  address?: string;
  area?: number; // m²
  lat?: number;
  lng?: number;
  owner?: string;
  purpose?: string;
};

export interface CadastreProvider {
  name: string;
  lookup(cadastreNumber: string, hint: { lat: number; lng: number; address: string; landArea?: number | null; developerName: string }): Promise<CadastreLookup>;
}

// Uzbek cadastre numbers look like 10:05:03:02:01:0123 (region:district:massiv:quarter:block:parcel)
export const CADASTRE_RE = /^\d{2}:\d{2}:\d{2}:\d{2}:\d{2}:\d{3,5}(\/\d+)?$/;

const mock: CadastreProvider = {
  name: "mock",
  async lookup(num, hint) {
    if (!CADASTRE_RE.test(num)) return { found: false };
    const h = crypto.createHash("sha256").update(num).digest();
    // ~80% exact, ~15% shifted, ~5% far away — deterministic per number
    const bucket = h[0]! % 20;
    const shift = bucket < 16 ? 0.0002 : bucket < 19 ? 0.004 : 0.05;
    const sign = (b: number) => (b % 2 ? 1 : -1);
    return {
      found: true,
      address: hint.address,
      area: hint.landArea ? Math.round(hint.landArea * (bucket < 16 ? 1 : 0.92)) : 4200 + (h[1]! % 50) * 100,
      lat: hint.lat + sign(h[2]!) * shift * (h[3]! / 255),
      lng: hint.lng + sign(h[4]!) * shift * (h[5]! / 255),
      owner: hint.developerName,
      purpose: "Ko'p qavatli turar-joy binosi qurilishi uchun",
    };
  },
};

export const cadastreProvider: CadastreProvider = mock;

export function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function evaluateCadastre(
  rec: CadastreLookup,
  project: { lat: number; lng: number; landArea: number | null; developerName: string },
): { result: CadastreResult; distanceM: number | null; messages: string[] } {
  if (!rec.found) return { result: "NOT_FOUND", distanceM: null, messages: ["Kadastr raqami reyestrda topilmadi"] };
  const messages: string[] = [];
  let problems = 0;
  const distanceM = rec.lat != null && rec.lng != null ? Math.round(haversine(project.lat, project.lng, rec.lat, rec.lng)) : null;
  if (distanceM != null) {
    if (distanceM <= 100) messages.push(`Koordinatalar mos (${distanceM} m)`);
    else if (distanceM <= 1000) {
      messages.push(`Koordinatalar ${distanceM} m farq qiladi`);
      problems++;
    } else {
      messages.push(`Koordinatalar ${(distanceM / 1000).toFixed(1)} km farq qiladi — boshqa yer uchastkasi bo'lishi mumkin`);
      problems += 2;
    }
  }
  if (project.landArea && rec.area) {
    const diff = Math.abs(rec.area - project.landArea) / project.landArea;
    if (diff <= 0.03) messages.push("Yer maydoni mos");
    else {
      messages.push(`Yer maydoni ${Math.round(diff * 100)}% farq qiladi`);
      problems++;
    }
  }
  if (rec.owner && rec.owner !== project.developerName) {
    messages.push(`Huquq egasi boshqa: ${rec.owner}`);
    problems += 2;
  } else if (rec.owner) messages.push("Huquq egasi quruvchiga mos");
  const result: CadastreResult = problems === 0 ? "MATCH" : problems === 1 ? "PARTIAL" : "MISMATCH";
  return { result, distanceM, messages };
}
