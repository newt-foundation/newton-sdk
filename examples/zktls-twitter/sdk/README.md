# @newton-protocol/zktls-twitter-example

Example-scoped TypeScript helpers for the Newton Protocol Twitter/X zkTLS tutorial.

> **Production SDK boundary:** this package lives under `examples/` and is a
> reference implementation for the Twitter/X zkTLS flow. Production integrations
> should use `@magicnewton/newton-protocol-sdk` for gateway RPC, task submission,
> identity, privacy, and secrets APIs, then compose only the zkTLS-specific pieces
> from this example (`AttesterClient`, `ProofClient`, and wasm-argument helpers)
> while the thin-extension path is developed.

## Installation

```bash
npm install @newton-protocol/zktls-twitter-example
```

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
  proofCid: "bafybeig...",
  wasmArgs: { min_followers: 1000, twitter_username: "newton_protocol" },
  useTwoPhase: true,
});

console.log(result.status); // "success" | "failed"
```

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
const { taskId, subscriptionTopic } = await sdk.gateway.sendTask(request);

// Replay with pre-assembled policy data
const sim = await sdk.gateway.simulateTask(request);
```

#### Policy Simulation

```typescript
// Full policy evaluation with WASM pipeline
const result = await sdk.gateway.simulatePolicy({
  policyClient: "0x...",
  chainId: 84532,
  policy: "package trading\nallow if { ... }",
  intent: { ... },
  policyData: [{ policyDataAddress: "0x...", wasmArgs: "0x..." }],
  policyParams: { max_limit: 100000 },
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
const { publicKey } = await sdk.gateway.getPrivacyPublicKey();
const { publicKey } = await sdk.gateway.getSecretsPublicKey();
```

#### Webhooks

```typescript
await sdk.gateway.registerWebhook({ url: "https://...", policyClient: "0x..." });
await sdk.gateway.unregisterWebhook({ webhookId: "..." });
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

Today the demo stores the TLS proof on IPFS, passes the CID in `proofCid`, and
lets the task flow resolve that CID during evaluation. The planned
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
  proofCid: "bafy...",
  useTwoPhase: true,
  timeout: 60,
});

// Async send + WebSocket tracking
const response = await sdk.task.sendTask(options);
const finalEvent = await sdk.task.trackTask(
  response.subscriptionTopic,
  (event) => console.log(`Progress: ${event.data.progress}%`),
);

// Or combined: send + wait for completion
const event = await sdk.task.submitAndWait(options, onUpdate, timeoutMs);
```

**`wasmArgs`** can be either:
- A hex string (`"0x7b22..."`) — passed through as-is
- A plain object (`{ min_followers: 1000 }`) — auto-encoded to hex

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
import { JsonRpcError_, TimeoutError, SessionError } from "@newton-protocol/zktls-twitter-example";

try {
  await sdk.task.createTask({ ... });
} catch (err) {
  if (err instanceof JsonRpcError_) {
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

// 2. Submit task with proof CID
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
  useTwoPhase: true,
  proofCid: cid,
  timeout: 60,
});

// 3. Check result
if (result.status === "success") {
  console.log("Verification passed! Task ID:", result.taskId);
  console.log("Signature data:", result.signatureData);
} else {
  console.error("Verification failed:", result.error);
  if (result.operatorErrors) {
    for (const err of result.operatorErrors) {
      console.error(`  Operator ${err.operatorAddress}: ${err.error}`);
    }
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

## License

MIT
