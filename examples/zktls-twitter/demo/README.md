# Newton zkTLS Twitter/X Demo

A Vite + React demo for the Newton TypeScript SDK Twitter follower zkTLS flow.

## Flow

1. Run system checks for browser support, gateway health, and attester/sidecar health.
2. Create an MPC-TLS session with the attester sidecar and ask the TLSNotary browser extension to prove the Twitter/X follower endpoint via the sidecar proxy for `api.x.com`.
3. Store the resulting proof bytes through the SDK proof client and retain the returned IPFS CID.
4. Submit a `newt_createTask` request through the SDK task manager with:
   - `proofCid`
   - `wasmArgs: { min_followers, twitter_username }`
   - `useTwoPhase: true`
5. Render allow/deny, follower count, threshold, and policy check details from the task response.

## Configuration

```bash
VITE_SIDECAR_URL=http://localhost:7047
VITE_GATEWAY_URL=http://localhost:8080
```

Optional values for local demos:

```bash
VITE_POLICY_CLIENT=0x1111111111111111111111111111111111111111
VITE_INTENT_FROM=0x2222222222222222222222222222222222222222
VITE_INTENT_TO=0x3333333333333333333333333333333333333333
```

## Commands

```bash
npm install
npm run dev
npm run test
npm run typecheck
npm run lint
npm run build
```
