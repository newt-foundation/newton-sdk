#!/usr/bin/env bash
set -euo pipefail

WITH_DOCKER=false
if [[ "${1:-}" == "--docker" ]]; then
  WITH_DOCKER=true
elif [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  cat <<'USAGE'
Usage: scripts/zktls-tutorial-doctor.sh [--docker]

Validates the zkTLS Twitter/X tutorial pack fixtures and local tooling.
Use --docker to also run Docker Compose config validation when Docker is installed.
USAGE
  exit 0
elif [[ $# -gt 0 ]]; then
  echo "Unknown argument: $1" >&2
  exit 2
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ok() { printf '✓ %s\n' "$1"; }
warn() { printf '⚠ %s\n' "$1"; }
fail() { printf '✗ %s\n' "$1" >&2; exit 1; }
need_cmd() {
  if command -v "$1" >/dev/null 2>&1; then
    ok "$1 found: $(command -v "$1")"
  else
    fail "$1 is required"
  fi
}

need_cmd bash
need_cmd python3

required_files=(
  docs/zktls-twitter/README.md
  docs/zktls-twitter/QUICKSTART_10_MIN.md
  docs/zktls-twitter/LOCAL_DOCKER_COMPOSE.md
  docs/zktls-twitter/TROUBLESHOOTING.md
  docs/zktls-twitter/COMMAND_COOKBOOK.md
  docs/zktls-twitter/DEMO_UX_RECOMMENDATIONS.md
  docs/zktls-twitter/EXTENSION_DEMO_STRATEGY.md
  docs/zktls-twitter/EXTERNAL_TEST_REPORT_XCOM_REALSIGRIDJIN.md
  examples/zktls-twitter/configs/task.json
  examples/zktls-twitter/configs/create-task.json
  examples/zktls-twitter/configs/wasm-args.json
  scripts/zktls-twitter-sdk-demo.sh
)

for file in "${required_files[@]}"; do
  [[ -f "$file" ]] || fail "missing $file"
  ok "found $file"
done

bash -n scripts/zktls-twitter-sdk-demo.sh
ok "zktls-twitter-sdk-demo.sh syntax"

python3 -m json.tool examples/zktls-twitter/configs/task.json >/dev/null
python3 -m json.tool examples/zktls-twitter/configs/create-task.json >/dev/null
python3 -m json.tool examples/zktls-twitter/configs/wasm-args.json >/dev/null
ok "example JSON files parse"

payload="$(mktemp)"
trap 'rm -f "$payload"' EXIT
scripts/zktls-twitter-sdk-demo.sh \
  --policy-client 0x1111111111111111111111111111111111111111 \
  --from 0x2222222222222222222222222222222222222222 \
  --to 0x3333333333333333333333333333333333333333 \
  --proof-cid bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi \
  > "$payload"
python3 -m json.tool "$payload" >/dev/null
ok "demo script emits valid JSON"

python3 - "$payload" <<'PY'
import binascii
import json
import sys
payload = json.load(open(sys.argv[1], encoding="utf-8"))
params = payload["params"][0]
assert payload["method"] == "newt_createTask"
assert params["proof_cid"].startswith("bafy")
assert params["use_two_phase"] is True
wasm_args = json.loads(binascii.unhexlify(params["wasm_args"].removeprefix("0x")))
assert wasm_args["min_followers"] == 1000
assert wasm_args["twitter_username"] == "newton_protocol"
PY
ok "payload contains expected zkTLS fields"

if [[ "$WITH_DOCKER" == true ]]; then
  AVS_DIR="${NEWTON_PROVER_AVS_DIR:-../newton-prover-avs}"
  local_env_ready=false
  if [[ -f "$AVS_DIR/bin/deploy/.env.local" ]]; then
    ok "local compose env exists: $AVS_DIR/bin/deploy/.env.local"
    local_env_ready=true
  else
    warn "$AVS_DIR/bin/deploy/.env.local not found; run: cp -n \"$AVS_DIR/bin/deploy/.env.local.example\" \"$AVS_DIR/bin/deploy/.env.local\""
  fi

  for port in 5432 6379 8080 8545 8546 9005 9006; do
    if command -v ss >/dev/null 2>&1 && ss -ltn "sport = :$port" | grep -q LISTEN; then
      warn "port $port is already in use; local compose may fail unless remapped or freed"
    fi
  done

  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    if [[ "$local_env_ready" == true ]]; then
      docker compose -f "$AVS_DIR/bin/deploy/docker-compose.gateway-local.yml" config >/dev/null
      ok "docker compose config parses"
    else
      warn "skipped compose config parse until $AVS_DIR/bin/deploy/.env.local exists"
    fi
  else
    warn "docker compose not available; skipped compose validation"
  fi
fi

ok "tutorial doctor passed"
