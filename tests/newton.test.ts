import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NewtonClient, NewtonSdkError, TaskStatus } from '../src';
import { jsonResponse, MockWebSocket, mockWebSocketConstructor } from './helpers';

describe('NewtonClient', () => {
  beforeEach(() => MockWebSocket.reset());

  it('stores proof, submits async task with proof_cid, and subscribes to result topic', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/v1/proof/store')) {
        return jsonResponse({ cid: 'bafyproof', url: 'ipfs://bafyproof' });
      }
      if (url.endsWith('/rpc')) {
        const body = JSON.parse(init?.body as string) as { method: string; params: { proof_cid?: string } };
        expect(body.method).toBe('newt_sendTask');
        expect(body.params.proof_cid).toBe('bafyproof');
        return jsonResponse({
          jsonrpc: '2.0',
          id: 1,
          result: {
            task_id: 'task-1',
            subscription_topic: 'tasks.task-1',
            message: 'submitted',
            timestamp: 123
          }
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new NewtonClient({
      gateway: { baseUrl: 'https://gateway.example', fetch: fetchMock, WebSocket: mockWebSocketConstructor() },
      proof: { baseUrl: 'https://attester.example', fetch: fetchMock }
    });

    const result = await client.submitTaskWithProof({
      async: true,
      proof: 'YmNzLXByb29m',
      task: {
        policy_client: '0xpolicy',
        intent: 'transfer-if-policy-passes',
        intent_signature: '0xsig',
        quorum_number: 1,
        quorum_threshold_percentage: 67
      }
    });

    expect(result).toMatchObject({
      mode: 'async',
      proof: { cid: 'bafyproof' },
      task: { task_id: 'task-1', subscription_topic: 'tasks.task-1' }
    });

    const updates: unknown[] = [];
    client.subscribeToLifecycleResult(result, { onUpdate: (update) => updates.push(update) });
    MockWebSocket.instances[0]?.emitOpen();
    MockWebSocket.instances[0]?.emitMessage({ topic: 'tasks.task-1', task_id: 'task-1', status: TaskStatus.Success });

    expect(updates).toEqual([{ topic: 'tasks.task-1', task_id: 'task-1', status: TaskStatus.Success }]);
  });

  it('delegates createSession to the attester client', async () => {
    const client = new NewtonClient({
      gateway: { baseUrl: 'https://gateway.example', fetch: vi.fn(), WebSocket: mockWebSocketConstructor() },
      attester: { baseUrl: 'https://attester.example', token: 'att-tok', WebSocket: mockWebSocketConstructor() }
    });

    const pending = client.createSession({ max_recv_data: 4096, max_sent_data: 2048 });
    const socket = MockWebSocket.instances[0];
    socket?.emitOpen();
    socket?.emitMessage({ session_id: 'session-direct-1' });

    await expect(pending).resolves.toMatchObject({ session_id: 'session-direct-1' });
  });

  it('delegates storeProof to the proof client', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ cid: 'bafydirect', url: 'ipfs://bafydirect' }));
    const client = new NewtonClient({
      gateway: { baseUrl: 'https://gateway.example', fetch: fetchMock },
      proof: { baseUrl: 'https://sidecar.example', fetch: fetchMock }
    });

    const result = await client.storeProof('YmNzLXByb29m');
    expect(result).toEqual({ cid: 'bafydirect', url: 'ipfs://bafydirect' });
  });

  it('delegates createTask and sendTask to the gateway client', async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string) as { method: string; id: number };
      if (body.method === 'newt_createTask') {
        return jsonResponse({ jsonrpc: '2.0', id: body.id, result: { task_id: 't-sync', status: TaskStatus.Success, timestamp: 1 } });
      }
      if (body.method === 'newt_sendTask') {
        return jsonResponse({ jsonrpc: '2.0', id: body.id, result: { task_id: 't-async', subscription_topic: 'tasks.t-async', message: 'queued', timestamp: 2 } });
      }
      throw new Error(`Unexpected method: ${body.method}`);
    });

    const client = new NewtonClient({
      gateway: { baseUrl: 'https://gateway.example', fetch: fetchMock }
    });

    const task = { policy_client: '0xp', intent: 'test', intent_signature: '0x', quorum_number: 1, quorum_threshold_percentage: 67, proof_cid: 'bafy' };

    const syncResult = await client.createTask(task);
    expect(syncResult.task_id).toBe('t-sync');

    const asyncResult = await client.sendTask(task);
    expect(asyncResult.task_id).toBe('t-async');
    expect(asyncResult.subscription_topic).toBe('tasks.t-async');
  });

  it('throws when calling createSession without an attester client', () => {
    const client = new NewtonClient({
      gateway: { baseUrl: 'https://gateway.example', fetch: vi.fn() }
    });

    expect(() => client.createSession({ max_recv_data: 1024, max_sent_data: 512 })).toThrow(NewtonSdkError);
    expect(() => client.createSession({ max_recv_data: 1024, max_sent_data: 512 })).toThrow('Attester client is not configured');
  });

  it('throws when calling storeProof without a proof client', () => {
    const client = new NewtonClient({
      gateway: { baseUrl: 'https://gateway.example', fetch: vi.fn() }
    });

    expect(() => client.storeProof('YmNzLXByb29m')).toThrow(NewtonSdkError);
    expect(() => client.storeProof('YmNzLXByb29m')).toThrow('Proof client is not configured');
  });

  it('accepts pre-constructed client instances in constructor options', async () => {
    const { GatewayClient, ProofClient, AttesterClient } = await import('../src');

    const fetchMock = vi.fn(async () => jsonResponse({ cid: 'bafypre', url: 'ipfs://bafypre' }));
    const gateway = new GatewayClient({ baseUrl: 'https://gateway.example', fetch: fetchMock });
    const proof = new ProofClient({ baseUrl: 'https://sidecar.example', fetch: fetchMock });
    const attester = new AttesterClient({ baseUrl: 'https://attester.example', WebSocket: mockWebSocketConstructor() });

    const client = new NewtonClient({ gateway, proof, attester });

    expect(client.gateway).toBe(gateway);
    expect(client.proof).toBe(proof);
    expect(client.attester).toBe(attester);
  });
});
