import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaskManager } from "./task.js";
import type { CreateTaskResponse, JsonRpcResponse } from "./types.js";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe("TaskManager", () => {
  let manager: TaskManager;

  beforeEach(() => {
    mockFetch.mockReset();
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
        intent: {
          from: "0x2222222222222222222222222222222222222222",
          to: "0x3333333333333333333333333333333333333333",
          value: "0x0",
          data: "0x",
          chainId: "0xaa36a7",
          functionSignature: "0x",
        },
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
        intent: {
          from: "0x0000000000000000000000000000000000000000",
          to: "0x0000000000000000000000000000000000000000",
          value: "0x0",
          data: "0x",
          chainId: "0x1",
          functionSignature: "0x",
        },
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
        intent: {
          from: "0x0000000000000000000000000000000000000000",
          to: "0x0000000000000000000000000000000000000000",
          value: "0x0",
          data: "0x",
          chainId: "0x1",
          functionSignature: "0x",
        },
      });

      const [, fetchInit] = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchInit.body);
      expect(body.params[0].timeout).toBe(60);
    });
  });
});
