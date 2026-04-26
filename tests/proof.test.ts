import { describe, expect, it, vi } from 'vitest';
import { ProofClient } from '../src';
import { jsonResponse } from './helpers';

describe('ProofClient', () => {
  it('stores a base64 proof via Attester REST API', async () => {
    const fetchMock = vi.fn(async (_input: string | URL | Request, _init?: RequestInit): Promise<Response> =>
      jsonResponse({ cid: 'bafyproof', url: 'ipfs://bafyproof' })
    );
    const client = new ProofClient({ baseUrl: 'https://attester.example', token: 'token', fetch: fetchMock });

    const response = await client.storeProof({ proof: 'YmNzLXByb29m' });

    expect(response).toEqual({ cid: 'bafyproof', url: 'ipfs://bafyproof' });
    const [url, init] = fetchMock.mock.calls[0] as [string | URL | Request, RequestInit];
    expect(url).toBe('https://attester.example/v1/proof/store');
    expect(init?.method).toBe('POST');
    expect((init?.headers as Headers).get('authorization')).toBe('Bearer token');
    expect(JSON.parse(init?.body as string)).toEqual({ proof: 'YmNzLXByb29m' });
  });

  it('retrieves proof bytes by CID', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const fetchMock = vi.fn(async (_input: string | URL | Request, _init?: RequestInit): Promise<Response> =>
      new Response(bytes)
    );
    const client = new ProofClient({ baseUrl: 'https://attester.example', fetch: fetchMock });

    await expect(client.getProof('bafy/proof')).resolves.toEqual(bytes);
    const [url, init] = fetchMock.mock.calls[0] as [string | URL | Request, RequestInit];
    expect(url).toBe('https://attester.example/v1/proof/bafy%2Fproof');
    expect(init?.method).toBe('GET');
  });

  it('retrieves proof bytes and returns base64 encoding', async () => {
    const bytes = new Uint8Array([72, 101, 108, 108, 111]);
    const fetchMock = vi.fn(async (_input: string | URL | Request, _init?: RequestInit): Promise<Response> =>
      new Response(bytes)
    );
    const client = new ProofClient({ baseUrl: 'https://attester.example', fetch: fetchMock });

    const result = await client.getProofBase64('bafybase64');
    expect(result).toBe(Buffer.from(bytes).toString('base64'));
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url] = fetchMock.mock.calls[0] as [string | URL | Request, RequestInit];
    expect(url).toBe('https://attester.example/v1/proof/bafybase64');
  });
});
