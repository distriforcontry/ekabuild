#!/usr/bin/env bash
# Obtains a Let's Encrypt certificate for DOMAIN + www/cabinet/admin/api subdomains and starts the stack.
# Requires DNS A records for all five names pointing at this server.
#   DOMAIN=ekabuild.uz EMAIL=admin@ekabuild.uz ./deploy/scripts/init-letsencrypt.sh [--staging]
set -euo pipefail
cd "$(dirname "$0")/../.."

DOMAIN="${DOMAIN:-$(grep -E '^APP_DOMAIN=' .env | cut -d= -f2)}"
EMAIL="${EMAIL:-admin@${DOMAIN}}"
STAGING=""
[[ "${1:-}" == "--staging" ]] && STAGING="--staging"
NAMES=("$DOMAIN" "www.$DOMAIN" "cabinet.$DOMAIN" "admin.$DOMAIN" "api.$DOMAIN")
# optional alias — included only when its DNS record exists
if getent hosts "app.$DOMAIN" >/dev/null 2>&1; then NAMES+=("app.$DOMAIN"); fi
CONF=deploy/certbot/conf
LIVE="$CONF/live/$DOMAIN"

mkdir -p "$CONF" deploy/certbot/www
if [[ ! -e "$CONF/options-ssl-nginx.conf" ]]; then
  curl -fsSL https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/src/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf -o "$CONF/options-ssl-nginx.conf" || true
fi

echo "▶ temporary self-signed certificate so nginx can boot"
mkdir -p "$LIVE"
docker run --rm -v "$PWD/$CONF:/etc/letsencrypt" --entrypoint openssl certbot/certbot \
  req -x509 -nodes -newkey rsa:2048 -days 1 -subj "/CN=$DOMAIN" \
  -keyout "/etc/letsencrypt/live/$DOMAIN/privkey.pem" -out "/etc/letsencrypt/live/$DOMAIN/fullchain.pem"

echo "▶ building and starting the stack"
docker compose up -d --build

echo "▶ requesting the real certificate"
rm -rf "$LIVE" "$CONF/archive/$DOMAIN" "$CONF/renewal/$DOMAIN.conf"
ARGS=()
for n in "${NAMES[@]}"; do ARGS+=(-d "$n"); done
docker run --rm -v "$PWD/$CONF:/etc/letsencrypt" -v "$PWD/deploy/certbot/www:/var/www/certbot" certbot/certbot \
  certonly --webroot -w /var/www/certbot $STAGING --email "$EMAIL" --agree-tos --no-eff-email --rsa-key-size 4096 --cert-name "$DOMAIN" "${ARGS[@]}"

docker compose exec nginx nginx -s reload
docker compose --profile tls up -d certbot
echo "✓ https://$DOMAIN is live (renewals run every 12h)"
