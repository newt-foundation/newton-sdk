import { beforeEach, describe, expect, it } from 'vitest';
import { AttesterClient } from '../src';
import { MockWebSocket, mockWebSocketConstructor } from './helpers';

describe('AttesterClient', () => {
  beforeEach(() => MockWebSocket.reset());

  it('creates an MPC-TLS session by sending Register and reading session_id', async () => {
    const client = new AttesterClient({
      baseUrl: 'https://attester.example',
      token: 'attester-token',
      WebSocket: mockWebSocketConstructor()
    });

    const sessionPromise = client.createSession({ max_recv_data: 4096, max_sent_data: 2048 });
    const socket = MockWebSocket.instances[0];
    expect(socket?.url).toBe('wss://attester.example/session?token=attester-token');

    socket?.emitOpen();
    expect(socket?.sent).toEqual([JSON.stringify({ type: 'Register', max_recv_data: 4096, max_sent_data: 2048 })]);
    socket?.emitMessage({ type: 'Registered', session_id: 'session-1' });

    await expect(sessionPromise).resolves.toMatchObject({ session_id: 'session-1', socket });
  });

  it('connects verifier/proxy endpoints and sends reveal config', () => {
    const client = new AttesterClient({ baseUrl: 'http://attester.example/api', WebSocket: mockWebSocketConstructor() });

    const verifier = client.connectVerifier({ session_id: 'session-1' });
    const proxy = client.connectProxy({ host: 'example.com', port: 443, protocol: 'tls' });

    expect(MockWebSocket.instances[0]?.url).toBe('ws://attester.example/api/verifier?session_id=session-1');
    expect(MockWebSocket.instances[1]?.url).toBe('ws://attester.example/api/proxy?host=example.com&port=443&protocol=tls');

    client.sendRevealConfig(verifier, {
      ranges: [
        { range: [0, 32], handler: { handler_type: 'Recv', handler_part: 'Headers' } },
        { range: { start: 33, end: 64 }, handler: { handler_type: 'Sent', handler_part: 'Body' } }
      ]
    });

    expect(proxy).toBe(MockWebSocket.instances[1]);
    expect(MockWebSocket.instances[0]?.sent[0]).toContain('RevealConfig');
  });
});
