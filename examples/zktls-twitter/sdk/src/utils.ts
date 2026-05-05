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

/**
 * Decode 0x-prefixed hex-encoded UTF-8 JSON back to an object.
 */
export function decodeWasmArgs<T = Record<string, unknown>>(hex: string): T {
  const stripped = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (stripped.length === 0) {
    throw new NewtonSDKError("Invalid hex string: empty input");
  }
  const matches = stripped.match(/.{1,2}/g);
  if (!matches) {
    throw new NewtonSDKError("Invalid hex string: empty input");
  }
  const bytes = new Uint8Array(matches.map((b) => parseInt(b, 16)));
  return JSON.parse(new TextDecoder().decode(bytes));
}

/**
 * Convert snake_case keys to camelCase (single-level for JSON-RPC request params).
 */
export function snakeToCamel(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    result[camelKey] = value;
  }
  return result;
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
    const snakeKey = key.replace(/([A-Z])/g, (c) => `_${c.toLowerCase()}`);
    result[snakeKey] = value;
  }
  return result;
}
