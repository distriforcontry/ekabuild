#!/usr/bin/env bash
# Kubernetes rollout: build & push images → run migrations Job → apply manifests pinned to the git SHA → wait.
#   REGISTRY=ghcr.io/distriforcontry ./deploy/k8s/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

REGISTRY="${REGISTRY:-ghcr.io/distriforcontry}"
TAG="${TAG:-$(git rev-parse --short HEAD)}"
NS=ekabuild
OVERLAY=deploy/k8s/overlays/production

if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  echo "▶ building images $TAG"
  docker build -f apps/api/Dockerfile -t "$REGISTRY/ekabuild-api:$TAG" .
  docker build -f apps/web/Dockerfile -t "$REGISTRY/ekabuild-web:$TAG" \
    --build-arg API_INTERNAL_URL=http://api:4000 --build-arg NEXT_PUBLIC_SITE_URL="${PUBLIC_URL:-https://ekabuild.uz}" \
    --build-arg NEXT_PUBLIC_EIMZO_API_KEYS="${NEXT_PUBLIC_EIMZO_API_KEYS:-}" .
  docker push "$REGISTRY/ekabuild-api:$TAG"
  docker push "$REGISTRY/ekabuild-web:$TAG"
fi

echo "▶ pinning image tags"
(cd "$OVERLAY" && kustomize edit set image \
  "ekabuild-api=$REGISTRY/ekabuild-api:$TAG" "ekabuild-web=$REGISTRY/ekabuild-web:$TAG")

echo "▶ namespace, config and data services"
kubectl apply -k "$OVERLAY"
kubectl -n "$NS" rollout status statefulset/mysql --timeout=300s

echo "▶ migrations"
kubectl -n "$NS" delete job migrate --ignore-not-found
sed "s#ghcr.io/distriforcontry/ekabuild-api:latest#$REGISTRY/ekabuild-api:$TAG#" deploy/k8s/jobs/migrate.yaml | kubectl apply -f -
kubectl -n "$NS" wait --for=condition=complete job/migrate --timeout=600s || { kubectl -n "$NS" logs job/migrate; exit 1; }

echo "▶ rollout"
for d in api worker web; do kubectl -n "$NS" rollout status deployment/$d --timeout=600s; done
kubectl -n "$NS" get pods -o wide
echo "✓ deployed $TAG"
