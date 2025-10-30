#!/bin/sh
set -euo pipefail

if [ -f "dist/migrate.js" ]; then
  echo "Running database migrations..."
  node dist/migrate.js
fi

echo "Starting indexer service..."
exec "$@"
