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

import type { NewtonSDKConfig, StoreProofRequest, StoreProofResponse } from "./types.js";
import { NewtonSDKError, TimeoutError } from "./errors.js";

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
        const text = await response.text().catch(() => "");
        throw new NewtonSDKError(
          `Proof store failed: HTTP ${response.status} ${text}`,
        );
      }

      return (await response.json()) as StoreProofResponse;
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
      const response = await fetch(`${this.baseUrl}/v1/proof/${cid}`, {
        method: "GET",
        headers: this.headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new NewtonSDKError(
          `Proof retrieve failed: HTTP ${response.status} ${text}`,
        );
      }

      const buf = await response.arrayBuffer();
      return new Uint8Array(buf);
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
