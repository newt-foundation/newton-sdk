import { describe, it, expect } from "vitest";
import { encodeWasmArgs, decodeWasmArgs, camelToSnake, snakeToCamel } from "./utils.js";

describe("encodeWasmArgs", () => {
  it("encodes a JSON object to 0x-prefixed hex", () => {
    const result = encodeWasmArgs({ min_followers: 1000, twitter_username: "newton_protocol" });
    expect(result).toMatch(/^0x[0-9a-f]+$/);

    // Verify round-trip
    const decoded = decodeWasmArgs(result);
    expect(decoded).toEqual({ min_followers: 1000, twitter_username: "newton_protocol" });
  });

  it("matches the known fixture from docs/examples", () => {
    // From examples/zktls-twitter/configs/wasm-args.json → create-task.json
    const args = { min_followers: 1000, twitter_username: "newton_protocol" };
    const encoded = encodeWasmArgs(args);

    // Decode back to verify content
    const decoded = decodeWasmArgs(encoded);
    expect(decoded.min_followers).toBe(1000);
    expect(decoded.twitter_username).toBe("newton_protocol");
  });
});

describe("decodeWasmArgs", () => {
  it("handles hex without 0x prefix", () => {
    const hex = "7b226b6579223a2276616c7565227d"; // {"key":"value"}
    const result = decodeWasmArgs(hex);
    expect(result).toEqual({ key: "value" });
  });

  it("handles hex with 0x prefix", () => {
    const hex = "0x7b226b6579223a2276616c7565227d";
    const result = decodeWasmArgs(hex);
    expect(result).toEqual({ key: "value" });
  });

  it("throws a clear error for empty input", () => {
    expect(() => decodeWasmArgs("0x")).toThrow("Invalid hex string: empty input");
    expect(() => decodeWasmArgs("")).toThrow("Invalid hex string: empty input");
  });
});

describe("camelToSnake", () => {
  it("converts camelCase keys to snake_case", () => {
    const result = camelToSnake({
      policyClient: "0x1234",
      useTwoPhase: true,
      proofCid: "bafybeig",
    });
    expect(result).toEqual({
      policy_client: "0x1234",
      use_two_phase: true,
      proof_cid: "bafybeig",
    });
  });

  it("leaves snake_case keys unchanged", () => {
    const result = camelToSnake({ already_snake: "yes" });
    expect(result).toEqual({ already_snake: "yes" });
  });
});

describe("snakeToCamel", () => {
  it("converts snake_case keys to camelCase", () => {
    const result = snakeToCamel({
      policy_client: "0x1234",
      use_two_phase: true,
      proof_cid: "bafybeig",
    });
    expect(result).toEqual({
      policyClient: "0x1234",
      useTwoPhase: true,
      proofCid: "bafybeig",
    });
  });
});
