# @newton-protocol/zktls-twitter-example

Example-scoped TypeScript helpers for the Newton Protocol Twitter/X zkTLS tutorial.

> **Production SDK boundary:** this package lives under `examples/` and is a
> reference implementation for the Twitter/X zkTLS flow. Production integrations
> should use `@newton-xyz/sdk` for gateway RPC, task submission,
> identity, privacy, and secrets APIs, then compose only the zkTLS-specific pieces
> from this example (`AttesterClient`, `ProofClient`, and wasm-argument helpers)
> while the thin-extension path is developed.

## Installation

This package is not published to npm — it is reference code that lives in this
repository under `examples/zktls-twitter/sdk/`. To use it, clone the repo and
build locally:

```bash
git clone https://github.com/newt-foundation/newton-sdk.git
cd newton-sdk/examples/zktls-twitter/sdk
pnpm install
pnpm build
```

Then import directly from the relative path or via a workspace dependency. For
production integrations, use `@newton-xyz/sdk` instead.

## Quick Start

```typescript
import { createNewtonSDK } from "@newton-protocol/zktls-twitter-example";

const sdk = createNewtonSDK({
  gatewayUrl: "http://localhost:8080",
  attesterUrl: "http://localhost:7047",
  apiKey: "your-api-key",
});

// Submit a zkTLS task
const result = await sdk.task.createTask({
  policyClient: "0x1111111111111111111111111111111111111111",
  intent: {
    from: "0x2222222222222222222222222222222222222222",
    to: "0x3333333333333333333333333333333333333333",
    value: "0x0",
    data: "0x",
    chainId: "0xaa36a7",
    functionSignature: "0x",
  },
  proofCid: "bafybeig...", // rejected by the current gateway, see below
  wasmArgs: { min_followers: 1000, twitter_username: "newton_protocol" },
});

console.log(result.status); // "success" | "failed"
```

> **`proofCid` is rejected today.** The current gateway does not verify zkTLS
> proofs. It answers any `proofCid` with HTTP 400 `InvalidRequest`
> `proof_cid is unsupported; zkTLS proof verification is unavailable`, which
> `createTask` and `sendTask` throw as `RpcError`. The SDK still sends the field
> so that error reaches you. Without it, the Twitter/X follower policy denies,
> because it needs a verified proof.

## API Reference

### `createNewtonSDK(config)`

Factory function that returns an SDK instance with all four clients.

```typescript
interface NewtonSDKConfig {
  gatewayUrl: string;      // Gateway RPC endpoint (e.g. "http://localhost:8080")
  attesterUrl?: string;    // Attester endpoint (e.g. "http://localhost:7047")
  apiKey?: string;         // API key for authenticated endpoints
  timeout?: number;        // Default timeout in ms (default: 30000)
  chainId?: number;        // Default chain ID
}
```

Returns: `{ gateway, attester, proof, task }`

---

### GatewayClient

JSON-RPC client for the Newton gateway (`POST /rpc`). Wraps all `newt_*` methods.

#### Task Management

```typescript
// Synchronous — waits for BLS aggregation
const result = await sdk.gateway.createTask(request);

// Asynchronous — returns subscription topic for WebSocket tracking
const { task_id, subscription_topic } = await sdk.gateway.sendTask(request);

// Replay with pre-assembled policy data
const sim = await sdk.gateway.simulateTask(request);
```

#### Policy Simulation

```typescript
// Full policy evaluation with WASM pipeline
const result = await sdk.gateway.simulatePolicy({
  policyClient: "0x...",
  chainId: 84532,
  intent: { ... },
  wasmArgs: ["0x..."], // one entry per policy in the client's policy set
});

// Direct WASM execution (caller-provided secrets)
await sdk.gateway.simulatePolicyData({ ... });

// WASM execution with stored secrets
await sdk.gateway.simulatePolicyDataWithClient({ ... });
```

#### Secrets & Data

```typescript
await sdk.gateway.storeEncryptedSecrets({ ... });
await sdk.gateway.uploadIdentityEncrypted({ ... });
await sdk.gateway.getIdentityEncrypted({ dataRefId: "..." });
await sdk.gateway.uploadConfidentialData({ ... });
await sdk.gateway.getConfidentialData({ dataRefId: "..." });
```

#### Public Keys

```typescript
const { public_key: privacyKey } = await sdk.gateway.getPrivacyPublicKey();
const { public_key: secretsKey } = await sdk.gateway.getSecretsPublicKey();
```

#### Webhooks

```typescript
// The webhook belongs to the calling API key
await sdk.gateway.registerWebhook({ url: "https://...", failureTypes: ["quorum_not_reached"] });
await sdk.gateway.unregisterWebhook();
```

---

### AttesterClient

WebSocket client for MPC-TLS session management.

```typescript
// In Node.js, provide a WebSocket implementation
import WebSocket from "ws";
sdk.attester.setWebSocket(WebSocket);

// Create an MPC-TLS session
const session = await sdk.attester.createSession({
  maxRecvData: 16384,
  maxSentData: 4096,
});

console.log(session.sessionId);
console.log(session.verifierUrl);           // ws://localhost:7047/verifier?sessionId=...
console.log(session.proxyUrl("api.x.com:443")); // ws://localhost:7047/proxy?token=...

// After MPC-TLS completes, send reveal config and get results
const results = await sdk.attester.reveal(sessionWsUrl, {
  sent: [{ start: 0, end: 100, handler: { type: "SENT", part: "START_LINE" } }],
  recv: [{ start: 0, end: 2000, handler: { type: "RECV", part: "BODY" } }],
});
```

---

### ProofClient

IPFS proof storage and retrieval via the attester REST API.

`ProofClient` calls `/v1/proof/store` and `/v1/proof/<cid>` on `attesterUrl`, or
on the gateway URL without `/rpc` when `attesterUrl` is unset. The Newton gateway
has no `/v1/proof` route, so set `attesterUrl` to the service that stores proofs.

Today the demo stores the TLS proof on IPFS and passes the CID in `proofCid`. The
current gateway rejects `proofCid` (see Quick Start), so no task resolves that
CID during evaluation. The planned
identity-integrated flow will allow `newt_uploadIdentityEncrypted` to accept an
optional TLS proof so the gateway can verify authenticity before persisting
identity data. Once that lands, `ProofClient` should be optional standalone proof
archival tooling rather than a required task-submission step.

```typescript
// Store a proof (base64-encoded BCS bytes)
const { cid, url } = await sdk.proof.store("base64EncodedProofData==");

// Retrieve a proof by CID
const proofBytes: Uint8Array = await sdk.proof.retrieve(cid);
```

---

### TaskManager

High-level task lifecycle management.

```typescript
// Synchronous task creation
const result = await sdk.task.createTask({
  policyClient: "0x...",
  intent: { ... },
  wasmArgs: { min_followers: 1000 },  // Object auto-encoded to hex
  timeout: 60,
});

// Async send + WebSocket tracking. Tracking needs `apiKey` in the SDK config:
// /ws takes it as the `newton.bearer.<key>` subprotocol.
const response = await sdk.task.sendTask(options);
const finalEvent = await sdk.task.trackTask(
  response.subscription_topic,
  (event) => console.log(`Progress: ${event.data.progress}%`),
);

// Or combined: send + wait for completion
const event = await sdk.task.submitAndWait(options, onUpdate, timeoutMs);
```

**`wasmArgs`** holds one entry per policy in the client's policy set, in order.
Each entry is either:
- A hex string (`"0x7b22..."`), passed through as-is (`"0x"` for a policy without arguments)
- A plain object (`{ min_followers: 1000 }`), auto-encoded to hex

A single entry can be passed without the array; the SDK sends it as a one-entry
`wasm_args` list.

`trackTask` resolves on the first `update` whose `data.status` is `success`,
`failed` or `timeout`, and rejects on a gateway `error` frame.

---

## Utilities

```typescript
import { encodeWasmArgs, decodeWasmArgs } from "@newton-protocol/zktls-twitter-example";

// Encode JS object → 0x-prefixed hex JSON
const hex = encodeWasmArgs({ min_followers: 1000 });
// "0x7b226d696e5f666f6c6c6f77657273223a313030307d"

// Decode hex → JS object
const obj = decodeWasmArgs(hex);
// { min_followers: 1000 }
```

---

## Error Handling

```typescript
import { RpcError, TimeoutError, SessionError } from "@newton-protocol/zktls-twitter-example";

try {
  await sdk.task.createTask({ ... });
} catch (err) {
  if (err instanceof RpcError) {
    console.error(`RPC error ${err.code}: ${err.message}`);
    console.error("Details:", err.data);
  } else if (err instanceof TimeoutError) {
    console.error("Request timed out");
  } else if (err instanceof SessionError) {
    console.error("WebSocket session error:", err.message);
  }
}
```

---

## Example: zkTLS Twitter Follower Verification

Complete flow using the `tlsn_twitter_followers.rego` policy:

```typescript
import { createNewtonSDK, encodeWasmArgs } from "@newton-protocol/zktls-twitter-example";

const sdk = createNewtonSDK({
  gatewayUrl: "http://localhost:8080",
  attesterUrl: "http://localhost:7047",
  apiKey: process.env.NEWTON_API_KEY,
});

// 1. Store the TLSNotary proof on IPFS
const { cid } = await sdk.proof.store(base64ProofData);
console.log("Proof CID:", cid);

// 2. Submit task with proof CID. The current gateway rejects proofCid, so this
//    throws RpcError (see Quick Start).
const result = await sdk.task.createTask({
  policyClient: "0x1111111111111111111111111111111111111111",
  intent: {
    from: "0x2222222222222222222222222222222222222222",
    to: "0x3333333333333333333333333333333333333333",
    value: "0x0",
    data: "0x",
    chainId: "0xaa36a7",            // Sepolia
    functionSignature: "0x",
  },
  wasmArgs: {
    min_followers: 1000,
    twitter_username: "newton_protocol",
  },
  proofCid: cid,
  timeout: 60,
});

// 3. Check result. `status` says the task completed; the policy verdict is
//    `task_response.allowed`.
const allowed = (result.task_response as { allowed?: boolean } | undefined)?.allowed;
if (result.status === "success" && allowed) {
  console.log("Verification passed! Task ID:", result.task_id);
  console.log("Signature data:", result.signature_data);
} else {
  console.error("Verification failed:", result.error ?? "policy denied");
  for (const err of result.operator_errors ?? []) {
    console.error(`  Operator ${err.operator_address}: ${err.message}`);
  }
}
```

The policy evaluates:
- `tlsn_proof_valid` — WASM plugin verified the TLSNotary proof
- `correct_server` — TLS connection was to `api.x.com` or `api.twitter.com`
- `proof_is_fresh` — Proof age within `max_proof_age_secs` (default: 1 hour)
- `meets_follower_threshold` — `followers_count >= min_followers`

---

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `gatewayUrl` | (required) | Gateway JSON-RPC endpoint |
| `attesterUrl` | derived from gatewayUrl | Attester/Sidecar endpoint |
| `apiKey` | — | API key (`Authorization: Bearer` header for gateway and attester calls) |
| `timeout` | 30000 | Default request timeout in milliseconds |
| `chainId` | — | Default chain ID |

`AttesterClient` and `ProofClient` fall back to `gatewayUrl` without `/rpc`, but
the Newton gateway serves only `/health`, `/objects/:cid`, `/rpc` and `/ws`, so
set `attesterUrl`. `trackTask` and `submitAndWait` need `apiKey`: the SDK sends it
to `/ws` as the `newton.bearer.<key>` WebSocket subprotocol. A gateway that
reads the key only from the `Authorization` or `X-API-Key` header refuses that
upgrade with 401 `missing or invalid API key`.

## License

MIT
