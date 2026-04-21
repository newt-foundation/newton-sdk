import { describe, expect, it, vi } from 'vitest';
import { GatewayClient, NewtonClient, ProofClient, TaskStatus, type CreateTaskRequest } from '../src';
import { jsonResponse } from './helpers';

function twitterTask(proofCid?: string): CreateTaskRequest {
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
    timeout: 60,
    use_two_phase: true,
    ...(proofCid ? { proof_cid: proofCid } : {})
  };
}

describe('Newton SDK zkTLS Twitter E2E request flow', () => {
  it('stores proof then submits createTask with gateway-compatible JSON-RPC payload', async () => {
    const seen: Array<{ url: string; body: unknown }> = [];
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      seen.push({ url, body });

      if (url.endsWith('/v1/proof/store')) {
        expect(body).toEqual({ proof: 'YmNzLXByb29m' });
        return jsonResponse({ cid: 'bafyproofcid', url: 'ipfs://bafyproofcid' });
      }

      if (url.endsWith('/rpc')) {
        expect(body).toMatchObject({
          jsonrpc: '2.0',
          method: 'newt_createTask',
          params: {
            policy_client: '0x1111111111111111111111111111111111111111',
            proof_cid: 'bafyproofcid',
            use_two_phase: true,
            wasm_args: {
              min_followers: 1000,
              twitter_username: 'realsigridjin'
            }
          }
        });
        return jsonResponse({
          jsonrpc: '2.0',
          id: (body as any).id,
          result: {
            task_id: 'task-1',
            status: TaskStatus.Success,
            timestamp: 123,
            signature_data: { signature: '0xbls' }
          }
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const client = new NewtonClient({
      gateway: { baseUrl: 'https://gateway.example', token: 'gateway-token', fetch: fetchMock },
      proof: { baseUrl: 'https://sidecar.example', fetch: fetchMock }
    });

    const result = await client.submitTaskWithProof({
      proof: 'YmNzLXByb29m',
      task: twitterTask()
    });

    expect(result).toMatchObject({
      mode: 'sync',
      proof: { cid: 'bafyproofcid' },
      task: { task_id: 'task-1', status: TaskStatus.Success }
    });
    expect(seen.map((call) => call.url)).toEqual(['https://sidecar.example/v1/proof/store', 'https://gateway.example/rpc']);
  });

  it('surfaces JSON-RPC and HTTP errors for app-level UX', async () => {
    const rpcErrorFetch = vi.fn(async () =>
      jsonResponse({ jsonrpc: '2.0', id: 1, error: { code: -32003, message: 'TLS proof verification failed' } })
    );
    const gateway = new GatewayClient({ baseUrl: 'https://gateway.example', fetch: rpcErrorFetch });

    await expect(gateway.createTask(twitterTask('bafyproofcid'))).rejects.toThrow('TLS proof verification failed');

    const httpErrorFetch = vi.fn(async () => new Response('bad gateway', { status: 502, statusText: 'Bad Gateway' }));
    const proof = new ProofClient({ baseUrl: 'https://sidecar.example', fetch: httpErrorFetch });

    await expect(proof.storeProof({ proof: 'YmNzLXByb29m' })).rejects.toThrow('HTTP 502 Bad Gateway');
  });
});
