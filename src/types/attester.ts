import type { JsonObject, JsonValue } from './rpc';

export interface RegisterRequest {
  max_recv_data: number;
  max_sent_data: number;
}

export interface RegisterResponse {
  session_id: string;
}

export type RevealHandlerType = 'Sent' | 'Recv';
export type RevealHandlerPart = 'StartLine' | 'Headers' | 'Body';
export type ByteRange = readonly [start: number, end: number] | { start: number; end: number };

export interface RevealHandler {
  handler_type: RevealHandlerType;
  handler_part: RevealHandlerPart;
}

export interface RangeWithHandler {
  range: ByteRange;
  handler: RevealHandler;
}

export interface RevealConfig {
  ranges: RangeWithHandler[];
}

export type AttesterEndpoint = 'session' | 'verifier' | 'proxy';

export interface AttesterSession {
  session_id: string;
  socket: WebSocket;
  close: (code?: number, reason?: string) => void;
}

export interface ProxyConnectParams {
  host?: string;
  port?: number;
  protocol?: 'tcp' | 'tls';
}

export interface VerifierConnectParams {
  session_id?: string;
}

export interface WebSocketHandlers<TMessage = unknown> {
  onOpen?: (socket: WebSocket) => void;
  onMessage?: (message: TMessage, event: MessageEvent) => void;
  onError?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
}

export interface WebSocketConnectionOptions<TMessage = unknown> extends WebSocketHandlers<TMessage> {
  protocols?: string | string[];
  signal?: AbortSignal;
}

export interface AttesterMessage<TPayload extends JsonValue = JsonValue> extends JsonObject {
  type: string;
  payload?: TPayload;
}
