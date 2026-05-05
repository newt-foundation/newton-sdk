import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { NewtonSDK } from "@newton-protocol/zktls-twitter-example";
import { checkSystem, generateTwitterFollowerProof, submitTwitterFollowersTask } from "./newtonFlow";

function makeSdk(overrides: Partial<NewtonSDK> = {}): NewtonSDK {
  return {
    gateway: {} as NewtonSDK["gateway"],
    attester: {
      createSession: vi.fn(async () => ({
        sessionId: "session-1",
        verifierUrl: "ws://localhost:7047/verifier?sessionId=session-1",
        proxyUrl: (host: string) => `ws://localhost:7047/proxy?token=${host}&session=session-1`,
      })),
    } as unknown as NewtonSDK["attester"],
    proof: {
      store: vi.fn(async () => ({ cid: "bafyproof", url: "ipfs://bafyproof" })),
    } as unknown as NewtonSDK["proof"],
    task: {
      createTask: vi.fn(async () => ({ taskId: 7, status: "success", timestamp: 123 })),
    } as unknown as NewtonSDK["task"],
    ...overrides,
  };
}

describe("Newton zkTLS Twitter flow services", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36",
    });
    vi.stubGlobal("WebSocket", class MockWebSocket {});
    vi.stubGlobal("crypto", { getRandomValues: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete window.tlsn;
  });

  it("checks browser, extension, gateway, and attester health", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);
    window.tlsn = { execCode: vi.fn() };

    const result = await checkSystem({
      gatewayUrl: "http://localhost:8080",
      sidecarUrl: "http://localhost:7047",
      policyClient: "0x1",
      intentFrom: "0x2",
      intentTo: "0x3",
      chainId: "31337",
    });

    expect(result.browser.status).toBe("success");
    expect(result.extension.status).toBe("success");
    expect(result.gateway.status).toBe("success");
    expect(result.attester.status).toBe("success");
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8080/health", { method: "GET" });
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:7047/health", { method: "GET" });
  });

  it("fails system checks when the TLSNotary extension bridge is missing", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkSystem({
      gatewayUrl: "http://localhost:8080",
      sidecarUrl: "http://localhost:7047",
      policyClient: "0x1",
      intentFrom: "0x2",
      intentTo: "0x3",
      chainId: "31337",
    });

    expect(result.extension.status).toBe("error");
    expect(result.extension.message).toContain("TLSNotary extension bridge not found");
  });

  it("creates an attester session, executes the extension proof, and stores proof bytes", async () => {
    const sdk = makeSdk();
    window.tlsn = {
      execCode: vi.fn(async (code: string) => {
        expect(code).toContain("x.com");
        expect(code).toContain("newton_protocol");
        expect(code).toContain("function latestTwitterHeader()");
        expect(code).toContain("getHeadersJson()");
        expect(code).toContain("proveJson(");
        expect(code).toContain('openWindow("https://x.com/" + TWITTER_USERNAME);');
        return JSON.stringify({ proofBase64: "cHJvb2Y=", followerCount: 4242 });
      }),
    };

    const result = await generateTwitterFollowerProof(sdk, {
      twitterUsername: "newton_protocol",
      minFollowers: 1000,
      attesterUrl: "http://localhost:7047",
    });

    expect(sdk.attester.createSession).not.toHaveBeenCalled();
    expect(window.tlsn.execCode).toHaveBeenCalledTimes(1);
    expect(sdk.proof.store).toHaveBeenCalledWith("cHJvb2Y=");
    expect(result).toMatchObject({
      cid: "bafyproof",
      followerCount: 4242,
      sessionId: "extension-managed",
      verifierUrl: "http://localhost:7047",
      proxyUrl: "ws://localhost:7047/proxy?token=x.com",
    });
  });

  it("stores serialized verifier results when the extension does not expose raw proof bytes", async () => {
    const sdk = makeSdk();
    window.tlsn = {
      execCode: vi.fn(async () => JSON.stringify({ results: [{ value: "4242" }] })),
    };

    await generateTwitterFollowerProof(sdk, {
      twitterUsername: "newton_protocol",
      minFollowers: 1000,
      attesterUrl: "http://localhost:7047",
    });

    const storedProof = vi.mocked(sdk.proof.store).mock.calls[0]?.[0];
    expect(storedProof).toEqual(expect.stringMatching(/^[A-Za-z0-9+/]+=*$/));
    expect(atob(storedProof)).toContain("newton-tlsn-attester-verification-v1");
  });

  it("submits the Twitter followers policy task with proof CID and two-phase evaluation", async () => {
    const sdk = makeSdk();

    await submitTwitterFollowersTask(sdk, {
      policyClient: "0x1111111111111111111111111111111111111111",
      from: "0x2222222222222222222222222222222222222222",
      to: "0x3333333333333333333333333333333333333333",
      proofCid: "bafyproof",
      minFollowers: 1000,
      twitterUsername: "newton_protocol",
      chainId: 31337,
    });

    expect(sdk.task.createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        policyClient: "0x1111111111111111111111111111111111111111",
        proofCid: "bafyproof",
        useTwoPhase: true,
        intent: expect.objectContaining({
          chainId: "0x7a69",
        }),
        wasmArgs: {
          min_followers: 1000,
          twitter_username: "newton_protocol",
          base_symbol: "BTC",
          quote_symbol: "USD",
          feed_id: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
        },
      }),
    );
  });
});
