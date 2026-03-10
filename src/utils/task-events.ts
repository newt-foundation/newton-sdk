/**
 * Subscribe to Newton Gateway WebSocket events for a given subscription topic.
 * Use the subscription_topic returned from newt_sendTask.
 *
 * @param {string} wsUrl - e.g. "wss://gateway.testnet.newton.xyz/ws"
 * @param {string} subscriptionTopic - From newt_sendTask result (e.g. "newton.task.0x...")
 * @param {Object} options - Optional: { apiKey?: string, onEvent?: (event) => void }
 */
export function getTaskEventsWebSocket(wsUrl: string, subscriptionTopic: string, apiKey: string) {
  const url = `${wsUrl}?api_key=${encodeURIComponent(apiKey)}`
  const ws = new WebSocket(url)

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
