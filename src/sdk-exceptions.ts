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

  public data: any

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

export function createRpcError(code: RPCErrorCode, message: string, data?: any): MagicRPCError {
  return new MagicRPCError({ code, message, data })
}
