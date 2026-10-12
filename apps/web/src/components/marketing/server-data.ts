import "server-only";
import { serverApiSafe } from "@/lib/api-server";

type Query = Record<string, string | number | boolean | null | undefined>;

export type Fetched<T> = {
  /** null when the API answered 401/403/404 or when it could not be reached */
  data: T | null;
  /** true when the API is unreachable / 5xx — show a "try later" state, never "not found" */
  error: boolean;
};

/**
 * Public read for marketing pages. Never throws: the API may be down while the site is up.
 * A short timeout keeps the page fast when the API pool is unhealthy.
 */
export async function fetchPublic<T>(path: string, query?: Query, timeoutMs = 5000): Promise<Fetched<T>> {
  try {
    const data = await serverApiSafe<T>(path, { query, signal: AbortSignal.timeout(timeoutMs) });
    return { data, error: false };
  } catch {
    return { data: null, error: true };
  }
}
