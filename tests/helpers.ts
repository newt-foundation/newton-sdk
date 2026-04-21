export class MockWebSocket extends EventTarget {
  public static instances: MockWebSocket[] = [];
  public readonly url: string;
  public readonly protocols: string | string[] | undefined;
  public sent: string[] = [];
  public readyState = 0;
  public closeCode: number | undefined;
  public closeReason: string | undefined;

  public constructor(url: string | URL, protocols?: string | string[]) {
    super();
    this.url = String(url);
    this.protocols = protocols;
    MockWebSocket.instances.push(this);
  }

  public send(data: string): void {
    this.sent.push(data);
  }

  public close(code?: number, reason?: string): void {
    this.closeCode = code;
    this.closeReason = reason;
    this.readyState = 3;
    this.dispatchEvent(
      createCloseEvent({
        ...(code === undefined ? {} : { code }),
        ...(reason === undefined ? {} : { reason }),
        wasClean: true
      })
    );
  }

  public emitOpen(): void {
    this.readyState = 1;
    this.dispatchEvent(new Event('open'));
  }

  public emitMessage(data: unknown): void {
    const serialized = typeof data === 'string' ? data : JSON.stringify(data);
    this.dispatchEvent(createMessageEvent(serialized));
  }

  public emitError(): void {
    this.dispatchEvent(new Event('error'));
  }

  public emitClose(code = 1000, reason = '', wasClean = true): void {
    this.readyState = 3;
    this.dispatchEvent(createCloseEvent({ code, reason, wasClean }));
  }

  public static reset(): void {
    MockWebSocket.instances = [];
  }
}

function createMessageEvent(data: string): MessageEvent {
  if (typeof MessageEvent !== 'undefined') {
    return new MessageEvent('message', { data });
  }
  const event = new Event('message') as MessageEvent & { data: string };
  Object.defineProperty(event, 'data', { value: data });
  return event;
}

function createCloseEvent(init: { code?: number; reason?: string; wasClean: boolean }): CloseEvent {
  const closeInit: CloseEventInit = {
    wasClean: init.wasClean,
    ...(init.code === undefined ? {} : { code: init.code }),
    ...(init.reason === undefined ? {} : { reason: init.reason })
  };
  if (typeof CloseEvent !== 'undefined') {
    return new CloseEvent('close', closeInit);
  }
  const event = new Event('close') as CloseEvent & { code: number; reason: string; wasClean: boolean };
  Object.defineProperties(event, {
    code: { value: init.code ?? 1000 },
    reason: { value: init.reason ?? '' },
    wasClean: { value: init.wasClean }
  });
  return event;
}

export function mockWebSocketConstructor(): typeof WebSocket {
  return MockWebSocket as unknown as typeof WebSocket;
}

export function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init
  });
}
