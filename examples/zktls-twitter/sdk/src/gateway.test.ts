import { describe, it, expect, vi, beforeEach } from "vitest";
import { GatewayClient } from "./gateway.js";
import type { CreateTaskResponse, JsonRpcResponse } from "./types.js";

// Mock global fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe("GatewayClient", () => {
  let client: GatewayClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new GatewayClient({
      gatewayUrl: "http://localhost:8080",
      apiKey: "test-key",
    });
  });

  it("appends /rpc to gateway URL if missing", () => {
    // Verify by making a call and checking the URL
    const successResponse: JsonRpcResponse<CreateTaskResponse> = {
      jsonrpc: "2.0",
      id: 1,
      result: {
        taskId: 42,
        status: "success",
        timestamp: Date.now(),
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => successResponse,
    });

    client.createTask({
      policyClient: "0x1111111111111111111111111111111111111111",
      intent: {
        from: "0x2222222222222222222222222222222222222222",
        to: "0x3333333333333333333333333333333333333333",
        value: "0x0",
        data: "0x",
        chainId: "0xaa36a7",
        functionSignature: "0x",
      },
      useTwoPhase: true,
      proofCid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8080/rpc",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  it("sends correct JSON-RPC payload for createTask", async () => {
    const successResponse: JsonRpcResponse<CreateTaskResponse> = {
      jsonrpc: "2.0",
      id: 1,
      result: {
        taskId: 42,
        status: "success",
        timestamp: 1700000000,
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => successResponse,
    });

    const result = await client.createTask({
      policyClient: "0x1111111111111111111111111111111111111111",
      intent: {
        from: "0x2222222222222222222222222222222222222222",
        to: "0x3333333333333333333333333333333333333333",
        value: "0x0",
        data: "0x",
        chainId: "0xaa36a7",
        functionSignature: "0x",
      },
      useTwoPhase: true,
      proofCid: "bafytest",
      wasmArgs: "0x7b7d",
    });

    expect(result.taskId).toBe(42);
    expect(result.status).toBe("success");

    // Verify the request body
    const [, fetchInit] = mockFetch.mock.calls[0];
    const body = JSON.parse(fetchInit.body);
    expect(body.method).toBe("newt_createTask");
    expect(body.jsonrpc).toBe("2.0");
    expect(body.params).toHaveLength(1);

    // Verify snake_case conversion for gateway
    const params = body.params[0];
    expect(params.policy_client).toBe("0x1111111111111111111111111111111111111111");
    expect(params.use_two_phase).toBe(true);
    expect(params.proof_cid).toBe("bafytest");
    expect(params.wasm_args).toBe("0x7b7d");
  });

  it("includes Authorization bearer header when apiKey is provided", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jsonrpc: "2.0", id: 1, result: {} }),
    });

    await client.getPrivacyPublicKey();

    const [, fetchInit] = mockFetch.mock.calls[0];
    expect(fetchInit.headers["Authorization"]).toBe("Bearer test-key");
  });

  it("throws JsonRpcError on RPC error response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        jsonrpc: "2.0",
        id: 1,
        error: { code: -32600, message: "Invalid Request" },
      }),
    });

    await expect(
      client.createTask({
        policyClient: "0x0000000000000000000000000000000000000000",
        intent: {
          from: "0x0000000000000000000000000000000000000000",
          to: "0x0000000000000000000000000000000000000000",
          value: "0x0",
          data: "0x",
          chainId: "0x1",
          functionSignature: "0x",
        },
      }),
    ).rejects.toThrow("Invalid Request");
  });

  it("does not add /rpc if URL already ends with /rpc", () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jsonrpc: "2.0", id: 1, result: {} }),
    });

    const clientWithRpc = new GatewayClient({
      gatewayUrl: "http://localhost:8080/rpc",
    });
    clientWithRpc.getPrivacyPublicKey();

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8080/rpc",
      expect.anything(),
    );
  });
});
