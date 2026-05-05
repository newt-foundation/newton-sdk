import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AttesterClient } from "./attester.js";
import type { HandlerResult } from "./types.js";

class MockWebSocket {
  static instances: MockWebSocket[] = [];

  readonly url: string;
  readonly sent: string[] = [];
  readyState = 1;
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  onclose: ((ev: unknown) => void) | null = null;
  close = vi.fn(() => {
    this.readyState = 3;
    this.onclose?.({});
  });

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  emitOpen(): void {
    this.onopen?.({});
  }

  emitMessage(data: unknown): void {
    this.onmessage?.({
      data: typeof data === "string" ? data : JSON.stringify(data),
    });
  }

  emitError(ev: unknown): void {
    this.onerror?.(ev);
  }

  static latest(): MockWebSocket {
    const ws = MockWebSocket.instances.at(-1);
    if (!ws) {
      throw new Error("Expected a MockWebSocket instance");
    }
    return ws;
  }
}

describe("AttesterClient WebSocket lifecycle", () => {
  let client: AttesterClient;

  beforeEach(() => {
    MockWebSocket.instances = [];
    client = new AttesterClient({
      gatewayUrl: "http://localhost:8080",
      attesterUrl: "http://localhost:7047",
      timeout: 50,
    });
    client.setWebSocket(MockWebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("createSession sends registration and closes after sessionRegistered", async () => {
    const pending = client.createSession({ maxRecvData: 32, maxSentData: 16 });
    const ws = MockWebSocket.latest();

    expect(ws.url).toBe("ws://localhost:7047/session");
    ws.emitOpen();
    expect(JSON.parse(ws.sent[0])).toEqual({
      type: "register",
      maxRecvData: 32,
      maxSentData: 16,
    });

    ws.emitMessage({ type: "sessionRegistered", sessionId: "session-1" });

    await expect(pending).resolves.toMatchObject({
      sessionId: "session-1",
      verifierUrl: "ws://localhost:7047/verifier?sessionId=session-1",
    });
    expect((await pending).proxyUrl("api.x.com")).toBe(
      "ws://localhost:7047/proxy?token=api.x.com&session=session-1",
    );
    expect(ws.close).toHaveBeenCalledTimes(1);
  });

  it("createSession rejects and closes on server error messages", async () => {
    const pending = client.createSession();
    const ws = MockWebSocket.latest();

    ws.emitOpen();
    ws.emitMessage({ type: "error", message: "registration failed" });

    await expect(pending).rejects.toThrow("registration failed");
    expect(ws.close).toHaveBeenCalledTimes(1);
  });

  it("reveal sends revealConfig and closes after sessionCompleted", async () => {
    const pending = client.reveal("ws://localhost:7047/session/session-1", {
      sent: [],
      recv: [],
    });
    const ws = MockWebSocket.latest();
    const results: HandlerResult[] = [
      { type: "RECV", part: "BODY", value: "{\"followers_count\":1000}" },
    ];

    ws.emitOpen();
    expect(JSON.parse(ws.sent[0])).toEqual({
      type: "revealConfig",
      sent: [],
      recv: [],
    });

    ws.emitMessage({ type: "sessionCompleted", results });

    await expect(pending).resolves.toEqual(results);
    expect(ws.close).toHaveBeenCalledTimes(1);
  });

  it("reveal rejects with WebSocket diagnostic details and closes", async () => {
    const pending = client.reveal("ws://localhost:7047/session/session-1", {
      sent: [],
      recv: [],
    });
    const ws = MockWebSocket.latest();

    ws.emitError({
      message: "socket failed",
      code: 1006,
      error: new Error("ECONNRESET"),
    });

    await expect(pending).rejects.toThrow(
      "WebSocket error: message=socket failed, code=1006, error.message=ECONNRESET",
    );
    expect(ws.close).toHaveBeenCalledTimes(1);
  });

  it("createSession closes and rejects on timeout", async () => {
    vi.useFakeTimers();
    const pending = client.createSession();
    const assertion = expect(pending).rejects.toThrow(
      "Request timed out after 50ms",
    );
    const ws = MockWebSocket.latest();

    await vi.advanceTimersByTimeAsync(50);

    await assertion;
    expect(ws.close).toHaveBeenCalledTimes(1);
  });
});
