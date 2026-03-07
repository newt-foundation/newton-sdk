import type { RPCErrorCode } from '@core/types'

// --- Request interfaces

export interface JsonRpcRequestPayload<TParams = any> {
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
  data?: any
}

export interface JsonRpcResponsePayload<ResultType = any> {
  jsonrpc: string
  id: string | number | null
  result?: ResultType | null
  error?: JsonRpcError | null
}

export enum NewtonWalletPayloadMethod {
  // Wallet methods
  ShowUI = 'newton_wallet_wallet',
  Receive = 'newton_wallet_wallet_receive',
  PersonalSign = 'personal_sign',
  SendUserOperation = 'eth_sendUserOperation',

  // User methods
  Connect = 'newton_wallet_user_connect',
  Disconnect = 'newton_wallet_user_disconnect',
  IsConnected = 'newton_wallet_user_is_connected',
  GetConnectedProfile = 'newton_wallet_user_get_connected_profile',
}
