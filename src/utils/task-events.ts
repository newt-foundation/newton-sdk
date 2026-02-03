/**
 * Subscribe to Newton Gateway WebSocket events for a given subscription topic.
 * Use the subscription_topic returned from newt_sendTask.
 *
 * @param {string} wsUrl - e.g. "wss://gateway-avs.sepolia.newt.foundation/ws"
 * @param {string} subscriptionTopic - From newt_sendTask result (e.g. "newton.task.0x...")
 * @param {Object} options - Optional: { apiKey?: string, onEvent?: (event) => void }
 */
export function subscribeToTaskEvents(
  wsUrl: string,
  subscriptionTopic: string,
  options: { apiKey?: string; onEvent?: (event: any) => void } = {},
) {
  const { apiKey, onEvent } = options;

  const url = apiKey ? `${wsUrl}?api_key=${encodeURIComponent(apiKey)}` : wsUrl;
  const ws = new WebSocket(url);

  ws.onopen = () => {
    console.log('WebSocket connected');

    // If not using query param, authenticate after connect
    if (apiKey && !url.includes('api_key')) {
      ws.send(
        JSON.stringify({
          type: 'authenticate',
          api_key: apiKey,
        }),
      );
    }

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

  ws.onmessage = event => {
    const msg = JSON.parse(event.data);
    let payload: any;

    switch (msg.type) {
      case 'subscribed':
        console.log('Newton SDK Subscribed:', msg.id);
        break;
      case 'update':
        // Task update: status, success with response_transaction_hash, or failure
        payload = msg.result;
        if (payload?.data) {
          const { status, result, error, progress } = payload.data;
          console.log(' Newton SDK Task update:', { status, progress, result, error });
          if (onEvent) onEvent({ type: 'update', ...payload });
        }
        break;
      case 'response':
        if (msg.result?.authenticated) {
          console.log('Newton SDK Authenticated:', msg.result.api_key_name);
        }
        break;
      case 'error':
        console.error('Newton SDK WebSocket error:', msg.message);
        if (onEvent) onEvent({ type: 'error', message: msg.message });
        break;
      case 'pong':
        break;
      default:
        console.log('Newton SDK Message:', msg);
    }
  };

  ws.onerror = err => console.error('Newton SDK WebSocket error', err);
  ws.onclose = () => console.log('Newton SDK WebSocket closed');

  return ws;
}

// --- Example usage ---

const WS_URL = 'wss://gateway-avs.sepolia.newt.foundation/ws';
const API_KEY = 'your-api-key';

// After calling newt_sendTask you get something like:
// { task_id, subscription_topic: "newton.task.0x1234...", message, timestamp }
const subscriptionTopic = 'newton.task.0x1234567890abcdef...'; // use actual value from response

export const ws = subscribeToTaskEvents(WS_URL, subscriptionTopic, {
  apiKey: API_KEY,
  onEvent: event => {
    if (event.type === 'update') {
      const { status, result, error } = event.data || {};
      if (status === 'success' && result?.response_transaction_hash) {
        console.log('Recorded on-chain:', result.response_transaction_hash);
      }
      if (status === 'failed' && error) {
        console.error('Task failed:', error);
      }
    }
  },
});

// Later: ws.close();
