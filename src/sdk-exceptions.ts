import { RPCErrorCode, type SDKErrorCode } from './types/core/exception-types'
import type { JsonRpcError } from './types/core/json-rpc-types'

function isNil(value: unknown): value is null | undefined {
  return value == null // This checks for both null and undefined
}

function isJsonRpcErrorCode(value?: unknown): value is RPCErrorCode {
  if (isNil(value)) return false
  return typeof value === 'number' && Object.values(RPCErrorCode).includes(value)
}

export class SDKError extends Error {
  __proto__ = Error

  constructor(
    public code: SDKErrorCode,
    public rawMessage: string,
  ) {
    super(`SDK Error: [${code}] ${rawMessage}`)
    Object.setPrototypeOf(this, SDKError.prototype)
  }
}

export class MagicRPCError extends Error {
  __proto__ = Error

  public code: RPCErrorCode | number

  public rawMessage: string

  public data: unknown

  constructor(sourceError?: JsonRpcError | null) {
    super()

    const codeNormalized = Number(sourceError?.code)
    this.rawMessage = sourceError?.message || 'Internal error'
    this.code = isJsonRpcErrorCode(codeNormalized) ? codeNormalized : RPCErrorCode.InternalError
    this.message = `Newton Wallet RPC Error: [${this.code}] ${this.rawMessage}`
    this.data = sourceError?.data || undefined

    Object.setPrototypeOf(this, MagicRPCError.prototype)
  }
}

export function createRpcError(code: RPCErrorCode, message: string, data?: unknown): MagicRPCError {
  return new MagicRPCError({ code, message, data })
}

/**
 * A failed newton-delegator call: a non-2xx answer, where `code` is the delegator's error code (see
 * `DelegatorErrorCode`), or a 2xx body that is not a JSON object, with code `malformed_response`.
 */
export class DelegatorError extends Error {
  /** For `unauthorized`, why the request did not authenticate, e.g. `stale_timestamp` or `wrong_audience`. */
  public reason?: string

  constructor(
    public status: number,
    public code: string,
    public rawMessage: string,
    public details?: unknown,
  ) {
    super(`Newton SDK: delegator returned ${status} [${code}] ${rawMessage}`)
    const reason = (details as { reason?: unknown } | undefined)?.reason
    if (typeof reason === 'string') this.reason = reason
    this.name = 'DelegatorError'
    Object.setPrototypeOf(this, DelegatorError.prototype)
  }
}
