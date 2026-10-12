#!/usr/bin/env bash
# Static demo of the public site (landing, catalog, project pages with 3D, verification, rules, developers, auth
# screens) for GitHub Pages, in three languages: <root>/ (uz), <root>/oz/, <root>/ru/.
#
# Needs a running, seeded API (pnpm db:seed with SEED_DEMO=true):
#   API_URL=http://localhost:4000 ./deploy/pages/build.sh            → .pages-build/site
#   ./deploy/pages/publish.sh                                       → force-pushes the site to the gh-pages branch
#
# Pages are prerendered from the API at build time; in the browser lib/demo-api answers the read-only calls
# (certificate / file-hash verification, instalment calculator) from a snapshot, everything else explains it is a demo.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
API=${API_URL:-http://localhost:4000}
SITE_ROOT=${PAGES_BASE:-/ekabuild}
SITE_URL=${PAGES_URL:-https://distriforcontry.github.io/ekabuild}
WORK=$ROOT/.pages-build
OUT=$WORK/site

curl -fsS "$API/api/v1/health" >/dev/null || { echo "API is not reachable at $API" >&2; exit 1; }

echo "→ preparing public-only copies of apps/web (one per locale, built in parallel)"
rm -rf "$WORK"/web-* "$OUT" && mkdir -p "$OUT"
for locale in uz oz ru; do
  dir=$WORK/web-$locale
  mkdir -p "$dir"
  tar -C "$ROOT/apps/web" --exclude=./node_modules --exclude='./.next*' --exclude=./out -cf - . | tar -C "$dir" -xf -
  ln -s "$ROOT/apps/web/node_modules" "$dir/node_modules"
  # cabinet, admin and the session middleware need the API server — not part of the static demo
  rm -rf "$dir/src/app/app" "$dir/src/app/admin" "$dir/src/middleware.ts"
  cp "$ROOT/deploy/pages/next.config.pages.ts" "$dir/next.config.ts"
done

build() {
  local locale=$1 base=$SITE_ROOT$([ "$1" = uz ] || echo "/$1")
  cd "$WORK/web-$locale"
  STATIC_EXPORT=1 STATIC_LOCALE=$locale NEXT_PUBLIC_DEMO=1 NEXT_PUBLIC_BASE_PATH=$base NEXT_PUBLIC_DEMO_ROOT=$SITE_ROOT \
    NEXT_PUBLIC_SITE_URL=$SITE_URL API_INTERNAL_URL=$API NEXT_TELEMETRY_DISABLED=1 npx next build >"$WORK/build-$locale.log" 2>&1
}
pids=()
for locale in uz oz ru; do
  echo "→ next build ($locale)"
  build "$locale" &
  pids+=($!)
done
for i in 0 1 2; do
  wait "${pids[$i]}" || { l=(uz oz ru); tail -40 "$WORK/build-${l[$i]}.log"; exit 1; }
done
rm -rf "$WORK"/web-*/out/cache   # Next's fetch cache lands in distDir — not part of the site
cp -a "$WORK/web-uz/out/." "$OUT/"
for locale in oz ru; do mkdir -p "$OUT/$locale" && cp -a "$WORK/web-$locale/out/." "$OUT/$locale/"; done

echo "→ post-processing (shared assets, API files, demo snapshot)"
node "$ROOT/deploy/pages/postprocess.mjs" --out "$OUT" --api "$API" --root "$SITE_ROOT" --site "$SITE_URL" --public "$ROOT/apps/web/public"
touch "$OUT/.nojekyll"   # keep /_next (Jekyll would drop folders starting with "_")
du -sh "$OUT"
echo "✓ static site in $OUT"
