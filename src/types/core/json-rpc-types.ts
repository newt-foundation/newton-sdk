import type { RPCErrorCode } from '@core/types'

// --- Request interfaces

export interface JsonRpcRequestPayload<TParams = unknown> {
  jsonrpc: string
  id: string | number | null
  method: string
  params?: TParams
}

/** Callback executed upon JSON RPC response. */
export type JsonRpcRequestCallback = (err: JsonRpcError | null, result?: JsonRpcResponsePayload | null) => void

/** Callback executed upon JSON RPC response. */
export type JsonRpcBatchRequestCallback = (
  err: JsonRpcError | null,
  result?: (JsonRpcResponsePayload | null)[] | null,
) => void

// -- Params interfaces
export interface ShowUIParams {
  page?: 'swap' | string
}

// --- Response interfaces

export interface JsonRpcError {
  message: string
  code: RPCErrorCode
  data?: unknown
}

export interface JsonRpcResponsePayload<ResultType = unknown> {
  jsonrpc: string
  id: string | number | null
  result?: ResultType | null
  error?: JsonRpcError | null
}

export enum NewtonIdpPayloadMethod {
  Connect = 'newton_vc_user_connect',
  Unlink = 'newton_vc_user_unlink',
  RegisterUserData = 'newton_vc_user_register_user_data',
  LinkApp = 'newton_vc_user_link_app',
}
