#!/bin/sh
set -e

if [ -n "$DATABASE_URL" ]; then
  if [ -d "prisma/migrations" ] && [ -n "$(ls -A prisma/migrations 2>/dev/null)" ]; then
    echo "[entrypoint] Applying database migrations (prisma migrate deploy)..."
    npx --yes prisma migrate deploy || echo "[entrypoint] WARNING: prisma migrate deploy failed; continuing startup."
  else
    echo "[entrypoint] No migrations folder found — syncing schema with prisma db push..."
    npx --yes prisma db push --skip-generate || echo "[entrypoint] WARNING: prisma db push failed; continuing startup."
  fi
else
  echo "[entrypoint] DATABASE_URL not set — skipping schema sync."
fi

echo "[entrypoint] Starting application on port ${PORT:-3002}..."
exec "$@"
