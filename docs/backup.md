# SIGMA Backup

SIGMA stores durable data under `~/sigma-data/`. PostgreSQL is the source of truth for
users, sources, collected items, summaries, reports, and logs. Redis is used for cache,
locks, and transient state.

## Manual Backup

Run:

```bash
./scripts/backup.sh
```

The script creates `~/sigma-data/backups/sigma-YYYYmmdd-HHMMSS.sql.gz` from the
`sigma-postgres` container and keeps the newest 7 backup files.

Dry-run without touching Docker:

```bash
./scripts/backup.sh --dry-run
```

## Restore

1. Stop the application workers:

   ```bash
   docker compose -f docker-compose.prod.yml stop sigma-backend sigma-frontend
   ```

2. Restore a backup:

   ```bash
   gunzip -c ~/sigma-data/backups/sigma-YYYYmmdd-HHMMSS.sql.gz \
     | docker exec -i sigma-postgres psql -U sigma -d sigma
   ```

3. Restart:

   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```

## Scheduled Backup

Add a daily cron entry:

```cron
15 3 * * * cd /Users/<you>/Projects/sigma && ./scripts/backup.sh >> ~/sigma-data/backups/backup.log 2>&1
```

## Optional iCloud Sync

To keep a second local copy in iCloud Drive:

```bash
mkdir -p "$HOME/Library/Mobile Documents/com~apple~CloudDocs/SIGMA Backups"
rsync -a --delete ~/sigma-data/backups/ "$HOME/Library/Mobile Documents/com~apple~CloudDocs/SIGMA Backups/"
```

Keep API keys and `.env.prod` out of synced folders unless you have explicitly accepted
that risk.
