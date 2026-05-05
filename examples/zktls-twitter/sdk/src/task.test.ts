import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaskManager } from "./task.js";
import type { GatewayClient } from "./gateway.js";
import type {
  CreateTaskResponse,
  JsonRpcResponse,
  TaskIntent,
  TaskUpdateEvent,
} from "./types.js";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

class MockWebSocket {
  static instances: MockWebSocket[] = [];

  readonly url: string;
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  onclose: ((ev: unknown) => void) | null = null;
  close = vi.fn(() => {
    this.onclose?.({});
  });

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  emitMessage(data: unknown): void {
    this.onmessage?.({
      data: typeof data === "string" ? data : JSON.stringify(data),
    });
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
    it("accepts wasmArgs as an object and hex-encodes it", async () => {
      const successResponse: JsonRpcResponse<CreateTaskResponse> = {
        jsonrpc: "2.0",
        id: 1,
        result: {
          taskId: 1,
          status: "success",
          timestamp: Date.now(),
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => successResponse,
      });

      await manager.createTask({
        policyClient: "0x1111111111111111111111111111111111111111",
        intent,
        wasmArgs: { min_followers: 1000, twitter_username: "newton_protocol" },
        useTwoPhase: true,
        proofCid: "bafytest",
      });

      const [, fetchInit] = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchInit.body);
      const params = body.params[0];

      // wasm_args should be hex-encoded
      expect(params.wasm_args).toMatch(/^0x[0-9a-f]+$/);

      // Decode and verify
      const hex = params.wasm_args.slice(2);
      const bytes = new Uint8Array(
        hex.match(/.{1,2}/g)!.map((b: string) => parseInt(b, 16)),
      );
      const decoded = JSON.parse(new TextDecoder().decode(bytes));
      expect(decoded.min_followers).toBe(1000);
      expect(decoded.twitter_username).toBe("newton_protocol");
    });

    it("passes string wasmArgs through unchanged", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jsonrpc: "2.0",
          id: 1,
          result: { taskId: 1, status: "success", timestamp: Date.now() },
        }),
      });

      await manager.createTask({
        policyClient: "0x1111111111111111111111111111111111111111",
        intent,
        wasmArgs: "0xdeadbeef",
      });

      const [, fetchInit] = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchInit.body);
      expect(body.params[0].wasm_args).toBe("0xdeadbeef");
    });

    it("sets default timeout to 60 seconds", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jsonrpc: "2.0",
          id: 1,
          result: { taskId: 1, status: "success", timestamp: Date.now() },
        }),
      });

      await manager.createTask({
        policyClient: "0x0000000000000000000000000000000000000000",
        intent,
      });

      const [, fetchInit] = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchInit.body);
      expect(body.params[0].timeout).toBe(60);
    });
  });

  describe("trackTask", () => {
    it("subscribes to updates, forwards callbacks, resolves terminal events, and closes", async () => {
      manager.setWebSocket(MockWebSocket);
      const onUpdate = vi.fn();
      const pending = manager.trackTask("task/topic", onUpdate, 1_000);
      const ws = MockWebSocket.latest();
      const progress: TaskUpdateEvent = {
        event: "status_update",
        taskId: 7,
        timestamp: 123,
        data: {
          status: "processing",
          operatorResponses: [],
          progress: 50,
        },
      };
      const success: TaskUpdateEvent = {
        event: "success",
        taskId: 7,
        timestamp: 124,
        data: {
          status: "success",
          operatorResponses: [],
          progress: 100,
          result: { allow: true },
        },
      };

      expect(ws.url).toBe("ws://localhost:8080/ws?topic=task%2Ftopic");
      ws.emitMessage(progress);
      ws.emitMessage(success);

      await expect(pending).resolves.toEqual(success);
      expect(onUpdate).toHaveBeenNthCalledWith(1, progress);
      expect(onUpdate).toHaveBeenNthCalledWith(2, success);
      expect(ws.close).toHaveBeenCalledTimes(1);
    });
  });

  describe("submitAndWait", () => {
    it("sends the task and tracks the returned subscription topic", async () => {
      const gateway = {
        sendTask: vi.fn(async () => ({
          taskId: 9,
          subscriptionTopic: "task-9",
          message: "queued",
          timestamp: 123,
        })),
      } as unknown as GatewayClient;
      const managerWithGateway = new TaskManager(
        { gatewayUrl: "http://localhost:8080" },
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
      const success: TaskUpdateEvent = {
        event: "success",
        taskId: 9,
        timestamp: 124,
        data: {
          status: "success",
          operatorResponses: [],
          progress: 100,
        },
      };

      expect(gateway.sendTask).toHaveBeenCalledWith(
        expect.objectContaining({
          policyClient: "0x1111111111111111111111111111111111111111",
          intent,
          wasmArgs: "0x7b7d",
          timeout: 60,
        }),
      );
      expect(ws.url).toBe("ws://localhost:8080/ws?topic=task-9");
      ws.emitMessage(success);

      await expect(pending).resolves.toEqual(success);
      expect(onUpdate).toHaveBeenCalledWith(success);
      expect(ws.close).toHaveBeenCalledTimes(1);
    });
  });
});
