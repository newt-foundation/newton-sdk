import { describe, expect, it } from "vitest";
import { extractPolicyVisualization } from "./utils";

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
});
