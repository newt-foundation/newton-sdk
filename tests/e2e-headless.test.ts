import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HttpRequestError,
  NewtonClient,
  ProofClient,
  TaskStatus,
  TimeoutError,
  type AsyncTaskLifecycleResult,
  type CreateTaskRequest,
  type TaskUpdate
} from '../src';
import { MockWebSocket, jsonResponse, mockWebSocketConstructor } from './helpers';

const proofBase64 = Buffer.from('tlsn-proof-payload', 'utf8').toString('base64');
const proofCid = 'bafyzkproofcid';
const terminalStatuses = new Set<TaskStatus>([TaskStatus.Success, TaskStatus.Failed, TaskStatus.Timeout]);

function twitterTask(nextProofCid?: string): CreateTaskRequest {
  return {
    policy_client: '0x1111111111111111111111111111111111111111',
    intent: {
      type: 'zktls_twitter_followers',
      provider: 'x.com',
      username: 'realsigridjin',
      chain_id: 31337
    },
    intent_signature: '0x',
    quorum_number: 1,
    quorum_threshold_percentage: 67,
    wasm_args: {
      min_followers: 1000,
      twitter_username: 'realsigridjin'
    },
    timeout: 120,
    use_two_phase: true,
    ...(nextProofCid ? { proof_cid: nextProofCid } : {})
  };
}

function waitForTerminalLifecycleUpdate(
  client: NewtonClient,
  result: AsyncTaskLifecycleResult,
  options: { updates?: TaskUpdate[]; recoverOnClose?: boolean } = {}
): Promise<TaskUpdate> {
  return new Promise<TaskUpdate>((resolve, reject) => {
    let settled = false;
    let subscription: ReturnType<NewtonClient['subscribeToTask']> | undefined;

    const settle = (handler: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      handler();
    };

    const subscribe = (): void => {
      subscription = client.subscribeToLifecycleResult(result, {
        onUpdate: (update) => {
          options.updates?.push(update);
          if (update.task_id && update.task_id !== result.task.task_id) {
            return;
          }
          if (update.status && terminalStatuses.has(update.status)) {
            settle(() => {
              subscription?.close(1000, 'complete');
              resolve(update);
            });
          }
        },
        onError: () => {
          settle(() => reject(new Error(`WebSocket error while waiting on ${result.task.subscription_topic}`)));
        },
        onClose: (event) => {
          if (settled) {
            return;
          }
          if (options.recoverOnClose && !event.wasClean) {
            subscribe();
            return;
          }
          settle(() => reject(new Error(`WebSocket closed before terminal update (${event.code} ${event.reason})`)));
        }
      });
    };

    subscribe();
  });
}

describe('Headless zkTLS Twitter E2E', () => {
  beforeEach(() => {
    MockWebSocket.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs the complete submitTaskWithProof sync flow with realistic mocked gateway + sidecar responses', async () => {
    const seen: Array<{ url: string; body?: unknown }> = [];
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      seen.push({ url, ...(body === undefined ? {} : { body }) });

      if (url.endsWith('/v1/proof/store')) {
        return jsonResponse({ cid: proofCid, url: `ipfs://${proofCid}` });
      }

      if (url.endsWith('/rpc')) {
        expect(body).toMatchObject({
          jsonrpc: '2.0',
          method: 'newt_createTask',
          params: {
            proof_cid: proofCid,
            policy_client: '0x1111111111111111111111111111111111111111',
            use_two_phase: true,
            wasm_args: {
              min_followers: 1000,
              twitter_username: 'realsigridjin'
            }
          }
        });

        return jsonResponse({
          jsonrpc: '2.0',
          id: (body as { id: number }).id,
          result: {
            task_id: 'task-sync-1',
            status: TaskStatus.Success,
            timestamp: 1713984000,
            task_response: {
              verified: true,
              follower_count: 4242,
              policy: 'zktls_twitter_followers'
            },
            signature_data: { signature: '0xdeadbeef' }
          }
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new NewtonClient({
      gateway: { baseUrl: 'https://gateway.example', token: 'gateway-token', fetch: fetchMock },
      proof: { baseUrl: 'https://sidecar.example', token: 'sidecar-token', fetch: fetchMock }
    });

    const result = await client.submitTaskWithProof({
      proof: proofBase64,
      task: twitterTask()
    });

    expect(result).toMatchObject({
      mode: 'sync',
      proof: { cid: proofCid, url: `ipfs://${proofCid}` },
      task: {
        task_id: 'task-sync-1',
        status: TaskStatus.Success,
        task_response: {
          verified: true,
          follower_count: 4242,
          policy: 'zktls_twitter_followers'
        }
      }
    });
    expect(seen.map((entry) => entry.url)).toEqual([
      'https://sidecar.example/v1/proof/store',
      'https://gateway.example/rpc'
    ]);
  });

  it('tracks the full async task lifecycle from task creation through terminal WebSocket result delivery', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(init.body as string) : undefined;

      if (url.endsWith('/v1/proof/store')) {
        return jsonResponse({ cid: proofCid, url: `ipfs://${proofCid}` });
      }

      if (url.endsWith('/rpc')) {
        expect(body).toMatchObject({
          jsonrpc: '2.0',
          method: 'newt_sendTask',
          params: {
            proof_cid: proofCid,
            intent: {
              type: 'zktls_twitter_followers',
              provider: 'x.com',
              username: 'realsigridjin',
              chain_id: 31337
            }
          }
        });

        return jsonResponse({
          jsonrpc: '2.0',
          id: (body as { id: number }).id,
          result: {
            task_id: 'task-async-1',
            subscription_topic: 'tasks.task-async-1',
            message: 'queued',
            timestamp: 1713984001
          }
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new NewtonClient({
      gateway: {
        baseUrl: 'https://gateway.example',
        fetch: fetchMock,
        WebSocket: mockWebSocketConstructor()
      },
      proof: { baseUrl: 'https://sidecar.example', fetch: fetchMock }
    });

    const result = await client.submitTaskWithProof({
      async: true,
      proof: proofBase64,
      task: twitterTask()
    });

    expect(result).toMatchObject({
      mode: 'async',
      proof: { cid: proofCid },
      task: { task_id: 'task-async-1', subscription_topic: 'tasks.task-async-1' }
    });

    const updates: TaskUpdate[] = [];
    const terminal = waitForTerminalLifecycleUpdate(client, result, { updates });

    const socket = MockWebSocket.instances[0];
    expect(socket?.url).toBe('wss://gateway.example/ws?topic=tasks.task-async-1');

    socket?.emitOpen();
    expect(socket?.sent).toEqual([JSON.stringify({ type: 'subscribe', topic: 'tasks.task-async-1' })]);

    socket?.emitMessage({
      topic: 'tasks.task-async-1',
      task_id: 'task-async-1',
      status: TaskStatus.Pending,
      payload: { stage: 'queued' }
    });
    socket?.emitMessage({
      topic: 'tasks.task-async-1',
      task_id: 'task-async-1',
      status: TaskStatus.Processing,
      payload: { stage: 'aggregating' }
    });
    socket?.emitMessage({
      topic: 'tasks.task-async-1',
      task_id: 'task-async-1',
      status: TaskStatus.Success,
      payload: { verified: true, follower_count: 4242 }
    });

    await expect(terminal).resolves.toMatchObject({
      task_id: 'task-async-1',
      status: TaskStatus.Success,
      payload: { verified: true, follower_count: 4242 }
    });
    expect(updates).toEqual([
      {
        topic: 'tasks.task-async-1',
        task_id: 'task-async-1',
        status: TaskStatus.Pending,
        payload: { stage: 'queued' }
      },
      {
        topic: 'tasks.task-async-1',
        task_id: 'task-async-1',
        status: TaskStatus.Processing,
        payload: { stage: 'aggregating' }
      },
      {
        topic: 'tasks.task-async-1',
        task_id: 'task-async-1',
        status: TaskStatus.Success,
        payload: { verified: true, follower_count: 4242 }
      }
    ]);
  });

  it('simulates an MPC-TLS attester session before proof upload and task dispatch', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(init.body as string) : undefined;

      if (url.endsWith('/v1/proof/store')) {
        return jsonResponse({ cid: proofCid, url: `ipfs://${proofCid}` });
      }

      if (url.endsWith('/rpc')) {
        return jsonResponse({
          jsonrpc: '2.0',
          id: (body as { id: number }).id,
          result: {
            task_id: 'task-async-mpc',
            subscription_topic: 'tasks.task-async-mpc',
            message: 'queued',
            timestamp: 1713984010
          }
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new NewtonClient({
      gateway: {
        baseUrl: 'https://gateway.example',
        fetch: fetchMock,
        WebSocket: mockWebSocketConstructor()
      },
      attester: {
        baseUrl: 'https://attester.example',
        token: 'attester-token',
        WebSocket: mockWebSocketConstructor()
      },
      proof: { baseUrl: 'https://sidecar.example', fetch: fetchMock }
    });

    const pending = client.submitTaskWithProof({
      async: true,
      proof: proofBase64,
      session: { max_recv_data: 8192, max_sent_data: 4096 },
      sessionOptions: {
        registerMessage: (request) => ({
          type: 'Register',
          payload: {
            ...request,
            transcript_mode: 'mpc-tls'
          }
        })
      },
      task: twitterTask()
    });

    const sessionSocket = MockWebSocket.instances[0];
    expect(sessionSocket?.url).toBe('wss://attester.example/session?token=attester-token');

    sessionSocket?.emitOpen();
    expect(sessionSocket?.sent).toEqual([
      JSON.stringify({
        type: 'Register',
        payload: {
          max_recv_data: 8192,
          max_sent_data: 4096,
          transcript_mode: 'mpc-tls'
        }
      })
    ]);
    sessionSocket?.emitMessage({ type: 'Registered', payload: { session_id: 'session-mpc-1' } });

    const result = await pending;
    expect(result).toMatchObject({
      mode: 'async',
      session: { session_id: 'session-mpc-1' },
      proof: { cid: proofCid },
      task: { task_id: 'task-async-mpc', subscription_topic: 'tasks.task-async-mpc' }
    });

    expect(client.attester).toBeDefined();
    const sessionId = result.session?.session_id;
    expect(sessionId).toBe('session-mpc-1');
    if (!client.attester || !sessionId) {
      throw new Error('Expected attester session to be available');
    }

    const verifier = client.attester.connectVerifier({ session_id: sessionId });
    const proxy = client.attester.connectProxy({ host: 'x.com', port: 443, protocol: 'tls' });

    expect(MockWebSocket.instances[1]?.url).toBe('wss://attester.example/verifier?session_id=session-mpc-1&token=attester-token');
    expect(MockWebSocket.instances[2]?.url).toBe('wss://attester.example/proxy?host=x.com&port=443&protocol=tls&token=attester-token');

    client.attester.sendRevealConfig(verifier, {
      ranges: [
        { range: [0, 128], handler: { handler_type: 'Recv', handler_part: 'Headers' } },
        { range: { start: 129, end: 256 }, handler: { handler_type: 'Recv', handler_part: 'Body' } }
      ]
    });

    expect(proxy).toBe(MockWebSocket.instances[2]);
    expect(MockWebSocket.instances[1]?.sent[0]).toContain('RevealConfig');
  });

  it('rejects before proof upload when the attester session closes before registration completes', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ cid: proofCid, url: `ipfs://${proofCid}` }));
    const client = new NewtonClient({
      gateway: { baseUrl: 'https://gateway.example', fetch: fetchMock },
      attester: {
        baseUrl: 'https://attester.example',
        WebSocket: mockWebSocketConstructor()
      },
      proof: { baseUrl: 'https://sidecar.example', fetch: fetchMock }
    });

    const pending = client.submitTaskWithProof({
      proof: proofBase64,
      session: { max_recv_data: 1024, max_sent_data: 512 },
      task: twitterTask()
    });

    const sessionSocket = MockWebSocket.instances[0];
    sessionSocket?.emitOpen();
    sessionSocket?.emitClose(1011, 'notary unavailable', false);

    await expect(pending).rejects.toThrow('Attester /session WebSocket closed before registration');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('supports application-level recovery by resubscribing after an interrupted WebSocket stream', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(init.body as string) : undefined;

      if (url.endsWith('/v1/proof/store')) {
        return jsonResponse({ cid: proofCid, url: `ipfs://${proofCid}` });
      }

      if (url.endsWith('/rpc')) {
        return jsonResponse({
          jsonrpc: '2.0',
          id: (body as { id: number }).id,
          result: {
            task_id: 'task-reconnect-1',
            subscription_topic: 'tasks.task-reconnect-1',
            message: 'queued',
            timestamp: 1713984020
          }
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new NewtonClient({
      gateway: {
        baseUrl: 'https://gateway.example',
        fetch: fetchMock,
        WebSocket: mockWebSocketConstructor()
      },
      proof: { baseUrl: 'https://sidecar.example', fetch: fetchMock }
    });

    const result = await client.submitTaskWithProof({
      async: true,
      proof: proofBase64,
      task: twitterTask()
    });

    const updates: TaskUpdate[] = [];
    const terminal = waitForTerminalLifecycleUpdate(client, result, { updates, recoverOnClose: true });

    const firstSocket = MockWebSocket.instances[0];
    firstSocket?.emitOpen();
    firstSocket?.emitMessage({
      topic: 'tasks.task-reconnect-1',
      task_id: 'task-reconnect-1',
      status: TaskStatus.Processing,
      payload: { stage: 'notarizing' }
    });
    firstSocket?.emitClose(1012, 'gateway restart', false);

    const secondSocket = MockWebSocket.instances[1];
    expect(secondSocket?.url).toBe('wss://gateway.example/ws?topic=tasks.task-reconnect-1');
    secondSocket?.emitOpen();
    secondSocket?.emitMessage({
      topic: 'tasks.task-reconnect-1',
      task_id: 'task-reconnect-1',
      status: TaskStatus.Success,
      payload: { verified: true, follower_count: 5000 }
    });

    await expect(terminal).resolves.toMatchObject({
      task_id: 'task-reconnect-1',
      status: TaskStatus.Success,
      payload: { verified: true, follower_count: 5000 }
    });
    expect(firstSocket?.sent).toEqual([JSON.stringify({ type: 'subscribe', topic: 'tasks.task-reconnect-1' })]);
    expect(secondSocket?.sent).toEqual([JSON.stringify({ type: 'subscribe', topic: 'tasks.task-reconnect-1' })]);
    expect(updates).toEqual([
      {
        topic: 'tasks.task-reconnect-1',
        task_id: 'task-reconnect-1',
        status: TaskStatus.Processing,
        payload: { stage: 'notarizing' }
      },
      {
        topic: 'tasks.task-reconnect-1',
        task_id: 'task-reconnect-1',
        status: TaskStatus.Success,
        payload: { verified: true, follower_count: 5000 }
      }
    ]);
  });

  it('surfaces partial failure details after intermediate task progress updates', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(init.body as string) : undefined;

      if (url.endsWith('/v1/proof/store')) {
        return jsonResponse({ cid: proofCid, url: `ipfs://${proofCid}` });
      }

      if (url.endsWith('/rpc')) {
        return jsonResponse({
          jsonrpc: '2.0',
          id: (body as { id: number }).id,
          result: {
            task_id: 'task-failure-1',
            subscription_topic: 'tasks.task-failure-1',
            message: 'queued',
            timestamp: 1713984030
          }
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new NewtonClient({
      gateway: {
        baseUrl: 'https://gateway.example',
        fetch: fetchMock,
        WebSocket: mockWebSocketConstructor()
      },
      proof: { baseUrl: 'https://sidecar.example', fetch: fetchMock }
    });

    const result = await client.submitTaskWithProof({
      async: true,
      proof: proofBase64,
      task: twitterTask()
    });

    const updates: TaskUpdate[] = [];
    const terminal = waitForTerminalLifecycleUpdate(client, result, { updates });

    const socket = MockWebSocket.instances[0];
    socket?.emitOpen();
    socket?.emitMessage({
      topic: 'tasks.task-failure-1',
      task_id: 'task-failure-1',
      status: TaskStatus.Processing,
      payload: {
        completed_operators: ['0xoperator1'],
        pending_operators: ['0xoperator2']
      }
    });
    socket?.emitMessage({
      topic: 'tasks.task-failure-1',
      task_id: 'task-failure-1',
      status: TaskStatus.Failed,
      error: 'operator quorum not reached',
      payload: {
        completed_operators: ['0xoperator1'],
        failed_operators: [{ operator: '0xoperator2', error: 'notary timeout' }]
      }
    });

    await expect(terminal).resolves.toMatchObject({
      task_id: 'task-failure-1',
      status: TaskStatus.Failed,
      error: 'operator quorum not reached',
      payload: {
        completed_operators: ['0xoperator1'],
        failed_operators: [{ operator: '0xoperator2', error: 'notary timeout' }]
      }
    });
    expect(updates).toHaveLength(2);
    expect(updates[0]).toMatchObject({
      status: TaskStatus.Processing,
      payload: {
        completed_operators: ['0xoperator1'],
        pending_operators: ['0xoperator2']
      }
    });
  });

  it('surfaces a timeout when the gateway request never completes', async () => {
    vi.useFakeTimers();

    const fetchMock = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/v1/proof/store')) {
        return Promise.resolve(jsonResponse({ cid: proofCid, url: `ipfs://${proofCid}` }));
      }
      if (url.endsWith('/rpc')) {
        return new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
        });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    const client = new NewtonClient({
      gateway: { baseUrl: 'https://gateway.example', fetch: fetchMock, timeoutMs: 25 },
      proof: { baseUrl: 'https://sidecar.example', fetch: fetchMock }
    });

    const pending = client.submitTaskWithProof({ proof: proofBase64, task: twitterTask() });
    const assertion = expect(pending).rejects.toBeInstanceOf(TimeoutError);

    await vi.advanceTimersByTimeAsync(30);
    await assertion;
  });

  it('fails fast on an invalid JSON-RPC payload from the gateway', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/v1/proof/store')) {
        return jsonResponse({ cid: proofCid, url: `ipfs://${proofCid}` });
      }
      if (url.endsWith('/rpc')) {
        return new Response('not-json', { status: 200, headers: { 'content-type': 'application/json' } });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new NewtonClient({
      gateway: { baseUrl: 'https://gateway.example', fetch: fetchMock },
      proof: { baseUrl: 'https://sidecar.example', fetch: fetchMock }
    });

    await expect(client.submitTaskWithProof({ proof: proofBase64, task: twitterTask() })).rejects.toBeInstanceOf(SyntaxError);
  });

  it('surfaces HTTP 5xx failures from the sidecar before task submission', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/v1/proof/store')) {
        return new Response('sidecar unavailable', { status: 503, statusText: 'Service Unavailable' });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new NewtonClient({
      gateway: { baseUrl: 'https://gateway.example', fetch: fetchMock },
      proof: { baseUrl: 'https://sidecar.example', fetch: fetchMock }
    });

    await expect(client.submitTaskWithProof({ proof: proofBase64, task: twitterTask() })).rejects.toMatchObject({
      name: 'HttpRequestError',
      status: 503,
      statusText: 'Service Unavailable',
      body: 'sidecar unavailable'
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('retrieves proof bytes by CID without any live sidecar dependency', async () => {
    const proofBytes = new Uint8Array([0, 1, 2, 3, 4, 5]);
    const fetchMock = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => new Response(proofBytes));
    const client = new ProofClient({ baseUrl: 'https://sidecar.example', fetch: fetchMock });

    await expect(client.getProof('bafy/proof')).resolves.toEqual(proofBytes);
    const [url, init] = fetchMock.mock.calls[0] as [string | URL | Request, RequestInit];
    expect(url).toBe('https://sidecar.example/v1/proof/bafy%2Fproof');
    expect(init.method).toBe('GET');
  });

  it('preserves HTTP metadata when proof retrieval fails without a live sidecar', async () => {
    const fetchMock = vi.fn(async () => new Response('cid missing', { status: 404, statusText: 'Not Found' }));
    const client = new ProofClient({ baseUrl: 'https://sidecar.example', fetch: fetchMock });

    await expect(client.getProof('missing-proof')).rejects.toBeInstanceOf(HttpRequestError);
    await expect(client.getProof('missing-proof')).rejects.toMatchObject({
      status: 404,
      statusText: 'Not Found',
      body: 'cid missing'
    });
  });
});
