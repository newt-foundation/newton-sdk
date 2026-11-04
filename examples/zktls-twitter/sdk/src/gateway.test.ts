import { describe, it, expect, vi, beforeEach } from "vitest";
import { GatewayClient } from "./gateway.js";
import { RpcError } from "./errors.js";
import type { TaskIntent } from "./types.js";

// Mock global fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

const intent: TaskIntent = {
  from: "0x2222222222222222222222222222222222222222",
  to: "0x3333333333333333333333333333333333333333",
  value: "0x0",
  data: "0x",
  chainId: "0xaa36a7",
  functionSignature: "0x",
};

const POLICY_CLIENT = "0x1111111111111111111111111111111111111111";
const TASK_ID = `0x${"ab".repeat(32)}`;
const PROOF_CID_REJECTION = "proof_cid is unsupported; zkTLS proof verification is unavailable";

/** The gateway's success envelope: `error` is null and `id` is the gateway's own UUID. */
function rpcResult(result: unknown): Response {
  return new Response(
    JSON.stringify({ jsonrpc: "2.0", result, error: null, id: "6f1c1f9e-2d0b-4c1e-9a43-8a8f2f6f7e01" }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

/** The gateway's error envelope: `error` is its error enum in serde's external tagging. */
function rpcError(status: number, error: unknown): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", result: null, error, id: null }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function sentBody(call = 0): { jsonrpc: string; id: unknown; method: string; params: Record<string, unknown> } {
  const [, init] = mockFetch.mock.calls[call];
  return JSON.parse(init.body);
}

describe("GatewayClient", () => {
  let client: GatewayClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new GatewayClient({
      gatewayUrl: "http://localhost:8080",
      apiKey: "test-key",
    });
  });

  it("appends /rpc to gateway URL if missing", async () => {
    mockFetch.mockResolvedValueOnce(rpcResult({}));

    await client.getPrivacyPublicKey();

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8080/rpc",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("does not add /rpc if URL already ends with /rpc", async () => {
    mockFetch.mockResolvedValueOnce(rpcResult({}));

    const clientWithRpc = new GatewayClient({ gatewayUrl: "http://localhost:8080/rpc" });
    await clientWithRpc.getPrivacyPublicKey();

    expect(mockFetch).toHaveBeenCalledWith("http://localhost:8080/rpc", expect.anything());
  });

  it("sends a snake_case createTask payload with a UUID id and returns the snake_case result", async () => {
    mockFetch.mockResolvedValueOnce(rpcResult({ task_id: TASK_ID, status: "success", timestamp: 1700000000 }));

    const result = await client.createTask({
      policyClient: POLICY_CLIENT,
      intent,
      proofCid: "bafytest",
      wasmArgs: ["0x7b7d"],
    });

    expect(result.task_id).toBe(TASK_ID);
    expect(result.status).toBe("success");

    const body = sentBody();
    expect(body.method).toBe("newt_createTask");
    expect(body.jsonrpc).toBe("2.0");
    expect(body.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    // Top-level keys go snake_case; the nested intent keeps its camelCase fields.
    expect(body.params).toEqual({
      policy_client: POLICY_CLIENT,
      intent,
      proof_cid: "bafytest",
      wasm_args: ["0x7b7d"],
    });
  });

  it("sends the field names the gateway reads for simulateTask and simulatePolicyData", async () => {
    mockFetch.mockResolvedValueOnce(rpcResult({ success: true, allowed: true }));
    mockFetch.mockResolvedValueOnce(rpcResult({ success: true, policy_data: {} }));
    const secrets = { enc: "0x01", ciphertext: "0x02" };

    await client.simulateTask({ policyClient: POLICY_CLIENT, chainId: 11155111, intent, wasmArgs: ["0x"] });
    await client.simulatePolicyData({
      policyAddress: "0x4444444444444444444444444444444444444444",
      chainId: 11155111,
      secrets,
      wasmArgs: "0x",
    });

    expect(sentBody(0).params).toEqual({
      policy_client: POLICY_CLIENT,
      chain_id: 11155111,
      intent,
      wasm_args: ["0x"],
    });
    // The SecureEnvelope goes as a JSON object, not a string.
    expect(sentBody(1).params).toEqual({
      policy_address: "0x4444444444444444444444444444444444444444",
      chain_id: 11155111,
      secrets,
      wasm_args: "0x",
    });
  });

  it("registers and unregisters the webhook of the calling API key", async () => {
    mockFetch.mockResolvedValueOnce(rpcResult({ success: true, message: "registered" }));
    mockFetch.mockResolvedValueOnce(rpcResult({ success: true, message: "unregistered" }));

    await client.registerWebhook({
      url: "https://hooks.example.com/newton",
      timeoutSeconds: 5,
      maxRetries: 2,
      failureTypes: ["quorum_not_reached"],
    });
    const unregistered = await client.unregisterWebhook();

    expect(sentBody(0).params).toEqual({
      url: "https://hooks.example.com/newton",
      timeout_seconds: 5,
      max_retries: 2,
      failure_types: ["quorum_not_reached"],
    });
    expect(sentBody(1).method).toBe("newt_unregisterWebhook");
    expect(sentBody(1).params).toEqual({});
    expect(unregistered).toEqual({ success: true, message: "unregistered" });
  });

  it("includes Authorization bearer header when apiKey is provided", async () => {
    mockFetch.mockResolvedValueOnce(rpcResult({}));

    await client.getPrivacyPublicKey();

    const [, fetchInit] = mockFetch.mock.calls[0];
    expect(fetchInit.headers["Authorization"]).toBe("Bearer test-key");
  });

  it("sends a null id when crypto.randomUUID is unavailable", async () => {
    mockFetch.mockResolvedValueOnce(rpcResult({}));
    vi.stubGlobal("crypto", {});
    try {
      await client.getPrivacyPublicKey();
    } finally {
      vi.unstubAllGlobals();
    }

    expect(sentBody().id).toBeNull();
  });

  describe("gateway errors", () => {
    it("reads a unit variant sent as a bare string", async () => {
      mockFetch.mockResolvedValueOnce(rpcError(429, "RateLimitExceeded"));

      const err = await client.getPrivacyPublicKey().catch((e: unknown) => e);

      expect(err).toBeInstanceOf(RpcError);
      expect(err).toMatchObject({
        method: "newt_getPrivacyPublicKey",
        status: 429,
        code: "RateLimitExceeded",
        message: "gateway newt_getPrivacyPublicKey returned 429 [RateLimitExceeded] RateLimitExceeded",
      });
    });

    it("reads a one-key variant, such as the proof_cid rejection", async () => {
      mockFetch.mockResolvedValueOnce(rpcError(400, { InvalidRequest: PROOF_CID_REJECTION }));

      await expect(
        client.createTask({ policyClient: POLICY_CLIENT, intent, proofCid: "bafytest" }),
      ).rejects.toMatchObject({
        status: 400,
        code: "InvalidRequest",
        data: PROOF_CID_REJECTION,
        message: `gateway newt_createTask returned 400 [InvalidRequest] ${PROOF_CID_REJECTION}`,
      });
    });

    it("keeps a tuple variant's payload as data", async () => {
      const payload = ["2 of 3 operators failed", null];
      mockFetch.mockResolvedValueOnce(rpcError(500, { QuorumNotReached: payload }));

      await expect(client.createTask({ policyClient: POLICY_CLIENT, intent })).rejects.toMatchObject({
        status: 500,
        code: "QuorumNotReached",
        data: payload,
        message: `gateway newt_createTask returned 500 [QuorumNotReached] ${JSON.stringify(payload)}`,
      });
    });

    it.each([
      ["an empty 401 for a bad API key", () => new Response(null, { status: 401, statusText: "Unauthorized" }), 401, "Unauthorized"],
      ["an empty 503", () => new Response(null, { status: 503 }), 503, "empty body"],
      [
        "a plain-text 422 body rejection",
        () => new Response("Failed to deserialize the JSON body into the target type", { status: 422 }),
        422,
        "Failed to deserialize the JSON body into the target type",
      ],
    ])("reports %s as http_error", async (_label, response, status, detail) => {
      mockFetch.mockResolvedValueOnce(response());

      const err = await client.getPrivacyPublicKey().catch((e: unknown) => e);

      expect(err).toBeInstanceOf(RpcError);
      expect(err).toMatchObject({
        status,
        code: "http_error",
        message: `gateway newt_getPrivacyPublicKey returned ${status} [http_error] ${detail}`,
      });
      expect((err as RpcError).message).not.toContain("test-key");
    });

    it("rejects a 200 body without a result as malformed", async () => {
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ jsonrpc: "2.0", id: null }), { status: 200 }));

      await expect(client.getPrivacyPublicKey()).rejects.toMatchObject({
        status: 200,
        code: "malformed_response",
      });
    });
  });
});
