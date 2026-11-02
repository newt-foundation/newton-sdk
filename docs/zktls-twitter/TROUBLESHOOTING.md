# zkTLS Twitter/X Troubleshooting Guide

Summary: this guide lists the most common failure points and the quickest commands to inspect them.

## 1. `proof_cid is unsupported; zkTLS proof verification is unavailable`

Symptoms:

- `newt_createTask` or `newt_sendTask` fails with HTTP 400 and `{"InvalidRequest":"proof_cid is unsupported; zkTLS proof verification is unavailable"}`
- the example SDK throws `RpcError` with `code: "InvalidRequest"`: `gateway newt_createTask returned 400 [InvalidRequest] proof_cid is unsupported; zkTLS proof verification is unavailable`
- a `wasm_args` entry that carries `_newton.proof_cid` fails with `wasm_args[i]._newton.proof_cid is unsupported; zkTLS proof verification is unavailable`
- `newton-cli` stops with the same error before it sends the request

Cause: the current gateway does not verify zkTLS proofs, so it rejects any non-null `proof_cid` or `proofCid` instead of running the task without the proof.

Fix: there is no supported way to attach a proof today. Find the field in a payload with:

```bash
python3 -m json.tool /tmp/newton-zktls-twitter-payload.json | grep -E 'proof_cid|proofCid'
```

Removing it lets the task run, but the Twitter follower policy still denies: it allows only when `input.data.tlsn_verified` is true, which needs a verified proof.

## 2. `conflicting proof CID aliases: proofCid=... but proof_cid=...`

Cause: the request carries both `proofCid` and `proof_cid` with different values. The gateway checks this before the rejection in section 1.

Fix: remove both. Keeping only one turns this into the section 1 error.

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
- the example SDK throws `RpcError` with `status: 401` and `code: "AuthenticationFailed"` when it sent no key, or `code: "http_error"` for an unknown key, which the gateway answers with an empty body
- a key without the method's permission gets `status: 403` and `code: "AuthorizationFailed"`
- `/ws` answers the upgrade with 401 `missing or invalid API key` (section 19)

Fix:

```bash
export NEWTON_API_KEY="replace-with-local-seeded-key"
curl -i -X POST http://127.0.0.1:8080/rpc \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $NEWTON_API_KEY" \
  --data-binary @/tmp/newton-zktls-twitter-payload.json
```

## 5. IPFS fetch fails

Sections 5 to 7 apply only to a gateway build that verifies zkTLS proofs. The current gateway rejects `proof_cid` before any operator sees the task (section 1).

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

## 15. `wasmArgs` too large

Symptoms:

- `decodeWasmArgs(hex)` throws `Invalid hex string: payload exceeds 52428800 bytes`
- `newt_createTask` or `newt_sendTask` fails with HTTP 413, which the SDK reports as `RpcError` with `code: "http_error"`

Cause: `decodeWasmArgs` caps decoded args at 50 MiB as a memory guard. The gateway caps the whole `/rpc` request body at 23,418,197 bytes (about 22.3 MiB), and hex doubles the size, so an inline argument has to stay under about 11 MiB of JSON.

Fixes:

- inspect the JSON object you passed to `encodeWasmArgs(...)`; typical Twitter follower policies use about 100 bytes
- there is no route for larger data: the gateway rejects `proofCid` (section 1)

## 16. Gateway response body exceeds 1 MiB

Symptoms:

- `sdk.task.createTask(...)` or any `sdk.gateway.*` call rejects with "Response body exceeds maximum allowed size"

Cause: the gateway returned a JSON-RPC response larger than the SDK's 1 MiB body cap. The cap is enforced by streaming the response and aborting via `reader.cancel()` once the byte counter exceeds the limit.

Fixes:

- a normal JSON-RPC response is well under 1 MiB; an oversized response usually means the gateway is returning unexpected content (HTML error page from a misconfigured proxy, debug dumps, etc.)
- check `curl -i ${GATEWAY_URL}/rpc` directly to see the raw response size and content type
- if the gateway is behind an HTTPS terminator, confirm it is not interpolating its own error pages into successful responses

## 17. `Proof store failed: HTTP 404` or `Proof retrieve failed: HTTP 404`

Cause: `ProofClient` sends `/v1/proof/store` and `/v1/proof/<cid>` to `attesterUrl`, or to the gateway URL without `/rpc` when `attesterUrl` is unset. The current Newton gateway serves only `/health`, `/objects/:cid`, `/rpc` and `/ws`, so it answers these paths with 404.

Fix: set `attesterUrl` to the service that stores proofs.

## 18. `gateway <method> returned <status> [<code>] <detail>`

When the gateway answers with an error, `sdk.gateway.*` calls and `sdk.task.createTask(...)` or `sendTask(...)` throw `RpcError` with this message. `status` is the HTTP status, `code` is the gateway's error variant (`InvalidRequest`, `RateLimitExceeded`, `QuorumNotReached`, and so on), and `data` holds the variant's payload. `InvalidRequest` with `Invalid request format: ...` means `params` does not match the method's request type, for example an array where the gateway expects an object.

`code: "http_error"` means the response had no JSON-RPC error body:

- 401 with an empty body: the API key is unknown (section 4)
- 503 with an empty body: the gateway could not check the API key
- 408: the request outlasted the gateway's `server.request_timeout` (30 seconds in its sample `gateway.toml`); use `sdk.task.sendTask(...)` and track the task over `/ws` instead of waiting on `createTask`
- 400, 415 or 422 with a plain-text body: the gateway could not read the request; for a hand-built request, check that `id` is a UUID or null

## 19. `cannot track task <topic> at <url>: an API key is required`

The same prefix also ends in `the API key holds characters a WebSocket subprotocol cannot carry`.

Cause: `/ws` takes the API key as a `newton.bearer.<key>` subprotocol, so `trackTask` needs `apiKey` in the SDK config, and the key may hold only letters, digits and HTTP token punctuation such as `-`, `_` and `.`. The message never includes the key.

Fix: pass `apiKey` to `createNewtonSDK(...)`.

If `trackTask` fails with `Task tracking WebSocket error: ...` or `WebSocket closed: ...` before any update arrives, the gateway may have refused the upgrade. A gateway build that reads the API key only from the `Authorization` or `X-API-Key` header answers it with 401 `missing or invalid API key`; subprotocol auth needs a gateway that reads `newton.bearer.<key>`. The old `?api_key=` and `?topic=` query parameters do nothing: the gateway ignores `api_key` in the query and takes the topic from the subscribe frame.

## 20. `task <topic> subscription failed: <message>`

Cause: the gateway sent an `error` frame on `/ws`, and `<message>` is its text.

Checks:

- the topic must be the `subscription_topic` from `newt_sendTask`: the task id as bare lowercase hex, without `0x`
- `trackTask` resolves on the first `update` whose `data.status` is `success`, `failed` or `timeout`; the gateway sends no separate success or failure event
