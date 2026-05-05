import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { NewtonSDK } from "@newton-protocol/zktls-twitter-example";
import { App } from "./App";
import type { DemoServices } from "./types";

function fakeServices(): DemoServices {
  const sdk = {} as NewtonSDK;
  return {
    createSdk: vi.fn(() => sdk),
    checkSystem: vi.fn(async () => ({
      browser: { status: "success" as const, message: "Browser OK" },
      extension: { status: "success" as const, message: "Extension OK" },
      gateway: { status: "success" as const, message: "Gateway OK" },
      attester: { status: "success" as const, message: "Attester OK" },
    })),
    generateProof: vi.fn(async () => ({
      cid: "bafyproof",
      proofBase64: "cHJvb2Y=",
      followerCount: 5000,
      twitterUsername: "newton_protocol",
      sessionId: "session-1",
      verifierUrl: "ws://localhost:7047/verifier?sessionId=session-1",
      proxyUrl: "ws://localhost:7047/proxy?token=api.x.com&session=session-1",
    })),
    submitTask: vi.fn(async () => ({
      taskId: 99,
      status: "success" as const,
      timestamp: 123,
      result: {
        allow: true,
        followers_count: 5000,
        min_required: 1000,
        server: "api.x.com",
        proof_age_secs: 12,
        checks: {
          tlsn_proof_valid: true,
          correct_server: true,
          proof_is_fresh: true,
          meets_follower_threshold: true,
        },
      },
    })),
  };
}

describe("App", () => {
  it("renders and updates system checks", async () => {
    const services = fakeServices();
    const user = userEvent.setup();

    render(<App services={services} />);
    await user.click(screen.getByRole("button", { name: /run checks/i }));

    expect(await screen.findByText("Browser OK")).toBeInTheDocument();
    expect(screen.getByText("Extension OK")).toBeInTheDocument();
    expect(screen.getByText("Gateway OK")).toBeInTheDocument();
    expect(screen.getByText("Attester OK")).toBeInTheDocument();
    expect(services.checkSystem).toHaveBeenCalledTimes(1);
  });

  it("drives proof generation and task result visualization", async () => {
    const services = fakeServices();
    const user = userEvent.setup();

    render(<App services={services} />);
    await user.click(screen.getByRole("button", { name: /generate proof \+ cid/i }));

    expect(await screen.findByTestId("proof-result")).toHaveTextContent("bafyproof");
    expect(services.generateProof).toHaveBeenCalledWith(expect.anything(), {
      twitterUsername: "newton_protocol",
      minFollowers: 1000,
      attesterUrl: "http://127.0.0.1:7047",
    });

    await user.click(screen.getByRole("button", { name: /submit newton task/i }));

    await waitFor(() => expect(services.submitTask).toHaveBeenCalledTimes(1));
    expect(await screen.findByTestId("policy-result")).toHaveTextContent("ALLOW");
    expect(screen.getByText(/Followers:/)).toHaveTextContent("5,000");
    expect(screen.getByText(/Threshold:/)).toHaveTextContent("1,000");
  });
});
