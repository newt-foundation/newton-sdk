import { GATEWAY_API_URLS } from '@core/const'
import { GatewayError } from '@core/sdk-exceptions'
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

  constructor(chainId: number, urlOverride?: string) {
    this.baseUrl = urlOverride || GATEWAY_API_URLS[chainId]
  }

  /** Sends one JSON-RPC request; throws `GatewayError` unless the gateway answers with a `result`. */
  async Post(method: string, args: unknown, apiKey: string) {
    const body = createJsonRpcRequestPayload(method, args)
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
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
