"use client";
import * as React from "react";
import { api, ApiError } from "@/lib/api";

type Query = Record<string, string | number | boolean | null | undefined>;

export type ApiState<T> = {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  reload: () => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<T | undefined>>;
};

/**
 * Minimal client data hook: GET on mount / when the path or query changes, stale-response safe,
 * never throws (errors land in `error` so pages render an error card instead of crashing).
 * Pass `null` as path to skip.
 */
export function useApi<T>(path: string | null, query?: Query, opts?: { select?: (raw: unknown) => T }): ApiState<T> {
  const [data, setData] = React.useState<T | undefined>(undefined);
  const [error, setError] = React.useState<unknown>(null);
  const [loading, setLoading] = React.useState(Boolean(path));
  const seq = React.useRef(0);
  const qKey = query ? JSON.stringify(query) : "";
  const selectRef = React.useRef(opts?.select);
  selectRef.current = opts?.select;

  const reload = React.useCallback(async () => {
    if (!path) {
      setLoading(false);
      return;
    }
    const id = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const raw = await api.get<unknown>(path, { query: qKey ? (JSON.parse(qKey) as Query) : undefined });
      if (id !== seq.current) return;
      setData((selectRef.current ? selectRef.current(raw) : raw) as T);
    } catch (e) {
      if (id !== seq.current) return;
      setError(e);
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [path, qKey]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, reload, setData };
}

/** Accepts either a bare array or a `{ items }` page. */
export function asList<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === "object" && Array.isArray((raw as { items?: unknown }).items)) return (raw as { items: T[] }).items;
  return [];
}

/** Accepts `{ [key]: T }` or `T` itself. */
export function unwrap<T>(raw: unknown, key: string): T {
  if (raw && typeof raw === "object" && key in (raw as Record<string, unknown>)) return (raw as Record<string, T>)[key]!;
  return raw as T;
}

export const isForbidden = (e: unknown) => e instanceof ApiError && (e.status === 401 || e.status === 403);
export const isNotFound = (e: unknown) => e instanceof ApiError && e.status === 404;

/** Copy text to the clipboard; resolves to success. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
