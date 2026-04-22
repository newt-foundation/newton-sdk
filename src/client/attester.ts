import type {
  AttesterEndpoint,
  AttesterSession,
  ProxyConnectParams,
  RegisterRequest,
  RegisterResponse,
  RevealConfig,
  VerifierConnectParams,
  WebSocketConnectionOptions
} from '../types';
import { appendQuery, normalizeWsUrl, parseSocketMessage, requireWebSocket } from './utils';

export interface AttesterClientOptions {
  baseUrl: string;
  token?: string;
  WebSocket?: typeof WebSocket;
}

export interface CreateSessionOptions extends WebSocketConnectionOptions<unknown> {
  registerMessage?: (request: RegisterRequest) => unknown;
}

export class AttesterClient {
  private readonly baseUrl: string;
  private readonly token: string | undefined;
  private readonly webSocketImpl: typeof WebSocket | undefined;

  public constructor(options: AttesterClientOptions) {
    this.baseUrl = options.baseUrl;
    this.token = options.token;
    this.webSocketImpl = options.WebSocket;
  }

  public createSession(request: RegisterRequest, options: CreateSessionOptions = {}): Promise<AttesterSession> {
    return new Promise((resolve, reject) => {
      const socket = this.connect('session', undefined, {
        ...options,
        onOpen: (opened) => {
          const registerMessage = options.registerMessage?.(request) ?? { type: 'Register', ...request };
          opened.send(JSON.stringify(registerMessage));
          options.onOpen?.(opened);
        },
        onMessage: (message, event) => {
          options.onMessage?.(message, event);
          const response = this.extractRegisterResponse(message);
          if (response) {
            resolve({
              session_id: response.session_id,
              socket,
              close: (code?: number, reason?: string) => socket.close(code, reason)
            });
          }
        },
        onError: (event) => {
          options.onError?.(event);
          reject(new Error('Attester /session WebSocket error'));
        },
        onClose: (event) => {
          options.onClose?.(event);
          if (!event.wasClean) {
            reject(new Error(`Attester /session WebSocket closed before registration: ${event.code} ${event.reason}`));
          }
        }
      });
    });
  }

  public connectVerifier<TMessage = unknown>(
    params: VerifierConnectParams = {},
    options: WebSocketConnectionOptions<TMessage> = {}
  ): WebSocket {
    return this.connect<TMessage>('verifier', { session_id: params.session_id }, options);
  }

  public connectProxy<TMessage = unknown>(
    params: ProxyConnectParams = {},
    options: WebSocketConnectionOptions<TMessage> = {}
  ): WebSocket {
    return this.connect<TMessage>(
      'proxy',
      { host: params.host, port: params.port, protocol: params.protocol },
      options
    );
  }

  public sendRevealConfig(socket: WebSocket, config: RevealConfig): void {
    socket.send(JSON.stringify({ type: 'RevealConfig', ...config }));
  }

  private connect<TMessage = unknown>(
    endpoint: AttesterEndpoint,
    params?: Record<string, string | number | boolean | undefined>,
    options: WebSocketConnectionOptions<TMessage> = {}
  ): WebSocket {
    const WebSocketCtor = requireWebSocket(this.webSocketImpl);
    const url = appendQuery(normalizeWsUrl(this.baseUrl, `/${endpoint}`), {
      ...params,
      token: this.token
    });
    const socket = new WebSocketCtor(url, options.protocols);

    socket.addEventListener('open', () => options.onOpen?.(socket));
    socket.addEventListener('message', (event: MessageEvent) => {
      options.onMessage?.(parseSocketMessage<TMessage>(event), event);
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

    return socket;
  }

  private extractRegisterResponse(message: unknown): RegisterResponse | undefined {
    if (!message || typeof message !== 'object') {
      return undefined;
    }
    const candidate = message as Record<string, unknown>;
    if (typeof candidate['session_id'] === 'string') {
      return { session_id: candidate['session_id'] };
    }
    const payload = candidate['payload'];
    if (payload && typeof payload === 'object') {
      const nested = payload as Record<string, unknown>;
      if (typeof nested['session_id'] === 'string') {
        return { session_id: nested['session_id'] };
      }
    }
    return undefined;
  }
}
