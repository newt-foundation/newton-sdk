# zkTLS Twitter/X SDK Demo

This demo shows the SDK-facing request shape for a Twitter/X follower-count policy backed by a TLSNotary zkTLS proof.

It is intentionally scoped to **SDK + demo wiring**. The cryptographic verifier, operator TLS proof fetch, gateway `proof_cid` injection, and Rego policies are implemented in `newton-prover-avs` and are referenced by these client-side fixtures.

## Files

| File | Purpose |
| --- | --- |
| `task.json` | Input for `newton-cli task submit-evaluation-request`; uses SDK-style camelCase fields and `proofCid`. |
| `create-task.json` | Raw JSON-RPC `newt_createTask` payload; uses gateway canonical snake_case fields and `proof_cid`. |
| `wasm-args.json` | Plain JSON before hex encoding into `wasmArgs`/`wasm_args`. |
| Runtime policy | The operator-side `tlsn_twitter_followers.rego` policy lives in `newton-prover-avs`; this SDK example keeps only client payload fixtures. |

## Flow

1. A client/extension obtains a TLSNotary presentation for `api.x.com` or `api.twitter.com` and stores it in IPFS.
2. The SDK submits a task with the returned proof CID in `proofCid` (or `proof_cid`).
3. The gateway injects the CID into `wasmArgs._newton.proof_cid` for compatibility and forwards it through the task pipeline.
4. Operators fetch the presentation from IPFS, verify it with the configured trusted TLSNotary key, and bind verified data to policy evaluation.
5. The Twitter follower policy checks the verified server, proof freshness, and follower threshold.

## CLI dry run

Generate the JSON-RPC request without submitting it:

```bash
./scripts/zktls-twitter-sdk-demo.sh \
  --policy-client 0x1111111111111111111111111111111111111111 \
  --from 0x2222222222222222222222222222222222222222 \
  --to 0x3333333333333333333333333333333333333333 \
  --proof-cid bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi
```

Submit to a running gateway by adding `--submit --gateway-url http://127.0.0.1:8080/rpc --api-key "$API_KEY"`.

## Newton CLI

```bash
API_KEY="$API_KEY" DEPLOYMENT_ENV=stagef CHAIN_ID=11155111 \
  cargo run -p newton-cli -- \
  task submit-evaluation-request \
  --task-json examples/zktls-twitter/configs/task.json
```

`newton-cli` accepts both `proofCid` and `proof_cid` in task JSON and rejects conflicting values.
## First-time user tutorials

For a guided external-user onboarding path, see `../../../docs/zktls-twitter/README.md`.
