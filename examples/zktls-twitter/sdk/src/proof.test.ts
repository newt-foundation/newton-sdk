import { describe, it, expect, vi, beforeEach } from "vitest";
import { CID } from "multiformats/cid";
import * as Digest from "multiformats/hashes/digest";
import { sha256 } from "multiformats/hashes/sha2";

import { ProofClient } from "./proof.js";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

async function cidFor(bytes: Uint8Array): Promise<string> {
  return CID.createV1(0x55, await sha256.digest(bytes)).toString();
}

describe("ProofClient", () => {
  let client: ProofClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new ProofClient({
      gatewayUrl: "http://localhost:8080",
      attesterUrl: "http://localhost:7047",
      apiKey: "test-key",
    });
  });

  describe("store", () => {
    it("sends proof to /v1/proof/store and returns CID", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
          url: "https://ipfs.example.com/ipfs/bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
        }),
      });

      const result = await client.store("base64encodedproof==");

      expect(result.cid).toBe("bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi");
      expect(result.url).toContain("ipfs");

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe("http://localhost:7047/v1/proof/store");
      expect(init.method).toBe("POST");
      expect(init.headers["Authorization"]).toBe("Bearer test-key");

      const body = JSON.parse(init.body);
      expect(body.proof).toBe("base64encodedproof==");
    });

    it("throws on HTTP error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 413,
        text: async () => "Payload too large",
      });

      await expect(client.store("tooLarge")).rejects.toThrow("HTTP 413");
    });
  });

  describe("retrieve", () => {
    it("fetches proof bytes by CID", async () => {
      const proofBytes = new Uint8Array([1, 2, 3, 4, 5]);
      const cid = await cidFor(proofBytes);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => proofBytes.buffer,
      });

      const result = await client.retrieve(cid);

      expect(result).toEqual(proofBytes);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe(`http://localhost:7047/v1/proof/${cid}`);
    });

    it("throws when retrieved bytes do not match the requested CID", async () => {
      const cid = await cidFor(new Uint8Array([1, 2, 3, 4, 5]));
      const returnedBytes = new Uint8Array([5, 4, 3, 2, 1]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => returnedBytes.buffer,
      });

      await expect(client.retrieve(cid)).rejects.toThrow(
        "CID integrity check failed: returned bytes do not match the requested content hash",
      );
    });

    it("URL-encodes the CID path segment", async () => {
      const proofBytes = new Uint8Array([1, 2, 3, 4, 5]);
      const cid = await cidFor(proofBytes);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => proofBytes.buffer,
      });

      await client.retrieve(cid);

      const [url] = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      expect(url).toBe(`http://localhost:7047/v1/proof/${encodeURIComponent(cid)}`);
    });

    it("throws on unsupported multihash algorithm", async () => {
      // Construct a CID whose multihash uses sha2-512 (code 0x13) instead of
      // sha2-256 (code 0x12). Using Digest.create produces a properly varint-
      // encoded `bytes` field so CID.parse round-trips successfully and we
      // reach the algorithm guard inside verifyCidIntegrity.
      const digest = Digest.create(0x13, new Uint8Array(32));
      const fakeCid = CID.createV1(0x55, digest);

      const proofBytes = new Uint8Array([1, 2, 3, 4, 5]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => proofBytes.buffer,
      });

      await expect(client.retrieve(fakeCid.toString())).rejects.toThrow(
        "multihash algorithm",
      );
    });
  });
});
