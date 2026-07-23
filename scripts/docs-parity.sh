#!/usr/bin/env bash
# Route/redirect parity gate. Assumes the Vocs site is already built (site/dist).
# Starts `vocs preview`, waits for readiness (no fixed sleep), runs the parity
# harness, and always tears the preview down — success, failure, or interrupt.
set -euo pipefail

PORT="${DOCS_PARITY_PORT:-4173}"
BASE="http://localhost:${PORT}"
# A real built route to poll for readiness (home "/" is a hosting-layer redirect,
# so it is not a reliable readiness signal against `vocs preview`).
READY_PATH="/developers/advanced/encrypting-secrets"

cd "$(dirname "$0")/../site"

preview_pid=""
cleanup() {
  if [ -n "${preview_pid}" ] && kill -0 "${preview_pid}" 2>/dev/null; then
    kill "${preview_pid}" 2>/dev/null || true
    wait "${preview_pid}" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

pnpm preview --port "${PORT}" >/tmp/vocs-preview.log 2>&1 &
preview_pid=$!

# Poll for readiness — up to ~30s — instead of a fixed delay.
ready=""
for _ in $(seq 1 60); do
  if ! kill -0 "${preview_pid}" 2>/dev/null; then
    echo "docs-parity: preview server exited early:" >&2
    cat /tmp/vocs-preview.log >&2 || true
    exit 1
  fi
  code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE}${READY_PATH}" 2>/dev/null || echo 000)
  if [ "${code}" = "200" ]; then ready=1; break; fi
  sleep 0.5
done
if [ -z "${ready}" ]; then
  echo "docs-parity: preview did not become ready at ${BASE}${READY_PATH}" >&2
  cat /tmp/vocs-preview.log >&2 || true
  exit 1
fi

node scripts/verify-parity.mjs "${BASE}"
