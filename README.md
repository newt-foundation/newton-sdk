# @newton-protocol/sdk

TypeScript SDK for Newton Protocol zkTLS services.

## Features

- `GatewayClient` for Newton JSON-RPC task submission
- `ProofClient` for proof storage and retrieval
- `AttesterClient` for TLSNotary verifier/proxy sessions
- `NewtonClient` for proof → task lifecycle orchestration
- Live-safe E2E coverage for `zktls_twitter_followers`

## Installation

```bash
npm install @newton-protocol/sdk
```

For local development from the demo repository:

```json
{
  "dependencies": {
    "@newton-protocol/sdk": "file:../../../newton-sdk"
  }
}
```

## Quick start: Twitter followers verification

```ts
import { NewtonClient, TaskStatus } from '@newton-protocol/sdk';

const client = new NewtonClient({
  gateway: {
    baseUrl: process.env.NEWTON_GATEWAY_URL ?? 'http://localhost:8080',
    token: process.env.NEWTON_API_KEY,
  },
  proof: {
    baseUrl: process.env.NEWTON_SIDECAR_URL ?? 'http://localhost:7047',
    token: process.env.NEWTON_API_KEY,
  },
});

const result = await client.submitTaskWithProof({
  proof: process.env.NEWTON_E2E_PROOF_BASE64!,
  task: {
    policy_client: process.env.NEWTON_POLICY_CLIENT ?? '0x0000000000000000000000000000000000000000',
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
    timeout: 120,
    use_two_phase: true,
  },
});

if (result.task.status !== TaskStatus.Success) {
  throw new Error(`Verification failed with status ${String(result.task.status)}`);
}

console.log(result.proof.cid);
console.log(result.task.task_id);
```

## Async flow with WebSocket subscription

```ts
import { NewtonClient, TaskStatus } from '@newton-protocol/sdk';

const client = new NewtonClient({
  gateway: {
    baseUrl: 'http://localhost:8080',
    token: process.env.NEWTON_API_KEY,
  },
  proof: {
    baseUrl: 'http://localhost:7047',
    token: process.env.NEWTON_API_KEY,
  },
});

const queued = await client.submitTaskWithProof({
  async: true,
  proof: process.env.NEWTON_E2E_PROOF_BASE64!,
  task: {
    policy_client: process.env.NEWTON_POLICY_CLIENT ?? '0x0000000000000000000000000000000000000000',
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
    timeout: 120,
    use_two_phase: true,
  },
});

client.subscribeToLifecycleResult(queued, {
  onUpdate: (update) => {
    if (update.status === TaskStatus.Success) {
      console.log('Task succeeded', update.task_id);
    }
  },
});
```

## Configuration

### `GatewayClient`

```ts
new GatewayClient({
  baseUrl: 'https://gateway.example',
  token?: 'gateway-token',
  rpcPath?: '/rpc',
  websocketUrl?: 'wss://gateway.example/ws',
  headers?: { 'x-trace-id': 'trace-123' },
  timeoutMs?: 30_000,
  fetch?: customFetch,
  WebSocket?: CustomWebSocket,
})
```

### `ProofClient`

```ts
new ProofClient({
  baseUrl: 'https://sidecar.example',
  token?: 'sidecar-token',
  headers?: { 'x-trace-id': 'trace-123' },
  timeoutMs?: 30_000,
  fetch?: customFetch,
})
```

### `AttesterClient`

```ts
new AttesterClient({
  baseUrl: 'http://localhost:7047',
  token?: 'sidecar-token',
  headers?: { 'x-trace-id': 'trace-123' },
  WebSocket?: CustomWebSocket,
})
```

### `NewtonClient`

```ts
new NewtonClient({
  gateway: { baseUrl: 'http://localhost:8080' },
  proof: { baseUrl: 'http://localhost:7047' },
  attester: { baseUrl: 'http://localhost:7047' }, // optional
})
```

### Recommended environment variables

| Variable | Purpose | Default |
| --- | --- | --- |
| `NEWTON_GATEWAY_URL` | Newton Gateway base URL | `http://localhost:8080` |
| `NEWTON_SIDECAR_URL` | Sidecar / verifier base URL | `http://localhost:7047` |
| `NEWTON_API_KEY` | Bearer token shared by Gateway / Sidecar when required | unset |
| `NEWTON_POLICY_CLIENT` | Policy contract / client identifier | `0x0000000000000000000000000000000000000000` |
| `NEWTON_TWITTER_USERNAME` | Username used in the Twitter followers scenario | `realsigridjin` |
| `NEWTON_MIN_FOLLOWERS` | Minimum follower threshold | `1000` |
| `NEWTON_CHAIN_ID` | Chain id included in the intent payload | `31337` |
| `NEWTON_E2E_PROOF_BASE64` | Base64-encoded zkTLS proof used for live E2E checks | unset |
| `NEWTON_E2E_WS_TIMEOUT_MS` | Async E2E WebSocket wait timeout | `120000` |

## API reference

### `GatewayClient`

- `request(method, params?, options?)` — low-level JSON-RPC call.
- `createTask(request, options?)` — calls `newt_createTask`.
- `sendTask(request, options?)` — calls `newt_sendTask`.
- `simulateTask(request, options?)` — calls `newt_simulateTask`.
- `simulatePolicy(request, options?)` — calls `newt_simulatePolicy`.
- `storeEncryptedSecrets(params, options?)` — calls `newt_storeEncryptedSecrets`.
- `simulatePolicyData(params, options?)` — calls `newt_simulatePolicyData`.
- `simulatePolicyDataWithClient(params, options?)` — calls `newt_simulatePolicyDataWithClient`.
- `registerWebhook(request, options?)` / `unregisterWebhook(request, options?)`
- `subscribeToTask(topic, options?)` — opens a task subscription WebSocket.

### `ProofClient`

- `storeProof({ proof })` — `POST /v1/proof/store`, returns `{ cid, url }`.
- `getProof(cid)` — retrieves raw proof bytes.
- `getProofBase64(cid)` — retrieves proof bytes and returns base64.

### `AttesterClient`

- `createSession({ max_recv_data, max_sent_data }, options?)`
- `connectVerifier({ session_id })`
- `connectProxy({ host, port, protocol })`
- `sendRevealConfig(socket, config)`

### `NewtonClient`

- `createSession(request, options?)`
- `storeProof(proof)`
- `createTask(request)`
- `sendTask(request)`
- `submitTaskWithProof({ proof, task, async?, session?, sessionOptions? })`
- `subscribeToTask(topic, options?)`
- `subscribeToLifecycleResult(result, options?)`

## Error handling patterns

The SDK throws typed errors so app code can distinguish transport failures from Gateway-side failures.

```ts
import { GatewayClient, HttpRequestError, JsonRpcError, TimeoutError } from '@newton-protocol/sdk';

const gateway = new GatewayClient({
  baseUrl: process.env.NEWTON_GATEWAY_URL ?? 'http://localhost:8080',
  token: process.env.NEWTON_API_KEY,
  timeoutMs: 15_000,
});

try {
  await gateway.createTask({
    policy_client: process.env.NEWTON_POLICY_CLIENT ?? '0x0000000000000000000000000000000000000000',
    intent: { type: 'zktls_twitter_followers', username: 'realsigridjin', chain_id: 31337 },
    intent_signature: '0x',
    quorum_number: 1,
    quorum_threshold_percentage: 67,
    proof_cid: 'bafy...',
  });
} catch (error) {
  if (error instanceof JsonRpcError) {
    console.error('Gateway rejected the task', error.code, error.message, error.data);
  } else if (error instanceof HttpRequestError) {
    console.error('HTTP failure', error.status, error.statusText, error.body);
  } else if (error instanceof TimeoutError) {
    console.error('Request timed out');
  } else {
    console.error('Unexpected failure', error);
  }
}
```

## E2E testing

### SDK live integration test

`tests/e2e-integration.test.ts` runs against real Newton services when env vars are present and is skipped otherwise.

```bash
export NEWTON_GATEWAY_URL=http://localhost:8080
export NEWTON_SIDECAR_URL=http://localhost:7047
export NEWTON_API_KEY=...
export NEWTON_POLICY_CLIENT=0x...
export NEWTON_E2E_PROOF_BASE64=...

npm run test:e2e
```

What it covers:

- proof store → `newt_createTask`
- proof store → `newt_sendTask` + WebSocket subscription
- invalid-proof failure handling

### Demo E2E check

The sibling demo package includes a CLI smoke check at `../newton-tlsn-extension-demo/packages/demo/scripts/e2e-check.ts`.

```bash
cd ../newton-tlsn-extension-demo/packages/demo
NEWTON_E2E_PROOF_BASE64=... npm run e2e:check
```

Use `npm run e2e:check -- --help` to print the supported environment variables.

## Local verification

```bash
npm run typecheck
npm test
npm run test:e2e
npm run build
```
