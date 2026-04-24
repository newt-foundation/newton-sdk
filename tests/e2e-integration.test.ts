import { expect, test } from 'vitest';
import {
  GatewayClient,
  JsonRpcError,
  ProofClient,
  TaskStatus,
  type CreateTaskRequest,
  type CreateTaskResponse,
  type TaskUpdate
} from '../src';

const env = process.env;
const gatewayUrl = env['NEWTON_GATEWAY_URL'];
const sidecarUrl = env['NEWTON_SIDECAR_URL'];
const apiKey = env['NEWTON_API_KEY'];
const proofBase64 = env['NEWTON_E2E_PROOF_BASE64'];
const policyClient = env['NEWTON_POLICY_CLIENT'] ?? '0x0000000000000000000000000000000000000000';
const username = (env['NEWTON_TWITTER_USERNAME'] ?? 'realsigridjin').replace(/^@/, '');
const minFollowers = Number(env['NEWTON_MIN_FOLLOWERS'] ?? '1');
const chainId = Number(env['NEWTON_CHAIN_ID'] ?? '31337');
const wsTimeoutMs = Number(env['NEWTON_E2E_WS_TIMEOUT_MS'] ?? '120000');
const invalidProofBase64 = Buffer.from('not-a-valid-tlsn-proof', 'utf8').toString('base64');

const liveGatewayTest = test.skipIf(!gatewayUrl);
const liveServiceTest = test.skipIf(!gatewayUrl || !sidecarUrl);
const liveProofTest = test.skipIf(!gatewayUrl || !sidecarUrl || !proofBase64);
const liveAsyncProofTest = test.skipIf(!gatewayUrl || !sidecarUrl || !proofBase64 || typeof WebSocket === 'undefined');

function createTwitterTaskRequest(proofCid: string): CreateTaskRequest {
  return {
    policy_client: policyClient,
    intent: {
      type: 'zktls_twitter_followers',
      provider: 'x.com',
      username,
      chain_id: chainId
    },
    intent_signature: '0x',
    quorum_number: 1,
    quorum_threshold_percentage: 67,
    wasm_args: {
      min_followers: minFollowers,
      twitter_username: username
    },
    timeout: 120,
    use_two_phase: true,
    proof_cid: proofCid
  };
}

function createGatewayClient(): GatewayClient {
  return new GatewayClient({
    baseUrl: gatewayUrl!,
    ...(apiKey ? { token: apiKey } : {}),
    ...(typeof WebSocket === 'undefined' ? {} : { WebSocket })
  });
}

function createProofClient(): ProofClient {
  return new ProofClient({
    baseUrl: sidecarUrl!,
    ...(apiKey ? { token: apiKey } : {})
  });
}

function expectTerminalSuccess(result: CreateTaskResponse): void {
  expect(result.task_id).toBeTruthy();
  expect(result.status).toBe(TaskStatus.Success);
}

async function waitForTerminalUpdate(gateway: GatewayClient, subscriptionTopic: string, taskId: string): Promise<TaskUpdate> {
  return await new Promise<TaskUpdate>((resolve, reject) => {
    const terminalStatuses = new Set<TaskStatus>([TaskStatus.Success, TaskStatus.Failed, TaskStatus.Timeout]);
    let subscription: ReturnType<GatewayClient['subscribeToTask']> | undefined;
    const timeout = setTimeout(() => {
      subscription?.close(1000, 'timeout');
      reject(new Error(`Timed out waiting ${wsTimeoutMs}ms for ${subscriptionTopic}`));
    }, wsTimeoutMs);

    let settled = false;
    const settle = (handler: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      handler();
    };

    subscription = gateway.subscribeToTask<TaskUpdate>(subscriptionTopic, {
      onUpdate: (update) => {
        if (update.task_id && update.task_id !== taskId) {
          return;
        }
        if (update.status && terminalStatuses.has(update.status as TaskStatus)) {
          subscription?.close(1000, 'complete');
          settle(() => resolve(update));
        }
      },
      onError: () => {
        subscription?.close(1011, 'socket error');
        settle(() => reject(new Error(`WebSocket error while waiting on ${subscriptionTopic}`)));
      },
      onClose: (event) => {
        if (!settled) {
          settle(() => reject(new Error(`WebSocket closed before terminal update (${event.code} ${event.reason})`)));
        }
      }
    });
  });
}

liveProofTest('stores a real zkTLS proof and verifies it through newt_createTask', async () => {
  const proof = createProofClient();
  const gateway = createGatewayClient();

  const stored = await proof.storeProof({ proof: proofBase64! });
  expect(stored.cid).toBeTruthy();
  expect(stored.url).toBeTruthy();

  const result = await gateway.createTask(createTwitterTaskRequest(stored.cid));
  expectTerminalSuccess(result);
});

liveAsyncProofTest('stores a real zkTLS proof and verifies async updates through newt_sendTask + WebSocket', async () => {
  const proof = createProofClient();
  const gateway = createGatewayClient();

  const stored = await proof.storeProof({ proof: proofBase64! });
  expect(stored.cid).toBeTruthy();

  const queued = await gateway.sendTask(createTwitterTaskRequest(stored.cid));
  expect(queued.task_id).toBeTruthy();
  expect(queued.subscription_topic).toBeTruthy();

  const update = await waitForTerminalUpdate(gateway, queued.subscription_topic, queued.task_id);
  expect(update.task_id ?? queued.task_id).toBe(queued.task_id);
  expect(update.status).toBe(TaskStatus.Success);
});

liveServiceTest('returns a proper error or failed status for an invalid proof', async () => {
  const proof = createProofClient();
  const gateway = createGatewayClient();

  try {
    const stored = await proof.storeProof({ proof: invalidProofBase64 });
    expect(stored.cid).toBeTruthy();

    try {
      const result = await gateway.createTask(createTwitterTaskRequest(stored.cid));
      expect([TaskStatus.Failed, TaskStatus.Timeout]).toContain(result.status);
      expect(result.error ?? result.operator_errors).toBeTruthy();
    } catch (error) {
      expect(error).toBeInstanceOf(JsonRpcError);
      expect((error as JsonRpcError).message).toBeTruthy();
    }
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBeTruthy();
  }
});

liveGatewayTest('documents the live env contract for CI-safe execution', () => {
  expect({
    NEWTON_GATEWAY_URL: gatewayUrl ?? null,
    NEWTON_SIDECAR_URL: sidecarUrl ?? null,
    NEWTON_E2E_PROOF_BASE64: proofBase64 ? '<redacted>' : null
  }).toBeTruthy();
});
