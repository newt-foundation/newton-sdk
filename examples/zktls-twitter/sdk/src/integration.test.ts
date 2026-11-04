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
import type { CreateTaskResponse, SendTaskResponse } from "./types.js";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

const TOPIC = "ab".repeat(32);
const TASK_ID = `0x${TOPIC}`;
const PROOF_CID_REJECTION = "proof_cid is unsupported; zkTLS proof verification is unavailable";

/** The gateway's success envelope. */
function rpcResult(result: unknown): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", result, error: null, id: null }), { status: 200 });
}

async function cidFor(bytes: Uint8Array): Promise<string> {
  return CID.createV1(0x55, await sha256.digest(bytes)).toString();
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
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
    // Use real bytes + real CID so the client-side integrity check in
    // ProofClient.store can verify the gateway response.
    const proofBytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const proofBase64 = bytesToBase64(proofBytes);
    const proofCid = await cidFor(proofBytes);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        cid: proofCid,
        url: `https://ipfs.example.com/ipfs/${proofCid}`,
      }),
    });

    const result = await sdk.proof.store(proofBase64);

    expect(result.cid).toBe(proofCid);

    // Verify the request went to the attester
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("http://localhost:7047/v1/proof/store");
    expect(init.method).toBe("POST");
    expect(init.headers["Authorization"]).toBe("Bearer test-api-key");
    expect(JSON.parse(init.body).proof).toBe(proofBase64);
  });

  it("Step 3: createTask - full payload validation", async () => {
    const gatewayResult = {
      task_id: TASK_ID,
      status: "success",
      signature_data: "0xabcdef",
      reference_block: 1000,
      expiration: null,
      timestamp: 1700000000,
    } satisfies CreateTaskResponse;

    mockFetch.mockResolvedValueOnce(rpcResult(gatewayResult));

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
      timeout: 60,
    });

    // Verify result
    expect(result.task_id).toBe(TASK_ID);
    expect(result.status).toBe("success");

    // Verify the JSON-RPC payload sent to gateway
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("http://localhost:8080/rpc");
    expect(init.headers["Authorization"]).toBe("Bearer test-api-key");

    const body = JSON.parse(init.body);
    expect(body.jsonrpc).toBe("2.0");
    expect(body.method).toBe("newt_createTask");

    const params = body.params;
    // Gateway expects snake_case
    expect(params.policy_client).toBe("0x1111111111111111111111111111111111111111");
    expect(params.timeout).toBe(60);
    expect(params).not.toHaveProperty("use_two_phase");
    expect(params).not.toHaveProperty("proof_cid");

    // wasm_args holds one hex-encoded JSON entry per policy
    expect(params.wasm_args).toHaveLength(1);
    expect(params.wasm_args[0]).toMatch(/^0x[0-9a-f]+$/);
    const decodedArgs = decodeWasmArgs(params.wasm_args[0]);
    expect(decodedArgs).toEqual({ min_followers: 1000, twitter_username: "newton_protocol" });

    // Intent stays camelCase (nested object not converted)
    expect(params.intent.chainId).toBe("0xaa36a7");
  });

  it("Step 4: sendTask async + subscription topic", async () => {
    const gatewayResult = {
      task_id: TASK_ID,
      subscription_topic: TOPIC,
      message: "Task submitted for async processing",
      timestamp: 1700000001,
    } satisfies SendTaskResponse;

    mockFetch.mockResolvedValueOnce(rpcResult(gatewayResult));

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
      wasmArgs: { min_followers: 500 },
    });

    expect(result.task_id).toBe(TASK_ID);
    expect(result.subscription_topic).toBe(TOPIC);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.method).toBe("newt_sendTask");
    expect(decodeWasmArgs(body.params.wasm_args[0])).toEqual({ min_followers: 500 });
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

  it("surfaces the gateway's proof_cid rejection", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ jsonrpc: "2.0", result: null, error: { InvalidRequest: PROOF_CID_REJECTION }, id: null }), {
        status: 400,
      }),
    );

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
    ).rejects.toThrow(`returned 400 [InvalidRequest] ${PROOF_CID_REJECTION}`);
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).params.proof_cid).toBe("bafyfail");
  });

  it("handles HTTP errors gracefully", async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 503 }));

    await expect(
      sdk.gateway.getPrivacyPublicKey(),
    ).rejects.toThrow("gateway newt_getPrivacyPublicKey returned 503 [http_error] empty body");
  });
});
