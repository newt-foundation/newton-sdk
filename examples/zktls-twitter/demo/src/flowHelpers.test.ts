import { describe, expect, it } from "vitest";
import {
  buildTaskPreview,
  derivePolicyDecision,
  extractCid,
  extractFollowerCount,
  extractProofPayload,
  toHexQuantity,
} from "./flowHelpers";
import type { ProofArtifact, TaskFormState } from "./types";

const form: TaskFormState = {
  twitterUsername: "newton_protocol",
  minFollowers: 1000,
  policyClient: "0x1111111111111111111111111111111111111111",
  from: "0x2222222222222222222222222222222222222222",
  to: "0x3333333333333333333333333333333333333333",
  chainId: 11155111,
  value: "0",
  data: "0x",
  functionSignature: "0x",
  timeout: 60,
};

describe("Newton zkTLS Twitter demo helpers", () => {
  it("builds the documented wasmArgs and intent preview", () => {
    const preview = buildTaskPreview(form, "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi");

    expect(preview.intent.chainId).toBe("0xaa36a7");
    expect(preview.intent.value).toBe("0x0");
    expect(preview.useTwoPhase).toBe(true);
    expect(preview.wasmArgs).toBe(
      "0x7b226d696e5f666f6c6c6f77657273223a313030302c22747769747465725f757365726e616d65223a226e6577746f6e5f70726f746f636f6c227d",
    );
  });

  it("normalizes decimal and hex quantities", () => {
    expect(toHexQuantity(11155111)).toBe("0xaa36a7");
    expect(toHexQuantity("0xAA36A7")).toBe("0xaa36a7");
  });

  it("extracts CID, proof payload, and follower count from nested extension output", () => {
    const nested = {
      response: {
        presentation: "QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo=".repeat(4),
        body: { user: { followers_count: 1200 } },
      },
      proof_cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
    };

    expect(extractCid(nested)).toBe("bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi");
    expect(extractProofPayload(nested)).toContain("QUJD");
    expect(extractFollowerCount(nested)).toBe(1200);
  });

  it("derives local allow/deny preview from proof metadata", () => {
    const artifact: ProofArtifact = {
      cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
      source: "manual-cid",
      server: "api.x.com",
      twitterUsername: "newton_protocol",
      followerCount: 1500,
      connectionTime: Math.floor(Date.now() / 1000),
      generatedAt: new Date().toISOString(),
    };

    const decision = derivePolicyDecision(undefined, artifact, 1000);
    expect(decision.status).toBe("allow");
    expect(decision.checks.meets_follower_threshold).toBe(true);
  });
});
