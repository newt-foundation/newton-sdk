import { GATEWAY_API_URLS } from '@core/const'
import { NEWTON_AUTH_HEADER, signNewtonRequest } from '@core/modules/delegator/auth'
import { GatewayError, SDKError } from '@core/sdk-exceptions'
import { SDKErrorCode } from '@core/types/core/exception-types'
import type { GatewayAuth } from '@core/types/delegator'
import { createJsonRpcRequestPayload } from './json-rpc'

/** A proxy or captive portal can answer with a whole HTML page; errors carry only its start. */
const MAX_BODY_IN_ERROR = 4096

/** The gateway's serde-tagged error: a unit variant is a bare string, any other variant a one-key object. */
function parseGatewayError(error: unknown): { code: string; message: string; data?: unknown } {
  if (typeof error === 'string') return { code: error, message: error }
  const entries = error && typeof error === 'object' ? Object.entries(error) : []
  if (entries.length === 1) {
    const [code, data] = entries[0]
    return { code, message: typeof data === 'string' ? data : JSON.stringify(data), data }
  }
  return { code: 'unknown_error', message: JSON.stringify(error), data: error }
}

// Destination chains sign under their network's source chain; a source chain under itself.
const SOURCE_CHAIN: Record<number, number> = {
  8453: 1,
  4663: 1,
  5042: 1,
  84532: 11155111,
  46630: 11155111,
  5042002: 11155111,
  31338: 31337,
}

const U64_MAX = 2n ** 64n - 1n

/** A u64 as serde reads one: a non-negative integer, or a decimal or `0x` hex string. */
function parseChainId(value: unknown): number | undefined {
  const big =
    typeof value === 'number' && Number.isInteger(value)
      ? BigInt(value)
      : typeof value === 'string' && /^(0x[0-9a-fA-F]+|[0-9]+)$/.test(value)
        ? BigInt(value)
        : undefined
  return big !== undefined && big >= 0n && big <= U64_MAX ? Number(big) : undefined
}

/**
 * The chain the params name, read as the gateway's `auth_chain_id` does, else the source chain of `chainId`. The
 * first key present decides, even when its value does not parse; a key holding `undefined` is absent on the wire.
 */
function authChainId(params: unknown, chainId: number): number {
  // biome-ignore lint/suspicious/noExplicitAny: arbitrary JSON-RPC params
  const p: any = Array.isArray(params) ? params[0] : params
  const named = [p?.chain_id, p?.chainId, p?.intent?.chainId, p?.intent?.chain_id].find(v => v !== undefined)
  return parseChainId(named) ?? SOURCE_CHAIN[chainId] ?? chainId
}

function parseJson(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    // status-only rejections (401 bad key, 408, 413, 503) and proxies answer with an empty or text body
    return undefined
  }
}

export class AvsHttpService {
  public baseUrl

  constructor(
    private chainId: number,
    urlOverride?: string,
  ) {
    this.baseUrl = urlOverride || GATEWAY_API_URLS[chainId]
  }

  /**
   * Sends one signed JSON-RPC request; throws `SDKError` when it cannot be signed and `GatewayError` unless the
   * gateway answers with a `result`.
   */
  async Post(method: string, args: unknown, { signer, session }: GatewayAuth) {
    const body = JSON.stringify(createJsonRpcRequestPayload(method, args))
    const signature = await signNewtonRequest(signer, {
      method,
      body,
      chainId: authChainId(args, this.chainId),
      session,
    }).catch(error => {
      if (error instanceof SDKError) throw error
      throw new SDKError(SDKErrorCode.SigningFailed, `cannot sign ${method}: ${error?.message ?? error}`)
    })
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [NEWTON_AUTH_HEADER]: signature },
      body,
    })
    const text = await response.text()
    const payload = parseJson(text)
    // shortcut: delta-seconds only, which is what the gateway sends; an HTTP-date from a proxy is dropped
    const retryAfterHeader = response.headers.get('retry-after')
    const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : Number.NaN
    const retryAfter = Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined

    if (payload?.error != null) {
      const { code, message, data } = parseGatewayError(payload.error)
      throw new GatewayError(method, response.status, code, message, data, retryAfter)
    }
    if (!response.ok) {
      throw new GatewayError(
        method,
        response.status,
        'http_error',
        text.slice(0, MAX_BODY_IN_ERROR) || response.statusText || 'empty body',
        undefined,
        retryAfter,
      )
    }
    // a method can answer with a null result, so only a body without the key is malformed
    if (payload == null || typeof payload !== 'object' || !('result' in payload)) {
      throw new GatewayError(
        method,
        response.status,
        'malformed_response',
        `expected a JSON-RPC result from ${this.baseUrl}`,
        text.slice(0, MAX_BODY_IN_ERROR),
      )
    }
    return payload
  }
}
