#!/usr/bin/env bash
# Zero-downtime update: pull, build, migrate, then roll replicas one by one behind nginx.
#   ./deploy/scripts/deploy.sh [git-ref]
set -euo pipefail
cd "$(dirname "$0")/../.."

REF="${1:-main}"
echo "▶ fetching $REF"
git fetch --all --prune
git checkout "$REF"
git pull --ff-only || true

export TAG="$(git rev-parse --short HEAD)"
echo "▶ building images (tag $TAG)"
docker compose build migrate web-1
# keep :latest pointing at the new build for the pull_policy=never services
docker tag "ekabuild/api:$TAG" ekabuild/api:latest 2>/dev/null || true
docker tag "ekabuild/web:$TAG" ekabuild/web:latest 2>/dev/null || true

echo "▶ migrations"
docker compose up -d mysql redis rabbitmq
docker compose run --rm migrate

wait_healthy() {
  local svc=$1
  for _ in $(seq 1 60); do
    local id; id=$(docker compose ps -q "$svc")
    [[ "$(docker inspect -f '{{.State.Health.Status}}' "$id" 2>/dev/null)" == "healthy" ]] && return 0
    sleep 2
  done
  echo "✗ $svc did not become healthy"; docker compose logs --tail=80 "$svc"; return 1
}

echo "▶ rolling update"
for svc in api-1 api-2 web-1 web-2; do
  docker compose up -d --no-deps --force-recreate "$svc"
  wait_healthy "$svc"
  echo "  ✓ $svc"
done
for svc in worker-1 worker-2; do docker compose up -d --no-deps --force-recreate "$svc"; done
docker compose up -d nginx
docker compose exec nginx nginx -s reload

docker image prune -f >/dev/null
echo "✓ deployed $TAG"
