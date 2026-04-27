#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/zktls-twitter-sdk-demo.sh [options]

Build a Newton JSON-RPC newt_createTask payload for a Twitter/X zkTLS proof.
By default this is a dry run that prints JSON to stdout. Add --submit to POST it.

Required options:
  --policy-client <address>   Policy client contract address
  --from <address>            Intent sender address
  --to <address>              Intent target address
  --proof-cid <cid>           IPFS CID of the TLSNotary presentation

Optional options:
  --gateway-url <url>         Gateway RPC URL (required with --submit)
  --api-key <key>             Gateway x-newton-secret value for --submit
  --chain-id <id>             Chain ID (default: 11155111)
  --value <uint>              Intent value in wei (default: 0)
  --data <hex>                Intent calldata (default: 0x)
  --function-signature <hex>  Intent function signature (default: 0x)
  --min-followers <n>         Twitter follower threshold (default: 1000)
  --twitter-username <name>   Expected username metadata for plugin args (default: newton_protocol)
  --timeout <seconds>         Gateway timeout (default: 60)
  --submit                    POST the payload to --gateway-url
  -h, --help                  Show this help
USAGE
}

POLICY_CLIENT=""
FROM=""
TO=""
PROOF_CID=""
GATEWAY_URL=""
API_KEY=""
CHAIN_ID="11155111"
VALUE="0"
DATA="0x"
FUNCTION_SIGNATURE="0x"
MIN_FOLLOWERS="1000"
TWITTER_USERNAME="newton_protocol"
TIMEOUT="60"
SUBMIT=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --policy-client) POLICY_CLIENT="$2"; shift 2 ;;
    --from) FROM="$2"; shift 2 ;;
    --to) TO="$2"; shift 2 ;;
    --proof-cid) PROOF_CID="$2"; shift 2 ;;
    --gateway-url) GATEWAY_URL="$2"; shift 2 ;;
    --api-key) API_KEY="$2"; shift 2 ;;
    --chain-id) CHAIN_ID="$2"; shift 2 ;;
    --value) VALUE="$2"; shift 2 ;;
    --data) DATA="$2"; shift 2 ;;
    --function-signature) FUNCTION_SIGNATURE="$2"; shift 2 ;;
    --min-followers) MIN_FOLLOWERS="$2"; shift 2 ;;
    --twitter-username) TWITTER_USERNAME="$2"; shift 2 ;;
    --timeout) TIMEOUT="$2"; shift 2 ;;
    --submit) SUBMIT=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

for required in POLICY_CLIENT FROM TO PROOF_CID; do
  if [[ -z "${!required}" ]]; then
    echo "Missing required option: ${required,,}" >&2
    usage >&2
    exit 2
  fi
done

if [[ "$SUBMIT" -eq 1 && -z "$GATEWAY_URL" ]]; then
  echo "--gateway-url is required with --submit" >&2
  exit 2
fi

payload_file="$(mktemp)"
trap 'rm -f "$payload_file"' EXIT

python3 - "$payload_file" <<'PY' \
  "$POLICY_CLIENT" "$FROM" "$TO" "$PROOF_CID" "$CHAIN_ID" "$VALUE" "$DATA" \
  "$FUNCTION_SIGNATURE" "$MIN_FOLLOWERS" "$TWITTER_USERNAME" "$TIMEOUT"
import binascii
import json
import sys

(
    output_path,
    policy_client,
    from_addr,
    to_addr,
    proof_cid,
    chain_id,
    value,
    data,
    function_signature,
    min_followers,
    twitter_username,
    timeout,
) = sys.argv[1:]

wasm_args = {
    "min_followers": int(min_followers),
    "twitter_username": twitter_username,
}
wasm_args_hex = "0x" + binascii.hexlify(json.dumps(wasm_args, separators=(",", ":")).encode()).decode()
chain_id_hex = hex(int(chain_id, 0))
value_hex = hex(int(value, 0))

payload = {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "newt_createTask",
    "params": [
        {
            "policy_client": policy_client,
            "intent": {
                "from": from_addr,
                "to": to_addr,
                "value": value_hex,
                "data": data,
                "chain_id": chain_id_hex,
                "function_signature": function_signature,
            },
            "wasm_args": wasm_args_hex,
            "timeout": int(timeout),
            "use_two_phase": True,
            "proof_cid": proof_cid,
        }
    ],
}

with open(output_path, "w", encoding="utf-8") as f:
    json.dump(payload, f, indent=2)
    f.write("\n")
PY

if [[ "$SUBMIT" -eq 0 ]]; then
  cat "$payload_file"
  exit 0
fi

curl_args=(
  -sS
  -X POST "$GATEWAY_URL"
  -H 'Content-Type: application/json'
  --data-binary "@$payload_file"
)

if [[ -n "$API_KEY" ]]; then
  curl_args+=( -H "x-newton-secret: $API_KEY" )
fi

curl "${curl_args[@]}"
printf '\n'
