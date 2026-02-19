/**
 * Subscribe to Newton Gateway WebSocket events for a given subscription topic.
 * Use the subscription_topic returned from newt_sendTask.
 *
 * @param {string} wsUrl - e.g. "wss://gateway-avs.sepolia.newt.foundation/ws"
 * @param {string} subscriptionTopic - From newt_sendTask result (e.g. "newton.task.0x...")
 * @param {Object} options - Optional: { apiKey?: string, onEvent?: (event) => void }
 */
export function getTaskEventsWebSocket(wsUrl: string, subscriptionTopic: string, apiKey: string) {
  const url = `${wsUrl}?api_key=${encodeURIComponent(apiKey)}`;
  const ws = new WebSocket(url);

  ws.onopen = () => {
    console.log('WebSocket connected');

    // Subscribe to the task topic
    ws.send(
      JSON.stringify({
        type: 'subscribe',
        id: 'sub-1',
        method: subscriptionTopic,
        params: null,
      }),
    );
  };

  ws.onerror = err => console.error('Newton SDK WebSocket error', err);
  ws.onclose = () => console.log('Newton SDK WebSocket closed');

  return ws;
}
