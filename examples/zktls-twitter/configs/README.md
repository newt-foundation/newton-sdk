# zkTLS Twitter/X SDK Demo

This demo shows the SDK-facing request shape for a Twitter/X follower-count policy backed by a TLSNotary zkTLS proof.

It is intentionally scoped to **SDK + demo wiring**. The Rego policy is implemented in `newton-prover-avs` and is referenced by these client-side fixtures.

The current gateway does not verify zkTLS proofs. It rejects any `proof_cid` with InvalidRequest `proof_cid is unsupported; zkTLS proof verification is unavailable`, so a task built from these fixtures fails with that error.

## Files

| File | Purpose |
| --- | --- |
| `task.json` | Input for `newton-cli task submit-evaluation-request`; uses SDK-style camelCase fields, a `wasmArgs` array, and `proofCid`. |
| `create-task.json` | Raw JSON-RPC `newt_createTask` payload; `params` is an object with the gateway's snake_case fields, `wasm_args` is an array, and `proof_cid` is set. There is no `id`: the gateway assigns its own, and answers an `id` that is not a UUID with a 422. |
| `wasm-args.json` | Plain JSON before hex encoding into one `wasmArgs`/`wasm_args` entry. |
| Runtime policy | The operator-side `tlsn_twitter_followers.rego` policy lives in `newton-prover-avs`; this SDK example keeps only client payload fixtures. |

`wasm_args` holds one hex entry per policy in the client's policy set, in order; use `"0x"` for a policy that takes no arguments.

## Flow

1. A client/extension obtains a TLSNotary presentation for `api.x.com` or `api.twitter.com` and stores it in IPFS.
2. The SDK submits a task with the returned proof CID in `proofCid` (or `proof_cid`).
3. The current gateway rejects the task with InvalidRequest `proof_cid is unsupported; zkTLS proof verification is unavailable`. It also rejects `_newton.proof_cid` inside a `wasm_args` entry, so there is no other way to attach the proof.
4. The Twitter follower policy allows only when `input.data.tlsn_verified` is true and the server, proof freshness, and follower threshold checks pass, so it cannot allow until the gateway verifies proofs again.

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

The script still writes the old payload (`"id": 1`, a `params` array, a string `wasm_args`, `use_two_phase`), which the current gateway rejects before it reads `proof_cid`. `create-task.json` has the shape the gateway reads.

## Newton CLI

```bash
API_KEY="$API_KEY" DEPLOYMENT_ENV=stagef CHAIN_ID=11155111 \
  cargo run -p newton-cli -- \
  task submit-evaluation-request \
  --task-json examples/zktls-twitter/configs/task.json
```

`newton-cli` rejects a non-null `proofCid` or `proof_cid` with the same `proof_cid is unsupported` error before it sends anything. Without one, it sends `params` as a one-element array, which the current gateway cannot read into its request type, so this command does not work against the current gateway.
## First-time user tutorials

For a guided external-user onboarding path, see `../../../docs/zktls-twitter/README.md`.
