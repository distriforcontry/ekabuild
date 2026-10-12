/**
 * Static demo export (GitHub Pages): every public page is prerendered at build time from the seeded API, there is
 * no API server, no cookies and no middleware. See deploy/pages/build.sh.
 *
 *   STATIC_EXPORT=1         build-time / server code (read cookies, headers, searchParams → defaults)
 *   STATIC_LOCALE=uz|oz|ru  locale of this build (one build per locale, under BASE_PATH/<locale>)
 *   NEXT_PUBLIC_DEMO=1      inlined into client bundles: API calls are answered by lib/demo-api
 *   NEXT_PUBLIC_BASE_PATH   e.g. /ekabuild or /ekabuild/ru
 *   NEXT_PUBLIC_DEMO_ROOT   site root shared by all locales, e.g. /ekabuild
 */
export const IS_STATIC = process.env.STATIC_EXPORT === "1";
export const IS_DEMO = process.env.NEXT_PUBLIC_DEMO === "1";
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const DEMO_ROOT = process.env.NEXT_PUBLIC_DEMO_ROOT ?? BASE_PATH;

/** searchParams of a prerendered page are always empty (client components read the URL themselves). */
export async function staticSearchParams<T extends object>(sp: Promise<T>): Promise<Partial<T>> {
  return IS_STATIC ? {} : await sp;
}
