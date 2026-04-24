#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HEALTH_URL="http://localhost:8080/health"
MAX_ATTEMPTS="${NEWTON_GATEWAY_HEALTH_RETRIES:-60}"
SLEEP_SECONDS="${NEWTON_GATEWAY_HEALTH_INTERVAL:-5}"

for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  if curl -fsS "$HEALTH_URL" >/dev/null; then
    export NEWTON_GATEWAY_URL="http://localhost:8080"
    export NEWTON_SIDECAR_URL="http://localhost:8080"
    cd "$ROOT_DIR"
    exec npx vitest run tests/e2e-integration.test.ts
  fi

  if [ "$attempt" -eq "$MAX_ATTEMPTS" ]; then
    echo "Gateway health check failed after $MAX_ATTEMPTS attempts: $HEALTH_URL" >&2
    exit 1
  fi

  sleep "$SLEEP_SECONDS"
done
