import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GatewayClient, JsonRpcError, TaskStatus, type CreateTaskRequest } from '../src';
import { jsonResponse, MockWebSocket, mockWebSocketConstructor } from './helpers';

describe('GatewayClient', () => {
  beforeEach(() => MockWebSocket.reset());

  const taskRequest: CreateTaskRequest = {
    policy_client: '0xpolicy',
    intent: { action: 'verify-twitter' },
    intent_signature: '0xsig',
    quorum_number: 1,
    quorum_threshold_percentage: 67,
    proof_cid: 'bafyproof'
  };

  it('calls JSON-RPC /rpc with bearer auth for newt_createTask', async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, _init?: RequestInit): Promise<Response> =>
      jsonResponse({
        jsonrpc: '2.0',
        id: 1,
        result: {
          task_id: 'task-1',
          status: TaskStatus.Success,
          timestamp: 123,
          signature_data: { signature: '0xbls' }
        }
      })
    );
    const client = new GatewayClient({ baseUrl: 'https://gateway.example', token: 'token', fetch: fetchMock });

    const response = await client.createTask(taskRequest);

    expect(response.task_id).toBe('task-1');
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string | URL | Request, RequestInit];
    expect(url).toBe('https://gateway.example/rpc');
    expect(init?.method).toBe('POST');
    expect((init?.headers as Headers).get('authorization')).toBe('Bearer token');
    expect(JSON.parse(init?.body as string)).toMatchObject({
      jsonrpc: '2.0',
      method: 'newt_createTask',
      params: taskRequest,
      id: 1
    });
  });

  it('throws JsonRpcError for RPC error responses', async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, _init?: RequestInit): Promise<Response> =>
      jsonResponse({ jsonrpc: '2.0', id: 1, error: { code: -32000, message: 'operator quorum failed' } })
    );
    const client = new GatewayClient({ baseUrl: 'https://gateway.example', fetch: fetchMock });

    await expect(client.createTask(taskRequest)).rejects.toBeInstanceOf(JsonRpcError);
  });

  it('subscribes to async task updates over WebSocket', () => {
    const updates: unknown[] = [];
    const client = new GatewayClient({
      baseUrl: 'https://gateway.example',
      WebSocket: mockWebSocketConstructor()
    });

    const subscription = client.subscribeToTask('tasks.task-1', {
      onUpdate: (update) => updates.push(update)
    });

    const socket = MockWebSocket.instances[0];
    expect(socket?.url).toBe('wss://gateway.example/ws?topic=tasks.task-1');
    socket?.emitOpen();
    expect(socket?.sent).toEqual([JSON.stringify({ type: 'subscribe', topic: 'tasks.task-1' })]);
    socket?.emitMessage({ topic: 'tasks.task-1', task_id: 'task-1', status: TaskStatus.Success });

    expect(updates).toEqual([{ topic: 'tasks.task-1', task_id: 'task-1', status: TaskStatus.Success }]);
    subscription.close(1000, 'done');
    expect(socket?.closeReason).toBe('done');
  });
});
