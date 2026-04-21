import type { RpcRequestOptions } from '../types';

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface HttpClientOptions {
  baseUrl: string;
  token?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  fetch?: FetchLike;
}

export class NewtonSdkError extends Error {
  public override readonly cause?: unknown;

  public constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'NewtonSdkError';
    if (options && 'cause' in options) {
      this.cause = options.cause;
    }
  }
}

export class HttpRequestError extends NewtonSdkError {
  public readonly status: number;
  public readonly statusText: string;
  public readonly body: string;

  public constructor(status: number, statusText: string, body: string) {
    super(`HTTP ${status} ${statusText}${body ? `: ${body}` : ''}`);
    this.name = 'HttpRequestError';
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

export class TimeoutError extends NewtonSdkError {
  public constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

export function normalizeHttpUrl(baseUrl: string, path = ''): string {
  const url = new URL(baseUrl);
  const normalizedBasePath = url.pathname.replace(/\/$/, '');
  const normalizedPath = path ? `/${path.replace(/^\//, '')}` : '';
  url.pathname = `${normalizedBasePath}${normalizedPath}` || '/';
  return url.toString();
}

export function normalizeWsUrl(baseUrl: string, path = ''): string {
  const url = new URL(normalizeHttpUrl(baseUrl, path));
  if (url.protocol === 'https:') {
    url.protocol = 'wss:';
  } else if (url.protocol === 'http:') {
    url.protocol = 'ws:';
  }
  return url.toString();
}

export function appendQuery(url: string, params?: Record<string, string | number | boolean | undefined>): string {
  if (!params) {
    return url;
  }
  const next = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      next.searchParams.set(key, String(value));
    }
  }
  return next.toString();
}

export function getFetch(fetchImpl?: FetchLike): FetchLike {
  if (fetchImpl) {
    return fetchImpl;
  }
  if (typeof fetch !== 'undefined') {
    return fetch.bind(globalThis) as FetchLike;
  }
  throw new NewtonSdkError('No fetch implementation available; provide one in client options.');
}

export function buildHeaders(
  token: string | undefined,
  baseHeaders: Record<string, string> | undefined,
  requestHeaders: Record<string, string> | undefined,
  includeJson = true
): Headers {
  const headers = new Headers(baseHeaders);
  if (includeJson && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  if (token && !headers.has('authorization')) {
    headers.set('authorization', `Bearer ${token}`);
  }
  if (requestHeaders) {
    for (const [key, value] of Object.entries(requestHeaders)) {
      headers.set(key, value);
    }
  }
  return headers;
}

export interface TimeoutSignal {
  signal?: AbortSignal;
  cleanup: () => void;
}

export function createTimeoutSignal(options: Pick<RpcRequestOptions, 'signal' | 'timeoutMs'>, defaultTimeoutMs?: number): TimeoutSignal {
  const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
  if (!timeoutMs && !options.signal) {
    return { cleanup: () => undefined };
  }

  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const abortFromExternal = (): void => controller.abort(options.signal?.reason);
  if (options.signal) {
    if (options.signal.aborted) {
      abortFromExternal();
    } else {
      options.signal.addEventListener('abort', abortFromExternal, { once: true });
    }
  }

  if (timeoutMs) {
    timeout = setTimeout(() => controller.abort(new TimeoutError(timeoutMs)), timeoutMs);
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      if (timeout) {
        clearTimeout(timeout);
      }
      if (options.signal) {
        options.signal.removeEventListener('abort', abortFromExternal);
      }
    }
  };
}

export async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!response.ok) {
    throw new HttpRequestError(response.status, response.statusText, text);
  }
  if (!text) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}

export async function parseBytesResponse(response: Response): Promise<Uint8Array> {
  const body = await response.arrayBuffer();
  if (!response.ok) {
    const text = new TextDecoder().decode(body);
    throw new HttpRequestError(response.status, response.statusText, text);
  }
  return new Uint8Array(body);
}

export function requireWebSocket(webSocketImpl?: typeof WebSocket): typeof WebSocket {
  if (webSocketImpl) {
    return webSocketImpl;
  }
  if (typeof WebSocket !== 'undefined') {
    return WebSocket;
  }
  throw new NewtonSdkError('No WebSocket implementation available; provide one in client options.');
}

export function parseSocketMessage<T>(event: MessageEvent): T {
  const data = event.data as unknown;
  if (typeof data === 'string') {
    return JSON.parse(data) as T;
  }
  return data as T;
}
