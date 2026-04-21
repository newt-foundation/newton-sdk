import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NewtonClient, TaskStatus } from '../src';
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
});
