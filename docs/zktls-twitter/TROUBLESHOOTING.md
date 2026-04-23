# zkTLS Twitter/X Troubleshooting Guide

한국어 요약: 가장 자주 막히는 지점과 바로 확인할 명령을 정리했습니다.

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
- `x-newton-secret` missing or wrong

Fix:

```bash
export NEWTON_API_KEY="replace-with-local-seeded-key"
curl -i -X POST http://127.0.0.1:8080/rpc \
  -H 'Content-Type: application/json' \
  -H "x-newton-secret: $NEWTON_API_KEY" \
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
