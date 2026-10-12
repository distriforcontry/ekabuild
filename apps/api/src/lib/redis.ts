import { Redis } from "ioredis";
import { env } from "../env";

// Redis is optional in dev: everything degrades to in-process behaviour without it.
export const redis = env.REDIS_URL ? new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2, lazyConnect: false }) : null;

/** Separate connection for pub/sub subscribers (a subscribed connection can't run other commands). */
export function createSubscriber() {
  return env.REDIS_URL ? new Redis(env.REDIS_URL) : null;
}

/** Small JSON cache helper. */
export async function cached<T>(key: string, ttlSec: number, load: () => Promise<T>): Promise<T> {
  if (!redis || redis.status !== "ready") return load();
  try {
    const hit = await redis.get(key);
    if (hit) return JSON.parse(hit) as T;
  } catch {}
  const value = await load();
  redis.set(key, JSON.stringify(value), "EX", ttlSec).catch(() => {});
  return value;
}

export async function invalidate(...keys: string[]) {
  if (!redis || redis.status !== "ready" || !keys.length) return;
  await redis.del(...keys).catch(() => {});
}
