/**
 * Shared utility helpers for the Newton SDK.
 */

import { NewtonSDKError } from "./errors.js";

/**
 * Convert a JS object to a 0x-prefixed hex-encoded UTF-8 JSON string,
 * matching the Rust gateway's `wasm_args` format.
 */
export function encodeWasmArgs(args: Record<string, unknown>): string {
  const json = JSON.stringify(args);
  const bytes = new TextEncoder().encode(json);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `0x${hex}`;
}

// 50 MiB cap matches the proof-bytes size cap in `proof.ts` so the two
// boundaries are reasoned about together.
const MAX_WASM_ARGS_BYTES = 50 * 1024 * 1024;

/**
 * Decode 0x-prefixed hex-encoded UTF-8 JSON back to an object.
 */
export function decodeWasmArgs<T = Record<string, unknown>>(hex: string): T {
  const stripped = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (stripped.length === 0) {
    throw new NewtonSDKError("Invalid hex string: empty input");
  }
  if (stripped.length % 2 !== 0) {
    throw new NewtonSDKError(
      `Invalid hex string: odd length (${stripped.length} chars)`,
    );
  }
  // Reject pathologically large payloads before doing the O(n) hex match and
  // O(n) byte allocation. A 50 MiB JSON arg is already three orders of
  // magnitude beyond legitimate SDK use.
  if (stripped.length / 2 > MAX_WASM_ARGS_BYTES) {
    throw new NewtonSDKError(
      `Invalid hex string: payload exceeds ${MAX_WASM_ARGS_BYTES} bytes`,
    );
  }
  if (!/^[0-9a-fA-F]+$/.test(stripped)) {
    throw new NewtonSDKError("Invalid hex string: contains non-hex characters");
  }
  const bytes = new Uint8Array(
    stripped.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)),
  );
  return JSON.parse(new TextDecoder().decode(bytes));
}

/**
 * Convert camelCase keys to snake_case (single-level for JSON-RPC request params).
 *
 * This is intentionally shallow: top-level RPC params use Rust-style snake_case,
 * while nested gateway-accepted objects such as `intent` keep their camelCase
 * fields (`chainId`, `functionSignature`). Add a shape-specific converter before
 * sending any future nested object that requires snake_case.
 */
export function camelToSnake(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    // Two-arm pattern handles both `aB`-style transitions and runs of caps
    // (`fooHTTPSServer` → `foo_https_server`). The naive single-arm form
    // `/([A-Z])/g` produces leading underscores on PascalCase keys and
    // splits acronyms letter-by-letter (`HTTP` → `_h_t_t_p`).
    const snakeKey = key
      .replace(/([a-z0-9])([A-Z])|([A-Z])([A-Z][a-z])/g, "$1$3_$2$4")
      .toLowerCase();
    result[snakeKey] = value;
  }
  return result;
}
