/**
 * Newton SDK error types.
 */

import type { JsonRpcError } from "./types.js";

export class NewtonSDKError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "NewtonSDKError";
  }
}

export class JsonRpcError_ extends NewtonSDKError {
  public readonly code: number;
  public readonly data?: unknown;

  constructor(err: JsonRpcError) {
    super(err.message);
    this.name = "JsonRpcError";
    this.code = err.code;
    this.data = err.data;
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
