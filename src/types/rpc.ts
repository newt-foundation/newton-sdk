export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

export type JsonRpcId = string | number | null;
export type JsonRpcParams = unknown;

export interface JsonRpcRequest<TParams = JsonRpcParams> {
  jsonrpc: '2.0';
  method: NewtonRpcMethod | string;
  params?: TParams;
  id: JsonRpcId;
}

export interface JsonRpcSuccessResponse<TResult = unknown> {
  jsonrpc: '2.0';
  result: TResult;
  id: JsonRpcId;
}

export interface JsonRpcErrorObject {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcErrorResponse {
  jsonrpc: '2.0';
  error: JsonRpcErrorObject;
  id: JsonRpcId;
}

export type JsonRpcResponse<TResult = unknown> =
  | JsonRpcSuccessResponse<TResult>
  | JsonRpcErrorResponse;

export type NewtonRpcMethod =
  | 'newt_createTask'
  | 'newt_sendTask'
  | 'newt_simulateTask'
  | 'newt_storeEncryptedSecrets'
  | 'newt_simulatePolicyData'
  | 'newt_simulatePolicyDataWithClient'
  | 'newt_simulatePolicy'
  | 'newt_registerWebhook'
  | 'newt_unregisterWebhook';

export interface RpcRequestOptions {
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface NewtonErrorDetails {
  code?: string | number;
  message: string;
  data?: unknown;
}
