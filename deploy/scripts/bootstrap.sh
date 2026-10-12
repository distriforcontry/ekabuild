#!/usr/bin/env bash
# One-shot installer for a fresh Ubuntu server (run as root on 89.39.95.156):
#
#   git clone https://github.com/distriforcontry/ekabuild.git /opt/ekabuild   # private repo: use a token / deploy key
#   cd /opt/ekabuild && git checkout claude/wizardly-albattani-z0u3sf
#   DOMAIN=ekabuild.uz EMAIL=admin@ekabuild.uz ./deploy/scripts/bootstrap.sh
#
# Installs Docker, firewall, swap → writes .env with strong random secrets (demo mode: SMS mock + demo seed)
# → obtains Let's Encrypt certificates for ekabuild.uz, www, cabinet, admin, api → starts the whole stack.
set -euo pipefail
cd "$(dirname "$0")/../.."

DOMAIN="${DOMAIN:-ekabuild.uz}"
EMAIL="${EMAIL:-admin@$DOMAIN}"

if ! command -v docker >/dev/null; then
  bash deploy/scripts/server-setup.sh
fi

if [[ ! -f .env ]]; then
  echo "▶ generating .env (secrets are random; keep this file safe)"
  rnd() { openssl rand -base64 "$1" | tr -d '/+=\n' | cut -c1-"$2"; }
  ADMIN_PASSWORD="$(rnd 18 16)"
  cat > .env <<ENV
NODE_ENV=production
APP_DOMAIN=$DOMAIN
PUBLIC_URL=https://$DOMAIN
COOKIE_DOMAIN=.$DOMAIN
MYSQL_ROOT_PASSWORD=$(rnd 32 28)
MYSQL_DATABASE=ekabuild
MYSQL_USER=eka
MYSQL_PASSWORD=$(rnd 32 28)
RABBITMQ_USER=eka
RABBITMQ_PASSWORD=$(rnd 32 28)
JWT_SECRET=$(rnd 64 60)
ACCESS_TTL_MIN=60
REFRESH_TTL_DAYS=30
STORAGE_DRIVER=local
SMS_PROVIDER=mock
EIMZO_MODE=mock
CADASTRE_PROVIDER=mock
SEED_DEMO=true
SUPERADMIN_PHONE=+998901000001
SUPERADMIN_PASSWORD=$ADMIN_PASSWORD
GRAFANA_PASSWORD=$(rnd 18 16)
NEXT_PUBLIC_EIMZO_API_KEYS=
ENV
  chmod 600 .env
  echo "  bosh admin: +998901000001 / $ADMIN_PASSWORD   (parolni saqlab qo'ying)"
fi

DOMAIN="$DOMAIN" EMAIL="$EMAIL" bash deploy/scripts/init-letsencrypt.sh

echo "▶ monitoring (Grafana on 127.0.0.1:3001 → ssh -L 3001:127.0.0.1:3001 root@SERVER)"
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d

echo "✓ https://$DOMAIN · https://cabinet.$DOMAIN · https://admin.$DOMAIN · https://api.$DOMAIN/api/v1/health"
