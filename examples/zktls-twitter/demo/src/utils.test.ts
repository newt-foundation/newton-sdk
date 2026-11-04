import { describe, expect, it } from "vitest";
import { extractPolicyVisualization, toAddress } from "./utils";

describe("toAddress", () => {
  it("accepts a 20-byte hex address and rejects anything else", () => {
    expect(toAddress("from", " 0x2222222222222222222222222222222222222222 ")).toBe(
      "0x2222222222222222222222222222222222222222",
    );
    expect(() => toAddress("policyClient", "0x1234")).toThrow(
      'policyClient must be a 0x-prefixed 20-byte hex address, got "0x1234"',
    );
  });
});

describe("extractPolicyVisualization", () => {
  it("normalizes Rego result fields for result visualization", () => {
    const visualization = extractPolicyVisualization(
      {
        result: {
          allow: false,
          followers_count: 750,
          min_required: 1000,
          server: "api.x.com",
          proof_age_secs: 30,
          checks: {
            tlsn_proof_valid: true,
            correct_server: true,
            proof_is_fresh: true,
            meets_follower_threshold: false,
          },
        },
      },
      1000,
    );

    expect(visualization).toMatchObject({
      allow: false,
      followersCount: 750,
      threshold: 1000,
      server: "api.x.com",
      proofAgeSecs: 30,
      checks: {
        meets_follower_threshold: false,
      },
    });
  });

  it("uses the generated proof metadata when the gateway only reports success", () => {
    const visualization = extractPolicyVisualization(
      { task_id: `0x${"01".repeat(32)}`, status: "success", timestamp: 123 },
      1000,
      {
        cid: "bafyproof",
        proofBase64: "cHJvb2Y=",
        followerCount: 5000,
        twitterUsername: "newton_protocol",
        sessionId: "session-1",
        serverName: "x.com",
        verifierUrl: "http://localhost:7047",
        proxyUrl: "ws://localhost:7047/proxy?token=x.com",
      },
    );

    expect(visualization).toMatchObject({
      allow: true,
      followersCount: 5000,
      threshold: 1000,
      server: "x.com",
      checks: {
        tlsn_proof_valid: true,
        correct_server: true,
        proof_is_fresh: true,
        meets_follower_threshold: true,
      },
    });
  });

  it("takes the verdict from task_response.allowed over the local follower count", () => {
    const visualization = extractPolicyVisualization(
      {
        task_id: `0x${"01".repeat(32)}`,
        status: "success",
        task_response: { allowed: false },
        timestamp: 123,
      },
      1000,
      {
        cid: "bafyproof",
        proofBase64: "cHJvb2Y=",
        followerCount: 5000,
        twitterUsername: "newton_protocol",
        sessionId: "session-1",
        serverName: "x.com",
        verifierUrl: "http://localhost:7047",
        proxyUrl: "ws://localhost:7047/proxy?token=x.com",
      },
    );

    expect(visualization.allow).toBe(false);
    expect(visualization.checks.meets_follower_threshold).toBe(true);
  });
});
