export enum SDKErrorCode {
  /** @deprecated The SDK never throws this code. */
  MissingApiKey = 'MISSING_API_KEY',
  PopupAlreadyExists = 'POPUP_ALREADY_EXISTS',
  MalformedResponse = 'MALFORMED_RESPONSE',
  InvalidArgument = 'INVALID_ARGUMENT',
  /** @deprecated The SDK never throws this code. */
  ExtensionNotInitialized = 'EXTENSION_NOT_INITIALIZED',
  /** @deprecated The SDK never throws this code. */
  IncompatibleExtensions = 'INCOMPATIBLE_EXTENSIONS',
  /** @deprecated The SDK never throws this code. */
  FailedToOpenPopup = 'FAILED_TO_OPEN_POPUP',
  /** @deprecated The SDK never throws this code. */
  FailedToRetrieveNativeTokenBalance = 'FAILED_TO_RETRIEVE_NATIVE_TOKEN_BALANCE',
  MissingChain = 'MISSING_CHAIN',
  MissingAccount = 'MISSING_ACCOUNT',
  InvalidAddress = 'INVALID_ADDRESS',
}

export enum SDKWarningCode {
  SyncWeb3Method = 'SYNC_WEB3_METHOD',
  ReactNativeEndpointConfiguration = 'REACT_NATIVE_ENDPOINT_CONFIGURATION',
  DeprecationNotice = 'DEPRECATION_NOTICE',
  ProductAnnouncement = 'ANNOUNCEMENT',
}

export enum RPCErrorCode {
  // Standard JSON RPC 2.0 Error Codes
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,

  // Custom RPC Error Codes
  MagicLinkRateLimited = -10002,
  UserAlreadyLoggedIn = -10003,
  AccessDeniedToUser = -10011,
  UserRejectedAction = -10012,
  RequestCancelled = -10014,
  RedirectLoginComplete = -10015,
  NewtonWalletSessionTerminated = -10016,
  PopupRequestOverriden = -10017,
}

export type ErrorCode = SDKErrorCode | RPCErrorCode
export type WarningCode = SDKWarningCode
