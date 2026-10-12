/**
 * API images (`/api/v1/files/<id>`) can be requested resized as WebP: `?w=480|768|1024|1600`.
 * Anything else (static /renders, external URLs) is passed through untouched.
 */
export type ApiWidth = 480 | 768 | 1024 | 1600;

const isApiFile = (url: string) => url.startsWith("/api/v1/files/") || /^https?:\/\/[^/]+\/api\/v1\/files\//.test(url);

export function apiImg(url: string, w: ApiWidth): string;
export function apiImg(url: string | null | undefined, w: ApiWidth): string | null;
export function apiImg(url: string | null | undefined, w: ApiWidth) {
  if (!url) return null;
  if (!isApiFile(url)) return url;
  const [base, query = ""] = url.split("?");
  const params = new URLSearchParams(query);
  params.set("w", String(w));
  return `${base}?${params.toString()}`;
}

export function apiSrcSet(url: string | null | undefined, widths: ApiWidth[] = [480, 768, 1024]) {
  if (!url || !isApiFile(url)) return undefined;
  return widths.map((w) => `${apiImg(url, w)} ${w}w`).join(", ");
}
