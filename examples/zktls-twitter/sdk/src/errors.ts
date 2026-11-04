/**
 * Newton SDK error types.
 */

export class NewtonSDKError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "NewtonSDKError";
  }
}

/**
 * A gateway JSON-RPC call that failed. `code` is the gateway error variant
 * (`InvalidRequest`, `RateLimitExceeded`, ...) or, for a response without a
 * JSON error body, `http_error`, `malformed_response` or `response_too_large`.
 */
export class RpcError extends NewtonSDKError {
  public readonly method: string;
  public readonly status: number;
  public readonly code: string;
  public readonly data?: unknown;

  constructor(method: string, status: number, code: string, message: string, data?: unknown) {
    super(`gateway ${method} returned ${status} [${code}] ${message}`);
    this.name = "RpcError";
    this.method = method;
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

export class TimeoutError extends NewtonSDKError {
  constructor(ms: number) {
    super(`Request timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

export class SessionError extends NewtonSDKError {
  constructor(message: string) {
    super(message);
    this.name = "SessionError";
  }
}
