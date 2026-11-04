# Newton zkTLS Twitter/X Demo

A Vite + React demo for the Newton TypeScript SDK Twitter follower zkTLS flow.

## Flow

1. Run system checks for browser support, gateway health, and attester/sidecar health.
2. Create an MPC-TLS session with the attester sidecar and ask the TLSNotary browser extension to prove the Twitter/X follower endpoint via the sidecar proxy for `api.x.com`.
3. Store the resulting proof bytes through the SDK proof client and retain the returned IPFS CID.
4. Submit a `newt_createTask` request through the SDK task manager with:
   - `proofCid`, which the current gateway rejects with HTTP 400 `InvalidRequest` `proof_cid is unsupported; zkTLS proof verification is unavailable`, so this step shows that error today
   - `wasmArgs`: one hex-encoded `{ min_followers, twitter_username }` entry for the Twitter follower policy
5. Render allow/deny, follower count, threshold, and policy check details from the task response.

## Configuration

```bash
VITE_SIDECAR_URL=http://localhost:7047
VITE_GATEWAY_URL=http://localhost:8080
VITE_NEWTON_API_KEY=your_newton_api_key
```

Without an API key the gateway answers `/rpc` with HTTP 401 `AuthenticationFailed`; an unknown key gets an empty HTTP 401.

Optional values for local demos:

```bash
VITE_POLICY_CLIENT=0x1111111111111111111111111111111111111111
VITE_INTENT_FROM=0x2222222222222222222222222222222222222222
VITE_INTENT_TO=0x3333333333333333333333333333333333333333
```

## Commands

The repository uses pnpm as the package manager (see `pnpm-lock.yaml`).

```bash
pnpm install
pnpm dev
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```
