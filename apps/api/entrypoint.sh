#!/bin/sh
set -e

echo "Waiting for database..."
until nc -z db 5432 2>/dev/null; do
  sleep 1
done
echo "Database is reachable."

echo "Running migrations..."
pnpm --filter @rolecompanion/db migrate

echo "Seeding SRD data..."
pnpm --filter @rolecompanion/db seed

echo "Starting API..."
exec pnpm --filter api dev
