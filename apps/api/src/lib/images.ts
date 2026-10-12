import type { Readable } from "node:stream";
import sharp from "sharp";
import { storage } from "./storage";

/**
 * Responsive WebP variants for images: /files/:id?w=768 → resized WebP, generated on first request and
 * stored next to the original (`<key>.w768.webp`), then served from storage with immutable caching.
 */
export const IMAGE_WIDTHS = [320, 480, 768, 1024, 1600, 2400] as const;
const RESIZABLE = new Set(["image/png", "image/jpeg", "image/webp"]);

sharp.cache({ memory: 64, files: 0 });
sharp.concurrency(2);

export const canResize = (mime: string) => RESIZABLE.has(mime);

export function nearestWidth(w: number) {
  return IMAGE_WIDTHS.find((x) => x >= w) ?? IMAGE_WIDTHS[IMAGE_WIDTHS.length - 1]!;
}

const inflight = new Map<string, Promise<void>>();

export async function variantStream(storageKey: string, width: number): Promise<{ stream: Readable; key: string }> {
  const key = `${storageKey}.w${width}.webp`;
  const existing = await storage.read(key).catch(() => null);
  if (existing) return { stream: existing, key };

  // de-duplicate concurrent generation of the same variant within this replica
  let job = inflight.get(key);
  if (!job) {
    job = (async () => {
      const src = await storage.read(storageKey);
      const pipeline = sharp({ failOn: "none" }).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 80, effort: 4, smartSubsample: true });
      src.pipe(pipeline);
      await storage.save(pipeline, key, "image/webp");
    })().finally(() => inflight.delete(key));
    inflight.set(key, job);
  }
  await job;
  return { stream: await storage.read(key), key };
}
