import { NextResponse, type NextRequest } from "next/server";

/**
 * 1. Subdomain routing (one Next app serves every host):
 *      admin.ekabuild.uz/  → /admin           app.ekabuild.uz/ → /app
 *    Only the root is rewritten; every other path is served as-is, so links like <Link href="/admin/users">
 *    or /projects/… work identically on every host and in local dev.
 * 2. Session refresh: when the short-lived access cookie is gone but a refresh cookie exists,
 *    refresh against the API and hand the new cookies to both the browser and this render.
 * 3. Guard: /app and /admin require a session (role checks happen in their layouts).
 */

const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? "http://localhost:4000";
function areaForHost(host: string): "admin" | "app" | null {
  const sub = host.split(":")[0]!.split(".")[0];
  if (sub === "admin") return "admin";
  if (sub === "app") return "app";
  return null;
}

async function tryRefresh(req: NextRequest): Promise<string[] | null> {
  const rt = req.cookies.get("eka_rt");
  if (!rt) return null;
  try {
    const res = await fetch(`${API_INTERNAL_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { cookie: `eka_rt=${rt.value}`, "x-forwarded-for": req.headers.get("x-forwarded-for") ?? "", "user-agent": req.headers.get("user-agent") ?? "" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.headers.getSetCookie();
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const area = areaForHost(host);

  // ── subdomain rewrite
  const rewriteTo = area && pathname === "/" ? `/${area}${search}` : null;
  const effectivePath = rewriteTo ? rewriteTo.split("?")[0]! : pathname;
  const protectedArea = effectivePath.startsWith("/app") || effectivePath.startsWith("/admin");

  // ── session refresh
  let setCookies: string[] | null = null;
  const hasAccess = req.cookies.has("eka_at");
  if (!hasAccess && req.cookies.has("eka_rt") && !pathname.startsWith("/api")) {
    setCookies = await tryRefresh(req);
  }

  if (protectedArea && !hasAccess && !setCookies) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  // forward refreshed cookies to this render
  const requestHeaders = new Headers(req.headers);
  if (setCookies?.length) {
    const fresh = setCookies.map((c) => c.split(";")[0]!).filter(Boolean);
    const existing = req.headers.get("cookie") ?? "";
    const names = new Set(fresh.map((c) => c.split("=")[0]));
    const kept = existing
      .split(/;\s*/)
      .filter((c) => c && !names.has(c.split("=")[0]));
    requestHeaders.set("cookie", [...kept, ...fresh].join("; "));
  }

  const res = rewriteTo
    ? NextResponse.rewrite(new URL(rewriteTo, req.url), { request: { headers: requestHeaders } })
    : NextResponse.next({ request: { headers: requestHeaders } });
  for (const c of setCookies ?? []) res.headers.append("set-cookie", c);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|api/|.*\\.(?:svg|png|jpg|jpeg|webp|gif|ico|glb|gltf|exr|hdr|woff2?)$).*)"],
};
