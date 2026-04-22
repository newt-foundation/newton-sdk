import type {
  CreateTaskRequest,
  CreateTaskResponse,
  JsonRpcErrorObject,
  JsonRpcParams,
  JsonRpcRequest,
  JsonRpcResponse,
  NewtonRpcMethod,
  RpcRequestOptions,
  SendTaskRequest,
  SendTaskResponse,
  SimulatePolicyRequest,
  SimulatePolicyResponse,
  SimulateTaskRequest,
  StoreEncryptedSecretsResponse,
  TaskUpdate,
  WebhookRegistrationRequest,
  WebhookRegistrationResponse,
  WebhookUnregisterRequest,
  WebhookUnregisterResponse
} from '../types';
import {
  appendQuery,
  buildHeaders,
  createTimeoutSignal,
  getFetch,
  normalizeHttpUrl,
  normalizeWsUrl,
  parseJsonResponse,
  parseSocketMessage,
  requireWebSocket,
  type FetchLike,
  NewtonSdkError
} from './utils';

export interface GatewayClientOptions {
  baseUrl: string;
  token?: string;
  /** Defaults to /rpc. */
  rpcPath?: string;
  /** Defaults to baseUrl with /ws path and ws(s) scheme. */
  websocketUrl?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  fetch?: FetchLike;
  WebSocket?: typeof WebSocket;
}

export interface GatewaySubscription {
  topic: string;
  socket: WebSocket;
  close: (code?: number, reason?: string) => void;
}

export interface TaskSubscriptionOptions<TUpdate = TaskUpdate> {
  onUpdate?: (update: TUpdate, event: MessageEvent) => void;
  onOpen?: (socket: WebSocket) => void;
  onError?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  protocols?: string | string[];
  signal?: AbortSignal;
}

export class JsonRpcError extends NewtonSdkError {
  public readonly code: number;
  public readonly data?: unknown;

  public constructor(error: JsonRpcErrorObject) {
    super(error.message, { cause: error.data });
    this.name = 'JsonRpcError';
    this.code = error.code;
    if ('data' in error) {
      this.data = error.data;
    }
  }
}

export class GatewayClient {
  private readonly rpcUrl: string;
  private readonly websocketUrl: string;
  private readonly token: string | undefined;
  private readonly headers: Record<string, string> | undefined;
  private readonly timeoutMs: number | undefined;
  private readonly fetchImpl: FetchLike;
  private readonly webSocketImpl: typeof WebSocket | undefined;
  private nextId = 1;

  public constructor(options: GatewayClientOptions) {
    this.rpcUrl = normalizeHttpUrl(options.baseUrl, options.rpcPath ?? '/rpc');
    this.websocketUrl = options.websocketUrl ?? normalizeWsUrl(options.baseUrl, '/ws');
    this.token = options.token;
    this.headers = options.headers;
    this.timeoutMs = options.timeoutMs;
    this.fetchImpl = getFetch(options.fetch);
    this.webSocketImpl = options.WebSocket;
  }

  public async request<TResult, TParams extends JsonRpcParams = JsonRpcParams>(
    method: NewtonRpcMethod | string,
    params?: TParams,
    options: RpcRequestOptions = {}
  ): Promise<TResult> {
    const id = this.nextId++;
    const payload: JsonRpcRequest<TParams> = {
      jsonrpc: '2.0',
      method,
      id,
      ...(params === undefined ? {} : { params })
    };
    const timeout = createTimeoutSignal(options, this.timeoutMs);
    try {
      const init: RequestInit = {
        method: 'POST',
        headers: buildHeaders(this.token, this.headers, options.headers),
        body: JSON.stringify(payload),
        ...(timeout.signal ? { signal: timeout.signal } : {})
      };
      const response = await this.fetchImpl(this.rpcUrl, init);
      const json = await parseJsonResponse<JsonRpcResponse<TResult>>(response);
      if ('error' in json) {
        throw new JsonRpcError(json.error);
      }
      return json.result;
    } finally {
      timeout.cleanup();
    }
  }

  public createTask<TResponse extends CreateTaskResponse = CreateTaskResponse>(
    request: CreateTaskRequest,
    options?: RpcRequestOptions
  ): Promise<TResponse> {
    return this.request<TResponse, CreateTaskRequest>('newt_createTask', request, options);
  }

  public sendTask<TResponse extends SendTaskResponse = SendTaskResponse>(
    request: SendTaskRequest,
    options?: RpcRequestOptions
  ): Promise<TResponse> {
    return this.request<TResponse, SendTaskRequest>('newt_sendTask', request, options);
  }

  public simulateTask<TResponse = CreateTaskResponse>(
    request: SimulateTaskRequest,
    options?: RpcRequestOptions
  ): Promise<TResponse> {
    return this.request<TResponse, SimulateTaskRequest>('newt_simulateTask', request, options);
  }

  public storeEncryptedSecrets<TParams extends JsonRpcParams = JsonRpcParams, TResponse = StoreEncryptedSecretsResponse>(
    params: TParams,
    options?: RpcRequestOptions
  ): Promise<TResponse> {
    return this.request<TResponse, TParams>('newt_storeEncryptedSecrets', params, options);
  }

  public simulatePolicyData<TParams extends JsonRpcParams = JsonRpcParams, TResponse = unknown>(
    params: TParams,
    options?: RpcRequestOptions
  ): Promise<TResponse> {
    return this.request<TResponse, TParams>('newt_simulatePolicyData', params, options);
  }

  public simulatePolicyDataWithClient<TParams extends JsonRpcParams = JsonRpcParams, TResponse = unknown>(
    params: TParams,
    options?: RpcRequestOptions
  ): Promise<TResponse> {
    return this.request<TResponse, TParams>('newt_simulatePolicyDataWithClient', params, options);
  }

  public simulatePolicy<TResponse extends SimulatePolicyResponse = SimulatePolicyResponse>(
    request: SimulatePolicyRequest,
    options?: RpcRequestOptions
  ): Promise<TResponse> {
    return this.request<TResponse, SimulatePolicyRequest>('newt_simulatePolicy', request, options);
  }

  public registerWebhook<TResponse extends WebhookRegistrationResponse = WebhookRegistrationResponse>(
    request: WebhookRegistrationRequest,
    options?: RpcRequestOptions
  ): Promise<TResponse> {
    return this.request<TResponse, WebhookRegistrationRequest>('newt_registerWebhook', request, options);
  }

  public unregisterWebhook<TResponse extends WebhookUnregisterResponse = WebhookUnregisterResponse>(
    request: WebhookUnregisterRequest,
    options?: RpcRequestOptions
  ): Promise<TResponse> {
    return this.request<TResponse, WebhookUnregisterRequest>('newt_unregisterWebhook', request, options);
  }

  public subscribeToTask<TUpdate = TaskUpdate>(
    subscriptionTopic: string,
    options: TaskSubscriptionOptions<TUpdate> = {}
  ): GatewaySubscription {
    const WebSocketCtor = requireWebSocket(this.webSocketImpl);
    const url = appendQuery(this.websocketUrl, { topic: subscriptionTopic });
    const socket = new WebSocketCtor(url, options.protocols);

    socket.addEventListener('open', () => {
      socket.send(JSON.stringify({ type: 'subscribe', topic: subscriptionTopic }));
      options.onOpen?.(socket);
    });
    socket.addEventListener('message', (event: MessageEvent) => {
      options.onUpdate?.(parseSocketMessage<TUpdate>(event), event);
    });
    socket.addEventListener('error', (event: Event) => options.onError?.(event));
    socket.addEventListener('close', (event: CloseEvent) => options.onClose?.(event));

    if (options.signal) {
      const abort = (): void => socket.close(1000, 'aborted');
      if (options.signal.aborted) {
        abort();
      } else {
        options.signal.addEventListener('abort', abort, { once: true });
        socket.addEventListener('close', () => options.signal?.removeEventListener('abort', abort), { once: true });
      }
    }

    return {
      topic: subscriptionTopic,
      socket,
      close: (code?: number, reason?: string) => socket.close(code, reason)
    };
  }
}
