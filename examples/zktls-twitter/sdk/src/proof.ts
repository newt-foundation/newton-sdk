/// <reference path="./multiformats-compat.d.ts" />

/**
 * Newton Protocol Proof management client.
 *
 * Handles IPFS proof storage and retrieval via the attester's REST endpoints:
 *   POST /v1/proof/store
 *   GET  /v1/proof/:cid
 *
 * This IPFS archival path is for the standalone demo flow. The planned
 * identity-integrated flow will let `newt_uploadIdentityEncrypted` accept an
 * optional TLS proof so the gateway can verify and persist proof-backed
 * identity data directly; when that lands, ProofClient should become optional
 * standalone archival tooling rather than a required task-submission step.
 */

import { CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";

import type {
  NewtonSDKConfig,
  StoreProofRequest,
  StoreProofResponse,
} from "./types.js";
import { NewtonSDKError, TimeoutError } from "./errors.js";

/**
 * Proof storage currently uses IPFS-backed attester endpoints. The planned
 * migration moves proof persistence from IPFS to gateway-owned Postgres while
 * preserving this client boundary for store/retrieve calls.
 */
export class ProofClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly timeout: number;

  constructor(config: NewtonSDKConfig) {
    const url = config.attesterUrl ?? config.gatewayUrl.replace(/\/rpc$/, "");
    this.baseUrl = url.replace(/\/+$/, "");
    this.headers = { "Content-Type": "application/json" };
    if (config.apiKey) {
      this.headers["Authorization"] = `Bearer ${config.apiKey}`;
    }
    this.timeout = config.timeout ?? 30_000;
  }

  /**
   * Store a proof to IPFS via the attester.
   *
   * @param proof - Base64-encoded BCS serialized proof bytes
   * @returns CID and optional URL of the stored proof
   */
  async store(proof: string): Promise<StoreProofResponse> {
    const body: StoreProofRequest = { proof };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/v1/proof/store`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await boundedText(response, this.timeout);
        throw new NewtonSDKError(
          `Proof store failed: HTTP ${response.status} ${text}`,
        );
      }

      const result = (await boundedJson(response, this.timeout)) as StoreProofResponse;
      // Defense in depth: re-derive the CID from the bytes we sent and confirm
      // the gateway returned a CID for *that* content. Otherwise a malicious or
      // misconfigured gateway could return any CID, and downstream `proofCid`
      // submission would resolve to content the client never authored.
      await verifyCidIntegrity(result.cid, base64ToBytes(proof));
      return result;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new TimeoutError(this.timeout);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Retrieve a proof from IPFS by CID.
   *
   * @param cid - IPFS content identifier (e.g. "bafybeig...")
   * @returns Raw proof bytes as a Uint8Array
   */
  async retrieve(cid: string): Promise<Uint8Array> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/v1/proof/${encodeURIComponent(cid)}`, {
        method: "GET",
        headers: this.headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await boundedText(response, this.timeout);
        throw new NewtonSDKError(
          `Proof retrieve failed: HTTP ${response.status} ${text}`,
        );
      }

      const bytes = await boundedArrayBuffer(response, this.timeout);
      await verifyCidIntegrity(cid, bytes);
      return bytes;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new TimeoutError(this.timeout);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}

async function verifyCidIntegrity(
  cid: string,
  bytes: Uint8Array,
): Promise<void> {
  const parsed = CID.parse(cid);
  if (parsed.multihash.code !== sha256.code) {
    throw new NewtonSDKError(
      `CID integrity check unsupported: multihash algorithm ${parsed.multihash.code} is not sha-256`,
    );
  }

  const expected = parsed.multihash.bytes;
  const actual = (await sha256.digest(bytes)).bytes;

  if (!bytesEqual(actual, expected)) {
    throw new NewtonSDKError(
      "CID integrity check failed: returned bytes do not match the requested content hash",
    );
  }
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) {
    return false;
  }

  return a.every((byte, index) => byte === b[index]);
}

/**
 * Decode a base64 string into raw bytes. Uses `atob` (universal across modern
 * Node ≥18 and browsers) so the verification path stays runtime-agnostic.
 * The implementation routes through `String.fromCharCode` to preserve byte
 * values exactly — `atob` returns a binary string where each codepoint is
 * the literal byte value.
 */
function base64ToBytes(b64: string): Uint8Array {
  if (typeof atob !== "function") {
    throw new NewtonSDKError(
      "Cannot verify proof CID: atob() is not available in this runtime",
    );
  }
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

/**
 * Bounded body-read helpers: keep the AbortController alive across the
 * response-body read so a stalled or oversized body still times out.
 */

const MAX_BODY_SIZE = 50 * 1024 * 1024; // 50 MiB

async function boundedArrayBuffer(
  response: Response,
  timeoutMs: number,
): Promise<Uint8Array> {
  const reader = response.body?.getReader?.();
  if (!reader) {
    // Fallback for environments / mocks without a streaming body. Real
    // browser/node fetch responses always expose `body`; this path covers
    // minimal Response polyfills and unit-test mocks. The outer caller's
    // AbortController bounds wall-clock by aborting the underlying fetch.
    if (typeof response.arrayBuffer === "function") {
      const buf = new Uint8Array(await response.arrayBuffer());
      if (buf.byteLength > MAX_BODY_SIZE) {
        throw new NewtonSDKError(
          `Response body exceeds maximum allowed size (${buf.byteLength} bytes)`,
        );
      }
      return buf;
    }
    throw new NewtonSDKError("Response body is not readable");
  }

  // Bound the body-read with an out-of-band timer that calls reader.cancel().
  // AbortController cannot interrupt an in-flight reader.read(); only cancel()
  // does. The timedOut flag distinguishes a clean EOF from a cancel-induced
  // EOF so we can surface the original timeout instead of a truncated payload.
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    void reader.cancel().catch(() => undefined);
  }, timeoutMs);

  try {
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (timedOut) {
        throw new TimeoutError(timeoutMs);
      }
      if (done) break;
      received += value.byteLength;
      if (received > MAX_BODY_SIZE) {
        await reader.cancel().catch(() => undefined);
        throw new NewtonSDKError(
          `Response body exceeds maximum allowed size (${MAX_BODY_SIZE} bytes)`,
        );
      }
      chunks.push(value);
    }
    const buf = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      buf.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return buf;
  } finally {
    clearTimeout(timer);
  }
}

async function boundedText(response: Response, timeoutMs: number): Promise<string> {
  // Prefer the streaming path for size enforcement; fall back to response.text()
  // when only the eager method is available (test mocks, polyfills).
  if (!response.body && typeof response.text === "function") {
    return response.text();
  }
  const bytes = await boundedArrayBuffer(response, timeoutMs);
  return new TextDecoder().decode(bytes);
}

async function boundedJson(response: Response, timeoutMs: number): Promise<unknown> {
  if (!response.body && typeof response.json === "function") {
    return response.json();
  }
  const text = await boundedText(response, timeoutMs);
  return JSON.parse(text);
}
