export enum SDKErrorCode {
  InvalidArgument = 'INVALID_ARGUMENT',
}

export enum SDKWarningCode {}

export enum RPCErrorCode {
  // Standard JSON RPC 2.0 Error Codes
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,
}

export type ErrorCode = SDKErrorCode | RPCErrorCode;
export type WarningCode = SDKWarningCode;
