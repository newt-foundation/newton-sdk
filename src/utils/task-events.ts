import { GatewayError, SDKError } from '@core/sdk-exceptions'
import { SDKErrorCode } from '@core/types/core/exception-types'

/** Offered on every connection; the gateway accepts the upgrade by echoing it. */
const WS_SUBPROTOCOL = 'newton.v1'
/** Browsers cannot set headers on a WebSocket, so a `newt_createWsTicket` ticket travels as a subprotocol. */
const WS_TICKET_SUBPROTOCOL_PREFIX = 'newton.ticket.'
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
 * Opens the gateway's task-event stream once the upgrade succeeds. A ticket lasts a minute and is spent on the
 * upgrade, so open the stream right after minting it. Subscribe with the `subscription_topic` from newt_sendTask.
 *
 * @param {string} wsUrl - e.g. "wss://gateway.testnet.newton.xyz/ws"
 * @param {string} ticket - From `newt_createWsTicket`; sent as a subprotocol, never in the URL
 */
export async function openTaskEventsWebSocket(wsUrl: string, ticket: string): Promise<WebSocket> {
  // checked before the constructor, whose SyntaxError would print the protocol, ticket included
  if (!SUBPROTOCOL_TOKEN.test(ticket)) {
    throw new SDKError(SDKErrorCode.MalformedResponse, `cannot open ${wsUrl}: the gateway sent an unusable ticket`)
  }
  const ws = new WebSocket(wsUrl, [WS_SUBPROTOCOL, `${WS_TICKET_SUBPROTOCOL_PREFIX}${ticket}`])
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener(
      'error',
      // browsers hide the upgrade's status, so a refused ticket and a network failure look the same
      () => reject(new GatewayError('ws', 0, 'ws_upgrade_failed', `cannot open ${wsUrl}`)),
      { once: true },
    )
  })
  return ws
}

/** Subscribes an open task-event stream to a task, by the bare lowercase hex `subscription_topic` of newt_sendTask. */
export function subscribeToTask(ws: WebSocket, subscriptionTopic: string): void {
  ws.send(JSON.stringify({ type: 'subscribe', id: 'sub-1', method: subscriptionTopic, params: null }))
}
