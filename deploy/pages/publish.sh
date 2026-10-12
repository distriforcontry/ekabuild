#!/usr/bin/env bash
# Force-push .pages-build/site to the gh-pages branch (GitHub → Settings → Pages → "Deploy from a branch: gh-pages").
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
SITE=$ROOT/.pages-build/site
REMOTE=${REMOTE:-$(git -C "$ROOT" remote get-url origin)}
[ -f "$SITE/index.html" ] || { echo "run deploy/pages/build.sh first" >&2; exit 1; }
TMP=$(mktemp -d)
cp -a "$SITE/." "$TMP/"
cd "$TMP"
git init -q -b gh-pages
git add -A
git -c user.name="${GIT_AUTHOR_NAME:-EKA BUILD}" -c user.email="${GIT_AUTHOR_EMAIL:-pages@ekabuild.uz}" commit -q -m "Static demo of ekabuild.uz public site ($(git -C "$ROOT" rev-parse --short HEAD))"
git push -f "$REMOTE" gh-pages
rm -rf "$TMP"
echo "✓ pushed to gh-pages"
