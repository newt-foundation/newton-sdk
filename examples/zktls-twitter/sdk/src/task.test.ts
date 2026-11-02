import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaskManager } from "./task.js";
import type { GatewayClient } from "./gateway.js";
import type { TaskIntent, TaskStatus, TaskUpdateEvent } from "./types.js";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

class MockWebSocket {
  static instances: MockWebSocket[] = [];

  readonly url: string;
  readonly protocols: string | string[] | undefined;
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  onclose: ((ev: unknown) => void) | null = null;
  send = vi.fn();
  close = vi.fn(() => {
    this.onclose?.({});
  });

  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    this.protocols = protocols;
    MockWebSocket.instances.push(this);
  }

  emitOpen(): void {
    this.onopen?.({});
  }

  emitMessage(data: unknown): void {
    this.onmessage?.({
      data: typeof data === "string" ? data : JSON.stringify(data),
    });
  }

  /** Wraps the event the way the gateway does: an `update` frame whose `result` is the event. */
  emitUpdate(event: TaskUpdateEvent): void {
    this.emitMessage({ type: "update", subscription_id: "server-sub-id", result: event, error: null });
  }

  emitError(ev: unknown): void {
    this.onerror?.(ev);
  }

  emitClose(ev: unknown): void {
    this.onclose?.(ev);
  }

  static latest(): MockWebSocket {
    const ws = MockWebSocket.instances.at(-1);
    if (!ws) {
      throw new Error("Expected a MockWebSocket instance");
    }
    return ws;
  }
}

const intent: TaskIntent = {
  from: "0x0000000000000000000000000000000000000000",
  to: "0x0000000000000000000000000000000000000000",
  value: "0x0",
  data: "0x",
  chainId: "0x1",
  functionSignature: "0x",
};

const TOPIC = "ab".repeat(32);
const TASK_ID = `0x${TOPIC}`;

function taskEvent(status: TaskStatus, extra: Partial<TaskUpdateEvent["data"]> = {}): TaskUpdateEvent {
  return {
    event: "status_update",
    task_id: TASK_ID,
    timestamp: 123,
    data: { status, operator_responses: [], progress: 50, ...extra },
  };
}

function rpcResult(result: unknown): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", result, error: null, id: null }), { status: 200 });
}

describe("TaskManager", () => {
  let manager: TaskManager;

  beforeEach(() => {
    mockFetch.mockReset();
    MockWebSocket.instances = [];
    manager = new TaskManager({
      gatewayUrl: "http://localhost:8080",
      apiKey: "test-key",
    });
  });

  describe("createTask", () => {
    it("hex-encodes an object wasmArgs into a one-entry wasm_args list", async () => {
      mockFetch.mockResolvedValueOnce(rpcResult({ task_id: TASK_ID, status: "success", timestamp: 1 }));

      await manager.createTask({
        policyClient: "0x1111111111111111111111111111111111111111",
        intent,
        wasmArgs: { min_followers: 1000, twitter_username: "newton_protocol" },
        proofCid: "bafytest",
      });

      const [, fetchInit] = mockFetch.mock.calls[0];
      const params = JSON.parse(fetchInit.body).params;

      expect(params.wasm_args).toHaveLength(1);
      expect(params.wasm_args[0]).toMatch(/^0x[0-9a-f]+$/);
      const hex = params.wasm_args[0].slice(2);
      const bytes = new Uint8Array(
        hex.match(/.{1,2}/g)!.map((b: string) => parseInt(b, 16)),
      );
      const decoded = JSON.parse(new TextDecoder().decode(bytes));
      expect(decoded.min_followers).toBe(1000);
      expect(decoded.twitter_username).toBe("newton_protocol");
      // Deprecated, but still sent so the gateway's rejection reaches the caller.
      expect(params.proof_cid).toBe("bafytest");
      expect(params).not.toHaveProperty("use_two_phase");
    });

    it("sends a string wasmArgs as a one-entry list", async () => {
      mockFetch.mockResolvedValueOnce(rpcResult({ task_id: TASK_ID, status: "success", timestamp: 1 }));

      await manager.createTask({
        policyClient: "0x1111111111111111111111111111111111111111",
        intent,
        wasmArgs: "0xdeadbeef",
      });

      const [, fetchInit] = mockFetch.mock.calls[0];
      expect(JSON.parse(fetchInit.body).params.wasm_args).toEqual(["0xdeadbeef"]);
    });

    it("sends one wasm_args entry per policy for an array", async () => {
      mockFetch.mockResolvedValueOnce(rpcResult({ task_id: TASK_ID, status: "success", timestamp: 1 }));

      await manager.createTask({
        policyClient: "0x1111111111111111111111111111111111111111",
        intent,
        wasmArgs: ["0x", { a: 1 }],
      });

      const [, fetchInit] = mockFetch.mock.calls[0];
      expect(JSON.parse(fetchInit.body).params.wasm_args).toEqual(["0x", "0x7b2261223a317d"]);
    });

    it("sets default timeout to 60 seconds", async () => {
      mockFetch.mockResolvedValueOnce(rpcResult({ task_id: TASK_ID, status: "success", timestamp: 1 }));

      await manager.createTask({
        policyClient: "0x0000000000000000000000000000000000000000",
        intent,
      });

      const [, fetchInit] = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchInit.body);
      expect(body.params.timeout).toBe(60);
    });
  });

  describe("trackTask", () => {
    it("connects with the API key as a subprotocol and subscribes to the topic on open", () => {
      manager.setWebSocket(MockWebSocket);
      void manager.trackTask(TOPIC, undefined, 1_000).catch(() => {});
      const ws = MockWebSocket.latest();

      expect(ws.url).toBe("ws://localhost:8080/ws");
      expect(ws.protocols).toEqual(["newton.v1", "newton.bearer.test-key"]);
      expect(ws.send).not.toHaveBeenCalled();

      ws.emitOpen();

      expect(ws.send).toHaveBeenCalledTimes(1);
      expect(JSON.parse(ws.send.mock.calls[0][0])).toEqual({
        type: "subscribe",
        id: "sub-1",
        method: TOPIC,
        params: null,
      });
      ws.emitClose({});
    });

    it.each([
      ["http://localhost:8080/rpc", "ws://localhost:8080/ws"],
      ["https://gateway.example.com/base/rpc?x=1#frag", "wss://gateway.example.com/base/ws"],
      ["https://gateway.example.com/", "wss://gateway.example.com/ws"],
      ["https://gateway.example.com/jsonrpc", "wss://gateway.example.com/jsonrpc/ws"],
    ])("derives the /ws URL from %s", (gatewayUrl, expected) => {
      const custom = new TaskManager({ gatewayUrl, apiKey: "test-key" });
      custom.setWebSocket(MockWebSocket);
      void custom.trackTask(TOPIC, undefined, 1_000).catch(() => {});

      expect(MockWebSocket.latest().url).toBe(expected);
      MockWebSocket.latest().emitClose({});
    });

    it("unwraps update frames, ignores subscribed frames, resolves on a terminal status, and closes", async () => {
      manager.setWebSocket(MockWebSocket);
      const onUpdate = vi.fn();
      const pending = manager.trackTask(TOPIC, onUpdate, 1_000);
      const ws = MockWebSocket.latest();
      const progress = taskEvent("processing");
      const success = taskEvent("success", { progress: 90, result: { task_id: TASK_ID } });

      ws.emitOpen();
      ws.emitMessage({ type: "subscribed", id: "server-sub-id" });
      ws.emitUpdate(progress);
      ws.emitUpdate(success);

      await expect(pending).resolves.toEqual(success);
      expect(onUpdate).toHaveBeenCalledTimes(2);
      expect(onUpdate).toHaveBeenNthCalledWith(1, progress);
      expect(onUpdate).toHaveBeenNthCalledWith(2, success);
      expect(ws.close).toHaveBeenCalledTimes(1);
    });

    it("resolves with the failed event", async () => {
      manager.setWebSocket(MockWebSocket);
      const pending = manager.trackTask(TOPIC, undefined, 1_000);
      const failed = taskEvent("failed", { error: "quorum not reached" });

      MockWebSocket.latest().emitUpdate(failed);

      await expect(pending).resolves.toEqual(failed);
    });

    it("rejects on a gateway error frame", async () => {
      manager.setWebSocket(MockWebSocket);
      const pending = manager.trackTask(TOPIC, undefined, 1_000);
      const ws = MockWebSocket.latest();

      ws.emitMessage({ type: "error", id: null, message: "Rate limit exceeded" });

      await expect(pending).rejects.toThrow(`task ${TOPIC} subscription failed: Rate limit exceeded`);
      expect(ws.close).toHaveBeenCalledTimes(1);
    });

    it.each([
      [undefined, "an API key is required"],
      ["key with spaces", "the API key holds characters a WebSocket subprotocol cannot carry"],
    ])("rejects without opening a socket when the API key is %s", async (apiKey, reason) => {
      const custom = new TaskManager({ gatewayUrl: "http://localhost:8080", apiKey });
      custom.setWebSocket(MockWebSocket);

      const err = await custom.trackTask(TOPIC, undefined, 1_000).catch((e: Error) => e);

      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toBe(`cannot track task ${TOPIC} at ws://localhost:8080/ws: ${reason}`);
      if (apiKey) expect((err as Error).message).not.toContain(apiKey);
      expect(MockWebSocket.instances).toHaveLength(0);
    });

    it("rejects on WebSocket close before terminal event", async () => {
      manager.setWebSocket(MockWebSocket);
      const pending = manager.trackTask(TOPIC, undefined, 1_000);
      const ws = MockWebSocket.latest();

      ws.emitClose({ code: 1006, reason: "abnormal closure" });

      await expect(pending).rejects.toThrow("WebSocket closed:");
      expect(ws.close).toHaveBeenCalledTimes(1);
    });

    it("ignores WebSocket error after terminal event", async () => {
      manager.setWebSocket(MockWebSocket);
      const pending = manager.trackTask(TOPIC, undefined, 1_000);
      const ws = MockWebSocket.latest();
      const success = taskEvent("success");

      ws.emitUpdate(success);
      ws.emitError({ message: "socket failed" });

      await expect(pending).resolves.toEqual(success);
      expect(ws.close).toHaveBeenCalledTimes(1);
    });
  });

  describe("submitAndWait", () => {
    it("sends the task and tracks the returned subscription topic", async () => {
      const gateway = {
        sendTask: vi.fn(async () => ({
          task_id: TASK_ID,
          subscription_topic: TOPIC,
          message: "queued",
          timestamp: 123,
        })),
      } as unknown as GatewayClient;
      const managerWithGateway = new TaskManager(
        { gatewayUrl: "http://localhost:8080", apiKey: "test-key" },
        gateway,
      );
      managerWithGateway.setWebSocket(MockWebSocket);
      const onUpdate = vi.fn();
      const pending = managerWithGateway.submitAndWait(
        {
          policyClient: "0x1111111111111111111111111111111111111111",
          intent,
          wasmArgs: "0x7b7d",
        },
        onUpdate,
        1_000,
      );

      await vi.waitFor(() => expect(MockWebSocket.instances).toHaveLength(1));
      const ws = MockWebSocket.latest();
      const success = taskEvent("success");

      expect(gateway.sendTask).toHaveBeenCalledWith(
        expect.objectContaining({
          policyClient: "0x1111111111111111111111111111111111111111",
          intent,
          wasmArgs: ["0x7b7d"],
          timeout: 60,
        }),
      );
      expect(ws.url).toBe("ws://localhost:8080/ws");
      ws.emitOpen();
      expect(JSON.parse(ws.send.mock.calls[0][0]).method).toBe(TOPIC);
      ws.emitUpdate(success);

      await expect(pending).resolves.toEqual(success);
      expect(onUpdate).toHaveBeenCalledWith(success);
      expect(ws.close).toHaveBeenCalledTimes(1);
    });
  });
});
