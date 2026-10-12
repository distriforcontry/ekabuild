#!/usr/bin/env bash
# Nightly backup: MySQL dump + uploaded files. Keeps 14 days.
#   crontab: 30 3 * * * /opt/ekabuild/deploy/scripts/backup.sh >> /var/log/ekabuild-backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/../.."
set -a; . ./.env; set +a
DEST="${BACKUP_DIR:-/var/backups/ekabuild}"
STAMP="$(date +%Y%m%d-%H%M)"
mkdir -p "$DEST"

docker compose exec -T mysql sh -c "mysqldump -uroot -p\"\$MYSQL_ROOT_PASSWORD\" --single-transaction --routines --triggers ${MYSQL_DATABASE:-ekabuild}" \
  | gzip > "$DEST/db-$STAMP.sql.gz"
docker run --rm -v ekabuild_uploads:/data:ro -v "$DEST:/backup" alpine tar czf "/backup/uploads-$STAMP.tar.gz" -C /data .

find "$DEST" -type f -mtime +14 -delete
echo "✓ backup $STAMP → $DEST"
