#!/bin/sh
set -euo pipefail

API_BASE_URL=${API_BASE_URL:-http://api:8000}
ENV_FILE=/usr/share/nginx/html/env.js

echo "window.__API_BASE_URL__ = \"${API_BASE_URL}\";" > "$ENV_FILE"

exec "$@"
