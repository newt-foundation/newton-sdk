# zkTLS Twitter/X Troubleshooting Guide

Summary: this guide lists the most common failure points and the quickest commands to inspect them.

## 1. `proof_cid` is missing from task payload

Symptoms:

- Gateway receives a task but operators do not fetch a TLSNotary proof.
- Logs do not mention `_newton.proof_cid` or `proof_cid`.

Fix:

```bash
python3 -m json.tool /tmp/newton-zktls-twitter-payload.json | grep -E 'proof_cid|use_two_phase'
```

Use either SDK-style `proofCid` in `task.json` or raw JSON-RPC `proof_cid`. Do not pass both with different values.

## 2. `Conflicting values for proof_cid and proofCid`

Cause: both aliases were supplied with different CIDs.

Fix: keep exactly one CID value.

```json
{
  "proofCid": "bafy..."
}
```

or

```json
{
  "proof_cid": "bafy..."
}
```

## 3. Gateway health check fails

Check containers:

```bash
docker compose -f bin/deploy/docker-compose.gateway-local.yml ps
```

Check setup logs first:

```bash
docker compose -f bin/deploy/docker-compose.gateway-local.yml logs --tail=200 setup
```

Common causes:

- first Docker build still running
- contract deployment not complete
- Postgres not healthy
- port `8080`, `5432`, or `8545` already in use

## 4. API key rejected

Symptoms:

- HTTP 401 / 403 from `/rpc`
- `Authorization: Bearer` missing or wrong

Fix:

```bash
export NEWTON_API_KEY="replace-with-local-seeded-key"
curl -i -X POST http://127.0.0.1:8080/rpc \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $NEWTON_API_KEY" \
  --data-binary @/tmp/newton-zktls-twitter-payload.json
```

## 5. IPFS fetch fails

Symptoms:

- operator logs say proof download failed
- HTTP 404/timeout from IPFS gateway

Checks:

```bash
export PROOF_CID="bafy..."
export IPFS_GATEWAY="https://ipfs.io/ipfs/"
curl -I "${IPFS_GATEWAY}${PROOF_CID}"
```

Fixes:

- use a real CID, not the placeholder from examples
- configure the same gateway for operator/data-provider
- ensure proof bytes are below the configured proof size limit

## 6. TLSNotary verification fails

Symptoms:

- proof downloads, but operator rejects verification
- trusted notary key or server name errors

Fix checklist:

- operator has the trusted TLSNotary notary verifying key configured
- proof was created by the matching notary key
- proof server is `api.x.com` or `api.twitter.com` for the Twitter policy
- proof reveals the response body fields needed by the policy

## 7. Policy denies even though proof verifies

Check policy inputs:

```bash
# Operator-side policy lives in newton-prover-avs; inspect tlsn_twitter_followers.rego there when debugging verifier/policy failures.
python3 -m json.tool examples/zktls-twitter/configs/wasm-args.json
```

Common causes:

- `followers_count` below `min_followers`
- proof age exceeds `max_proof_age_secs`
- server name is not in the policy allowlist
- response body shape differs from expected Twitter/X API JSON

## 8. Docker Compose config errors

Run:

```bash
docker compose -f bin/deploy/docker-compose.gateway-local.yml config >/tmp/newton-compose.yml
```

If this fails, verify Docker Compose v2 and `bin/deploy/.env.local`.

## 9. Rust tests rebuild too much

The first run can compile many crates. For doc-only validation, use:

```bash
./scripts/zktls-tutorial-doctor.sh
```

For policy behavior, use the focused test:

```bash
cargo test -p integration-tests --test tlsn_flow -- --nocapture
```


## 10. Missing `bin/deploy/.env.local`

Fresh checkouts do not include ignored local env files. Create one from the tutorial-safe example:

```bash
cp -n bin/deploy/.env.local.example bin/deploy/.env.local
```

## 11. Browser proof generation is unclear

Use `newt-foundation/newton-tlsn-extension-demo` for the browser extension proof-generation UX. This repo's CLI script starts after proof storage, when you already have a CID.

## 12. Port already allocated

Check local listeners:

```bash
for port in 5432 6379 8080 8545 8546 9005 9006; do
  ss -ltnp "sport = :$port" || true
done
```

Stop the conflicting service or remap ports in Docker Compose before starting the stack.

## 13. `CID integrity check failed: returned bytes do not match the requested content hash`

Symptoms:

- `sdk.proof.store(...)` or `sdk.proof.retrieve(cid)` throws this error
- The HTTP request succeeded; the failure is client-side after the response

Cause: the SDK re-derives the CID locally and compares it to the gateway-returned (or caller-supplied) CID. A mismatch means either:

- the gateway returned a CID that does not address the bytes the client just uploaded
- the bytes returned by IPFS retrieval do not hash to the requested CID

This is intentional and protects against a misconfigured or malicious gateway substituting unrelated content.

Fixes:

- confirm the gateway's IPFS pinning service is healthy and not returning cached/wrong content
- if the CID was hand-constructed, ensure it uses sha2-256 multihash (multicodec `0x12`) — the SDK rejects other algorithms with `CID integrity check unsupported: multihash algorithm <code> is not sha-256`
- verify `multiformats` is installed at compatible major version; structural shape of `parsed.multihash.{code,bytes}` must match the SDK's `multiformats-compat.d.ts`

## 14. `WebSocket frame exceeds 1 MB`

Symptoms:

- `sdk.attester.createSession(...)` or `sdk.attester.reveal(...)` rejects with this error before completion

Cause: the attester sent a single WebSocket frame larger than the SDK's 1 MB cap. This guard prevents a malicious or misconfigured attester from exhausting client memory with arbitrarily large payloads.

Fixes:

- inspect the attester logs for the message it tried to send; legitimate `sessionRegistered` and `sessionCompleted` messages are well below 1 MB
- if a real revealed-value payload exceeds 1 MB, the attester is encoding too much state into a single frame — split the reveal across multiple `revealConfig` requests or trim the response body fields the policy needs

## 15. `wasmArgs` hex cap exceeded

Symptoms:

- `decodeWasmArgs(hex)` throws "wasmArgs hex too long" or task creation rejects oversized args

Cause: encoded `wasmArgs` exceed the SDK's 50 MiB hex cap. This bound matches the operator-side proof size limit and protects against unbounded JSON serialization.

Fixes:

- inspect the JSON object you passed to `encodeWasmArgs(...)` — typical Twitter follower policies use ~100 bytes
- if you are deliberately passing large data, route it through `proofCid` (IPFS) instead of inline `wasmArgs`

## 16. Gateway response body exceeds 1 MiB

Symptoms:

- `sdk.task.createTask(...)` or any `sdk.gateway.*` call rejects with "Response body exceeds maximum allowed size"

Cause: the gateway returned a JSON-RPC response larger than the SDK's 1 MiB body cap. The cap is enforced by streaming the response and aborting via `reader.cancel()` once the byte counter exceeds the limit.

Fixes:

- a normal JSON-RPC response is well under 1 MiB; an oversized response usually means the gateway is returning unexpected content (HTML error page from a misconfigured proxy, debug dumps, etc.)
- check `curl -i ${GATEWAY_URL}/rpc` directly to see the raw response size and content type
- if the gateway is behind an HTTPS terminator, confirm it is not interpolating its own error pages into successful responses
