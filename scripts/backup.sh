#!/usr/bin/env bash
set -euo pipefail

DATA_DIR="${SIGMA_DATA_DIR:-$HOME/sigma-data}"
BACKUP_DIR="$DATA_DIR/backups"
KEEP="${SIGMA_BACKUP_KEEP:-7}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
OUTPUT="$BACKUP_DIR/sigma-$STAMP.sql.gz"

if [[ "${1:-}" == "--dry-run" ]]; then
  echo "Dry run: would create $OUTPUT and keep the newest $KEEP backups."
  exit 0
fi

mkdir -p "$BACKUP_DIR"

docker exec sigma-postgres pg_dump -U sigma -d sigma | gzip > "$OUTPUT"

find "$BACKUP_DIR" -name "sigma-*.sql.gz" -type f -print0 \
  | sort -z -r \
  | tail -z -n +"$((KEEP + 1))" \
  | xargs -0 rm -f

echo "Created $OUTPUT"
