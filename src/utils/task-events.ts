import { SDKError } from '@core/sdk-exceptions'
import { SDKErrorCode } from '@core/types/core/exception-types'

/** Offered on every connection; the gateway accepts the upgrade by echoing it. */
const WS_SUBPROTOCOL = 'newton.v1'
/** Browsers cannot set headers on a WebSocket, so the API key travels as a `newton.bearer.<key>` subprotocol. */
const WS_BEARER_SUBPROTOCOL_PREFIX = 'newton.bearer.'
/** RFC 7230 token characters, the only ones a subprotocol may hold. */
const SUBPROTOCOL_TOKEN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/

/** The gateway's `/ws` endpoint beside its JSON-RPC URL: same host, port and path prefix, `ws:` for `http:`. */
export function getTaskEventsUrl(gatewayApiUrl: string): string {
  const url = new URL(gatewayApiUrl)
  url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:'
  url.pathname = url.pathname.replace(/(\/rpc)?\/?$/, '/ws')
  url.search = ''
  url.hash = ''
  return url.toString()
}

/**
 * Throws when the API key cannot travel as a subprotocol. Checked before the WebSocket constructor, whose SyntaxError
 * would print the protocol, key included.
 */
export function assertWebSocketApiKey(apiKey: string, target: string): void {
  if (!SUBPROTOCOL_TOKEN.test(apiKey)) {
    throw new SDKError(
      SDKErrorCode.InvalidArgument,
      `cannot subscribe to ${target}: ${apiKey ? 'the API key holds characters a WebSocket subprotocol cannot carry' : 'the API key is empty'}`,
    )
  }
}

/**
 * Subscribe to Newton Gateway WebSocket events for a given subscription topic.
 * Use the subscription_topic returned from newt_sendTask.
 *
 * @param {string} wsUrl - e.g. "wss://gateway.testnet.newton.xyz/ws"
 * @param {string} subscriptionTopic - From the newt_sendTask result: the task id as bare lowercase hex, no `0x`
 * @param {string} apiKey - Gateway API key, sent as a subprotocol and never in the URL
 */
export function getTaskEventsWebSocket(wsUrl: string, subscriptionTopic: string, apiKey: string) {
  assertWebSocketApiKey(apiKey, `task ${subscriptionTopic} at ${wsUrl}`)
  const ws = new WebSocket(wsUrl, [WS_SUBPROTOCOL, `${WS_BEARER_SUBPROTOCOL_PREFIX}${apiKey}`])

  ws.onopen = () => {
    // Subscribe to the task topic
    ws.send(
      JSON.stringify({
        type: 'subscribe',
        id: 'sub-1',
        method: subscriptionTopic,
        params: null,
      }),
    )
  }

  ws.onerror = () => {}
  ws.onclose = () => {}

  return ws
}
