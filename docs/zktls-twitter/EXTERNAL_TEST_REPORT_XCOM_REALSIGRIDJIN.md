# External-user zkTLS Test Report: x.com/realsigridjin

Target: `https://x.com/realsigridjin`
Mode: safe public/no-auth validation. No cookies, bearer tokens, or user credentials were supplied or logged.

## Exact steps executed

### 1. Tutorial fixture validation

```bash
./scripts/zktls-tutorial-doctor.sh
```

Result: passed.

### 2. Build Newton task payload for the real target handle

```bash
scripts/zktls-twitter-sdk-demo.sh \
  --policy-client 0x1111111111111111111111111111111111111111 \
  --from 0x2222222222222222222222222222222222222222 \
  --to 0x3333333333333333333333333333333333333333 \
  --proof-cid bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi \
  --twitter-username realsigridjin \
  | tee /tmp/newton-zktls-realsigridjin-payload.json \
  | python3 -m json.tool >/tmp/newton-zktls-realsigridjin-payload.pretty.json
```

Result: passed. Payload was valid JSON and included `proof_cid`, `use_two_phase`, and hex-encoded `wasm_args` with `twitter_username = realsigridjin`.

### 3. Public target probe without credentials

```bash
curl -L --max-time 20 --connect-timeout 10 \
  -A 'Mozilla/5.0 (Newton zkTLS tutorial validation; no auth)' \
  -D /tmp/x-realsigridjin.headers \
  -o /tmp/x-realsigridjin.body \
  -w 'final_url=%{url_effective}\nhttp_code=%{http_code}\ncontent_type=%{content_type}\nsize_download=%{size_download}\n' \
  'https://x.com/realsigridjin'
```

Observed:

```text
final_url=https://x.com/realsigridjin
http_code=200
content_type=text/html; charset=utf-8
size_download=252606
```

Safe body marker scan found the response was an x.com HTML shell; it did not expose follower count in static HTML.

### 4. Local Docker Compose stack attempt

```bash
docker compose -f bin/deploy/docker-compose.gateway-local.yml up -d postgres redis anvil anvil-dest
```

Result: failed before gateway/operator startup because host port `5432` was already allocated:

```text
Bind for 127.0.0.1:5432 failed: port is already allocated
```

### 5. Manual real TLSNotary probe against x.com

A temporary ignored integration test was created locally and then removed. It called the existing real-TLS helper with:

```rust
notarize_real_server(
    "x.com",
    443,
    "x.com",
    "/realsigridjin",
    MAX_SENT_DATA,
    1 << 20,
)
```

Observed before manual timeout/kill:

```text
Sending MPC-TLS request to x.com/realsigridjin
Got response: 200 OK
MPC-TLS handshake + HTTP request took 9.244581521s
Sent 218 bytes, received 264574 bytes
```

The presentation/verification step did not complete within the manual test window and was stopped after it exceeded 60 seconds.

### 6. Extension demo reference review

Cloned and reviewed `newt-foundation/newton-tlsn-extension-demo`. Key finding: the external-user proof-generation UX belongs in the browser extension/plugin flow, not in this repo's CLI-only payload builder.

## Stage results

| Stage | Result | Evidence |
| --- | --- | --- |
| Public x.com access | PASS | HTTP 200 from `https://x.com/realsigridjin` without credentials |
| Proof generation | PARTIAL | MPC-TLS reached x.com and received 200 OK; final presentation artifact did not complete in manual window |
| Proof store | BLOCKED | No completed presentation artifact; sidecar/IPFS path not running |
| Task create | PASS for dry-run, BLOCKED for live local | Valid JSON payload generated; local gateway unavailable due Docker port 5432 conflict |
| Verification result | BLOCKED | Requires stored proof CID, local/testnet gateway, operators, and trusted notary key |

## Concrete blockers and fixes

1. **Static x.com profile HTML does not expose follower count**
   - Fix: use the extension demo to capture the authenticated/public API request that contains needed fields, then reveal only policy-required JSON fields.

2. **CLI path assumes proof CID already exists**
   - Fix: tutorial now explicitly positions `newton-tlsn-extension-demo` as the proof-generation UX and this repo as the gateway/operator/task UX.

3. **Local Compose failed on port 5432**
   - Fix: tutorial doctor now checks common port collisions before users start Docker Compose.

4. **Fresh local Compose expects `bin/deploy/.env.local`**
   - Fix: added `bin/deploy/.env.local.example` and tutorial copy step.

5. **Local stack chain ID differs from default script chain ID**
   - Fix: local walkthrough and cookbook now pass `--chain-id 31337`.

## Tutorial artifact summary

Use this as the current external-user story:

1. Run `./scripts/zktls-tutorial-doctor.sh`.
2. Use `newton-tlsn-extension-demo` to generate a real x.com proof and store it through the sidecar to get a CID.
3. Copy the CID into `scripts/zktls-twitter-sdk-demo.sh --proof-cid <CID> --twitter-username realsigridjin`.
4. Submit to a configured Newton gateway.
5. Operators verify the TLSNotary proof and evaluate the `tlsn_twitter_followers.rego` policy in `newton-prover-avs`.
