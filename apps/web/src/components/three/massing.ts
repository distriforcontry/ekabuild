// Procedural massing helpers (metres). Pure — no three.js imports so it can be used anywhere.
import type { MassingParams } from "@eka/shared";

export const FLOOR_H = 3.3;
export const GROUND_H = 4.4;
export const PLINTH_H = 0.9;
export const EXPLODE_GAP = 2.2;

export type Block = { key: string; x: number; z: number; floors: number; width: number; depth: number };

const clamp = (v: unknown, lo: number, hi: number, d: number) => {
  const n = typeof v === "number" && Number.isFinite(v) ? v : d;
  return Math.min(hi, Math.max(lo, n));
};

/** Main block + optional towers, sanitised. */
export function resolveBlocks(massing: MassingParams | null | undefined, floorsFallback?: number): Block[] {
  const fallbackFloors = clamp(floorsFallback, 1, 80, 12);
  const main: Block = {
    key: "main",
    x: 0,
    z: 0,
    floors: Math.round(clamp(massing?.floors, 1, 80, fallbackFloors)),
    width: clamp(massing?.width, 6, 140, fallbackFloors > 20 ? 30 : 26),
    depth: clamp(massing?.depth, 6, 140, 16),
  };
  const towers = (massing?.towers ?? []).slice(0, 8).map((t, i) => ({
    key: `t${i}`,
    x: clamp(t.x, -300, 300, 0),
    z: clamp(t.z, -300, 300, 0),
    floors: Math.round(clamp(t.floors, 1, 80, main.floors)),
    width: clamp(t.width, 6, 140, main.width),
    depth: clamp(t.depth, 6, 140, main.depth),
  }));
  return [main, ...towers];
}

/** y (from plinth top) of the bottom of floor k (1-based) */
export const floorBase = (k: number) => (k <= 1 ? 0 : GROUND_H + (k - 2) * FLOOR_H);
export const floorHeight = (k: number) => (k <= 1 ? GROUND_H : FLOOR_H);
export const blockHeight = (floors: number) => floorBase(floors) + floorHeight(floors);

export type SceneBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
  center: [number, number, number];
  radius: number;
};

export function boundsOf(blocks: Block[], extraHeight = 0): SceneBounds {
  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity,
    height = 0;
  for (const b of blocks) {
    minX = Math.min(minX, b.x - b.width / 2);
    maxX = Math.max(maxX, b.x + b.width / 2);
    minZ = Math.min(minZ, b.z - b.depth / 2);
    maxZ = Math.max(maxZ, b.z + b.depth / 2);
    height = Math.max(height, PLINTH_H + blockHeight(b.floors) + 4);
  }
  height += extraHeight;
  const w = maxX - minX;
  const d = maxZ - minZ;
  const radius = Math.sqrt(w * w + d * d + height * height) / 2;
  return { minX, maxX, minZ, maxZ, height, center: [(minX + maxX) / 2, height / 2, (minZ + maxZ) / 2], radius };
}

/** Number of completed floors for a block given overall construction progress (0..100). */
export function builtFloors(floors: number, progress: number) {
  if (progress >= 100) return floors;
  return Math.max(0, Math.min(floors, Math.floor((floors * Math.max(0, progress)) / 100)));
}

/** Deterministic pseudo-random [0,1) */
export function rand(seed: number) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}
