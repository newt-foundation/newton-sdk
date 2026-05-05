/**
 * Integration tests for @newton-protocol/zktls-twitter-example.
 *
 * These tests verify the full SDK request/response flow using mocked HTTP,
 * ensuring the request/response shapes match what the Newton gateway expects.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";

import { createNewtonSDK, encodeWasmArgs, decodeWasmArgs } from "./index.js";
import type { JsonRpcResponse, CreateTaskResponse, SendTaskResponse } from "./types.js";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

async function cidFor(bytes: Uint8Array): Promise<string> {
  return CID.createV1(0x55, await sha256.digest(bytes)).toString();
}

describe("Integration: zkTLS Twitter follower verification flow", () => {
  const sdk = createNewtonSDK({
    gatewayUrl: "http://localhost:8080",
    attesterUrl: "http://localhost:7047",
    apiKey: "test-api-key",
    chainId: 11155111,
  });

  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("Step 1: encode wasmArgs for twitter followers policy", () => {
    const wasmArgs = {
      min_followers: 1000,
      twitter_username: "newton_protocol",
    };

    const encoded = encodeWasmArgs(wasmArgs);
    expect(encoded).toMatch(/^0x[0-9a-f]+$/);

    const decoded = decodeWasmArgs<typeof wasmArgs>(encoded);
    expect(decoded.min_followers).toBe(1000);
    expect(decoded.twitter_username).toBe("newton_protocol");
  });

  it("Step 2: store proof to IPFS via attester", async () => {
    const proofCid = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        cid: proofCid,
        url: `https://ipfs.example.com/ipfs/${proofCid}`,
      }),
    });

    const result = await sdk.proof.store("base64EncodedProofData==");

    expect(result.cid).toBe(proofCid);

    // Verify the request went to the attester
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("http://localhost:7047/v1/proof/store");
    expect(init.method).toBe("POST");
    expect(init.headers["Authorization"]).toBe("Bearer test-api-key");
    expect(JSON.parse(init.body).proof).toBe("base64EncodedProofData==");
  });

  it("Step 3: createTask with proofCid — full payload validation", async () => {
    const proofCid = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";

    const gatewayResponse: JsonRpcResponse<CreateTaskResponse> = {
      jsonrpc: "2.0",
      id: 1,
      result: {
        taskId: 42,
        status: "success",
        signatureData: "0xabcdef",
        referenceBlock: 1000,
        expiration: 1100,
        timestamp: 1700000000,
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => gatewayResponse,
    });

    const result = await sdk.task.createTask({
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
      proofCid,
      timeout: 60,
    });

    // Verify result
    expect(result.taskId).toBe(42);
    expect(result.status).toBe("success");

    // Verify the JSON-RPC payload sent to gateway
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("http://localhost:8080/rpc");
    expect(init.headers["Authorization"]).toBe("Bearer test-api-key");

    const body = JSON.parse(init.body);
    expect(body.jsonrpc).toBe("2.0");
    expect(body.method).toBe("newt_createTask");
    expect(body.params).toHaveLength(1);

    const params = body.params[0];
    // Gateway expects snake_case
    expect(params.policy_client).toBe("0x1111111111111111111111111111111111111111");
    expect(params.use_two_phase).toBe(true);
    expect(params.proof_cid).toBe(proofCid);
    expect(params.timeout).toBe(60);

    // wasm_args should be hex-encoded JSON
    expect(params.wasm_args).toMatch(/^0x[0-9a-f]+$/);
    const decodedArgs = decodeWasmArgs(params.wasm_args);
    expect(decodedArgs).toEqual({ min_followers: 1000, twitter_username: "newton_protocol" });

    // Intent stays camelCase (nested object not converted)
    expect(params.intent).toBeDefined();
  });

  it("Step 4: sendTask async + subscription topic", async () => {
    const gatewayResponse: JsonRpcResponse<SendTaskResponse> = {
      jsonrpc: "2.0",
      id: 1,
      result: {
        taskId: 43,
        subscriptionTopic: "task:43:updates",
        message: "Task submitted for async processing",
        timestamp: 1700000001,
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => gatewayResponse,
    });

    const result = await sdk.task.sendTask({
      policyClient: "0x1111111111111111111111111111111111111111",
      intent: {
        from: "0x2222222222222222222222222222222222222222",
        to: "0x3333333333333333333333333333333333333333",
        value: "0x0",
        data: "0x",
        chainId: "0xaa36a7",
        functionSignature: "0x",
      },
      proofCid: "bafytest",
      wasmArgs: { min_followers: 500 },
    });

    expect(result.taskId).toBe(43);
    expect(result.subscriptionTopic).toBe("task:43:updates");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.method).toBe("newt_sendTask");
  });

  it("Step 5: retrieve proof from IPFS by CID", async () => {
    const proofBytes = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
    const cid = await cidFor(proofBytes);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => proofBytes.buffer,
    });

    const result = await sdk.proof.retrieve(cid);

    expect(result).toEqual(proofBytes);
    expect(mockFetch.mock.calls[0][0]).toBe(
      `http://localhost:7047/v1/proof/${cid}`,
    );
  });

  it("handles JSON-RPC error from gateway", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        jsonrpc: "2.0",
        id: 1,
        error: {
          code: -32000,
          message: "Policy evaluation failed: insufficient followers (500 < 1000)",
          data: { allow: false, followers_count: 500, min_required: 1000 },
        },
      }),
    });

    await expect(
      sdk.task.createTask({
        policyClient: "0x1111111111111111111111111111111111111111",
        intent: {
          from: "0x0000000000000000000000000000000000000000",
          to: "0x0000000000000000000000000000000000000000",
          value: "0x0",
          data: "0x",
          chainId: "0x1",
          functionSignature: "0x",
        },
        proofCid: "bafyfail",
      }),
    ).rejects.toThrow("Policy evaluation failed");
  });

  it("handles HTTP errors gracefully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
    });

    await expect(
      sdk.gateway.getPrivacyPublicKey(),
    ).rejects.toThrow("HTTP 503");
  });
});
