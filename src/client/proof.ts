import type { ProofClientRetrieveOptions, ProofClientStoreOptions, StoreProofRequest, StoreProofResponse } from '../types';
import {
  buildHeaders,
  createTimeoutSignal,
  getFetch,
  normalizeHttpUrl,
  parseBytesResponse,
  parseJsonResponse,
  type FetchLike
} from './utils';

export interface ProofClientOptions {
  baseUrl: string;
  token?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  fetch?: FetchLike;
}

export class ProofClient {
  private readonly baseUrl: string;
  private readonly token: string | undefined;
  private readonly headers: Record<string, string> | undefined;
  private readonly timeoutMs: number | undefined;
  private readonly fetchImpl: FetchLike;

  public constructor(options: ProofClientOptions) {
    this.baseUrl = options.baseUrl;
    this.token = options.token;
    this.headers = options.headers;
    this.timeoutMs = options.timeoutMs;
    this.fetchImpl = getFetch(options.fetch);
  }

  public async storeProof(request: StoreProofRequest, options: ProofClientStoreOptions = {}): Promise<StoreProofResponse> {
    const timeout = createTimeoutSignal(options, this.timeoutMs);
    try {
      const init: RequestInit = {
        method: 'POST',
        headers: buildHeaders(this.token, this.headers, undefined),
        body: JSON.stringify(request),
        ...(timeout.signal ? { signal: timeout.signal } : {})
      };
      const response = await this.fetchImpl(normalizeHttpUrl(this.baseUrl, '/v1/proof/store'), init);
      return await parseJsonResponse<StoreProofResponse>(response);
    } finally {
      timeout.cleanup();
    }
  }

  public async getProof(cid: string, options: ProofClientRetrieveOptions = {}): Promise<Uint8Array> {
    const timeout = createTimeoutSignal(options, this.timeoutMs);
    try {
      const init: RequestInit = {
        method: 'GET',
        headers: buildHeaders(this.token, this.headers, undefined, false),
        ...(timeout.signal ? { signal: timeout.signal } : {})
      };
      const response = await this.fetchImpl(normalizeHttpUrl(this.baseUrl, `/v1/proof/${encodeURIComponent(cid)}`), init);
      return await parseBytesResponse(response);
    } finally {
      timeout.cleanup();
    }
  }

  public async getProofBase64(cid: string, options?: ProofClientRetrieveOptions): Promise<string> {
    const bytes = await this.getProof(cid, options);
    return Buffer.from(bytes).toString('base64');
  }
}
