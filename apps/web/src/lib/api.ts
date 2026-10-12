"use client";
// Browser API client. Same-origin `/api/v1` (nginx or Next rewrite → Fastify), cookies carry the session.
import { IS_DEMO } from "./static";
import { DemoError, demoRequest } from "./demo-api";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;
type Options = Omit<RequestInit, "body"> & { query?: Query; body?: unknown; retry?: boolean };

export const API_BASE = "/api/v1";

export function buildQuery(query?: Query) {
  if (!query) return "";
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

let refreshing: Promise<boolean> | null = null;
async function refreshSession(): Promise<boolean> {
  refreshing ??= fetch(`${API_BASE}/auth/refresh`, { method: "POST", credentials: "include" })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => setTimeout(() => (refreshing = null), 0));
  return refreshing;
}

async function request<T>(method: string, path: string, opts: Options = {}): Promise<T> {
  const { query, body, retry = true, headers, ...rest } = opts;
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  if (IS_DEMO) {
    // static demo build: no API server (lib/demo-api answers read-only calls from a snapshot)
    try {
      return (await demoRequest(method, path, query, body)) as T;
    } catch (e) {
      throw new ApiError(e instanceof DemoError && e.message === "UNAUTHORIZED" ? 401 : 503, "DEMO", (e as Error).message);
    }
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}${buildQuery(query)}`, {
      method,
      credentials: "include",
      headers: { ...(body !== undefined && !isForm ? { "content-type": "application/json" } : {}), ...headers },
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
      ...rest,
    });
  } catch {
    throw new ApiError(0, "NETWORK", "Network error");
  }

  if (res.status === 401 && retry && !path.startsWith("/auth/")) {
    if (await refreshSession()) return request<T>(method, path, { ...opts, retry: false });
  }

  if (!res.ok) {
    let payload: { error?: { code?: string; message?: string; details?: unknown } } = {};
    try {
      payload = await res.json();
    } catch {}
    throw new ApiError(res.status, payload.error?.code ?? "HTTP_" + res.status, payload.error?.message ?? res.statusText, payload.error?.details);
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") ?? "";
  return (ct.includes("application/json") ? res.json() : res.text()) as Promise<T>;
}

export const api = {
  get: <T>(path: string, opts?: Options) => request<T>("GET", path, opts),
  post: <T>(path: string, body?: unknown, opts?: Options) => request<T>("POST", path, { ...opts, body }),
  patch: <T>(path: string, body?: unknown, opts?: Options) => request<T>("PATCH", path, { ...opts, body }),
  put: <T>(path: string, body?: unknown, opts?: Options) => request<T>("PUT", path, { ...opts, body }),
  del: <T>(path: string, opts?: Options) => request<T>("DELETE", path, opts),
};

export type UploadedFile = { id: string; url: string; originalName: string; mime: string; size: number; sha256: string };

/** Multipart upload with progress callback (0..1). */
export function uploadFile(file: File, onProgress?: (p: number) => void, path = "/files"): Promise<UploadedFile> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}${path}`);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      let data: any = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new ApiError(xhr.status, data?.error?.code ?? "UPLOAD_FAILED", data?.error?.message ?? "Upload failed"));
    };
    xhr.onerror = () => reject(new ApiError(0, "NETWORK", "Network error"));
    const fd = new FormData();
    fd.append("file", file);
    xhr.send(fd);
  });
}

/** Human message for toasts */
export function errorMessage(e: unknown, fallback = "Xatolik yuz berdi"): string {
  if (e instanceof ApiError) return e.message || fallback;
  if (e instanceof Error) return e.message;
  return fallback;
}
