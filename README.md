# @newton-protocol/sdk

TypeScript SDK for Newton Protocol zkTLS.

- `GatewayClient` — JSON-RPC task submission
- `AttesterClient` — TLSNotary attester WebSocket sessions
- `ProofClient` — proof storage / retrieval
- `NewtonClient` — proof → task lifecycle wrapper

## Install

```bash
npm install @newton-protocol/sdk
```

For local development from the extension demo:

```json
{
  "dependencies": {
    "@newton-protocol/sdk": "file:../../../newton-sdk"
  }
}
```

## Quick start: submit a Twitter/X zkTLS proof CID

```ts
import { GatewayClient } from '@newton-protocol/sdk';

const gateway = new GatewayClient({
  baseUrl: 'http://localhost:8080',
  token: process.env.NEWTON_API_KEY,
});

const result = await gateway.createTask({
  policy_client: '0x1111111111111111111111111111111111111111',
  intent: {
    type: 'zktls_twitter_followers',
    provider: 'x.com',
    username: 'realsigridjin',
    chain_id: 31337,
  },
  intent_signature: '0x',
  quorum_number: 1,
  quorum_threshold_percentage: 67,
  wasm_args: {
    min_followers: 1000,
    twitter_username: 'realsigridjin',
  },
  timeout: 60,
  use_two_phase: true,
  proof_cid: 'bafy...',
});

console.log(result.status, result.task_id);
```

## Full flow: proof → store → task

```ts
import { NewtonClient } from '@newton-protocol/sdk';

const newton = new NewtonClient({
  gateway: { baseUrl: 'http://localhost:8080', token: process.env.NEWTON_API_KEY },
  proof: { baseUrl: 'http://localhost:7047', token: process.env.NEWTON_API_KEY },
});

const lifecycle = await newton.submitTaskWithProof({
  proof: 'BASE64_BCS_TLSNOTARY_PRESENTATION',
  task: {
    policy_client: '0x1111111111111111111111111111111111111111',
    intent: { type: 'zktls_twitter_followers', username: 'realsigridjin' },
    intent_signature: '0x',
    quorum_number: 1,
    quorum_threshold_percentage: 67,
    wasm_args: { min_followers: 1000, twitter_username: 'realsigridjin' },
    use_two_phase: true,
  },
});

console.log(lifecycle.proof.cid);
console.log(lifecycle.task.status);
```

## API reference

### `GatewayClient`

```ts
new GatewayClient({
  baseUrl: 'https://gateway.example',
  token?: 'gateway-token',
  rpcPath?: '/rpc',
  websocketUrl?: 'wss://gateway.example/ws',
  timeoutMs?: 30_000,
  fetch?: customFetch,
  WebSocket?: CustomWebSocket,
})
```

Methods:

- `request(method, params?, options?)` — low-level JSON-RPC call.
- `createTask(request, options?)` — calls `newt_createTask`.
- `sendTask(request, options?)` — calls `newt_sendTask`.
- `simulateTask(request, options?)` — calls `newt_simulateTask`.
- `simulatePolicy(request, options?)` — calls `newt_simulatePolicy`.
- `subscribeToTask(topic, options?)` — opens a WebSocket task subscription.

### `ProofClient`

```ts
new ProofClient({
  baseUrl: 'https://sidecar.example',
  token?: 'sidecar-token',
  timeoutMs?: 30_000,
  fetch?: customFetch,
})
```

Methods:

- `storeProof({ proof })` — `POST /v1/proof/store`, returns `{ cid, url }`.
- `getProof(cid)` — returns proof bytes.
- `getProofBase64(cid)` — returns proof bytes as base64.

### `AttesterClient`

```ts
new AttesterClient({
  baseUrl: 'http://localhost:7047',
  token?: 'sidecar-token',
  WebSocket?: CustomWebSocket,
})
```

Methods:

- `createSession({ max_recv_data, max_sent_data })` — creates an MPC-TLS session.
- `connectVerifier({ session_id })` — connects to verifier WebSocket.
- `connectProxy({ host, port, protocol })` — connects to proxy WebSocket.
- `sendRevealConfig(socket, config)` — sends reveal ranges to the verifier.

### `NewtonClient`

Methods:

- `createSession(request, options?)`
- `storeProof(proof)`
- `createTask(request)`
- `sendTask(request)`
- `submitTaskWithProof({ proof, task, async?, session? })`
- `subscribeToLifecycleResult(result, options?)`

## Error handling

The SDK throws typed errors:

- `HttpRequestError` for non-2xx HTTP responses.
- `JsonRpcError` for JSON-RPC error payloads.
- `TimeoutError` for request timeouts.
- `NewtonSdkError` for SDK configuration/runtime errors.

```ts
try {
  await gateway.createTask(task);
} catch (error) {
  if (error instanceof JsonRpcError) {
    console.error(error.code, error.message, error.data);
  } else {
    console.error(error);
  }
}
```

## Local verification

```bash
npm run typecheck
npm test
npm run build
```
