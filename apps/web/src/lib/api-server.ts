import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import type { User } from "./types";

// Server-side API access (RSC, route handlers). Talks to the API pool over the internal network
// and forwards the visitor's cookies.
const INTERNAL = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

export class ServerApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

export async function serverApi<T>(path: string, init: RequestInit & { query?: Query } = {}): Promise<T> {
  const { query, headers, ...rest } = init;
  const qs = query
    ? "?" + new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => [k, String(v)])).toString()
    : "";
  const cookieHeader = (await cookies()).toString();
  const res = await fetch(`${INTERNAL}/api/v1${path}${qs === "?" ? "" : qs}`, {
    cache: "no-store",
    ...rest,
    headers: { ...(cookieHeader ? { cookie: cookieHeader } : {}), accept: "application/json", ...headers },
  });
  if (!res.ok) {
    let msg = res.statusText;
    let code = "HTTP_" + res.status;
    try {
      const j = await res.json();
      msg = j?.error?.message ?? msg;
      code = j?.error?.code ?? code;
    } catch {}
    throw new ServerApiError(res.status, code, msg);
  }
  return (await res.json()) as T;
}

/** Like serverApi but returns null for 401/403/404 instead of throwing. */
export async function serverApiSafe<T>(path: string, init?: RequestInit & { query?: Query }): Promise<T | null> {
  try {
    return await serverApi<T>(path, init);
  } catch (e) {
    if (e instanceof ServerApiError && [401, 403, 404].includes(e.status)) return null;
    throw e;
  }
}

/** Current user for this request (deduplicated per render). */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const jar = await cookies();
  if (!jar.get("eka_at")) return null;
  try {
    const { user } = await serverApi<{ user: User }>("/auth/me");
    return user;
  } catch {
    return null;
  }
});

export { homeForRole } from "./roles";
