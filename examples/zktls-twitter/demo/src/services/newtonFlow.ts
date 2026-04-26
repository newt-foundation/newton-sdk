import { createNewtonSDK } from "@newton-protocol/zktls-sdk";
import type { CreateTaskResponse, NewtonSDK } from "@newton-protocol/zktls-sdk";
import type {
  DemoConfig,
  DemoServices,
  ProofGenerationResult,
  ProofRequest,
  SystemCheckResult,
  SystemChecks,
  TwitterTaskSubmission,
} from "../types";
import { isChromeLikeBrowser } from "../utils";

const TWITTER_API_HOST = "api.x.com";

interface ExtensionProofResult {
  proof?: string;
  proofBase64?: string;
  followerCount?: number;
  followersCount?: number;
  followers_count?: number;
  twitterUsername?: string;
  results?: unknown;
}

async function checkHttpHealth(baseUrl: string, label: string): Promise<SystemCheckResult> {
  const normalized = baseUrl.replace(/\/+$/, "");
  const candidates = [`${normalized}/health`, `${normalized}/v1/health`, normalized];

  for (const url of candidates) {
    try {
      const response = await fetch(url, { method: "GET" });
      if (response.ok) {
        return { status: "success", message: `${label} reachable at ${url}` };
      }
    } catch {
      // Try the next health endpoint shape.
    }
  }

  return { status: "error", message: `${label} is not reachable at ${baseUrl}` };
}

export async function checkSystem(config: DemoConfig): Promise<SystemChecks> {
  const browserSupported =
    typeof WebSocket !== "undefined" &&
    typeof fetch !== "undefined" &&
    typeof crypto !== "undefined" &&
    isChromeLikeBrowser();

  const [gateway, attester] = await Promise.all([
    checkHttpHealth(config.gatewayUrl, "Gateway"),
    checkHttpHealth(config.sidecarUrl, "Attester sidecar"),
  ]);

  return {
    browser: browserSupported
      ? { status: "success", message: "Chrome-compatible browser with fetch/WebSocket APIs" }
      : { status: "error", message: "Use Chrome/Brave/Edge with fetch, WebSocket, and crypto APIs" },
    gateway,
    attester,
  };
}

function buildTwitterPluginSource(request: ProofRequest, verifierUrl: string, proxyUrl: string): string {
  const requestUrl = `https://${TWITTER_API_HOST}/2/users/by/username/${encodeURIComponent(
    request.twitterUsername,
  )}?user.fields=public_metrics`;

  return `
    /// <reference types="@tlsn/plugin-sdk/src/globals" />

    const VERIFIER_URL = ${JSON.stringify(verifierUrl)};
    const PROXY_URL = ${JSON.stringify(proxyUrl)};
    const REQUEST_URL = ${JSON.stringify(requestUrl)};
    const TWITTER_USERNAME = ${JSON.stringify(request.twitterUsername)};

    const config = {
      name: "Newton Twitter/X follower prover",
      description: "Proves a Twitter/X follower count for Newton policy evaluation.",
      requests: [{ method: "GET", host: "${TWITTER_API_HOST}", pathname: "/2/users/by/username/", verifierUrl: VERIFIER_URL }],
      urls: ["https://x.com/*", "https://twitter.com/*"],
    };

    async function onClick() {
      const [header] = useHeaders((headers) =>
        headers.filter((h) => h.url.includes("${TWITTER_API_HOST}"))
      );

      const requestHeaders = header?.requestHeaders ?? [];
      const findHeader = (name) => requestHeaders.find((h) => h.name.toLowerCase() === name)?.value;
      const cookie = findHeader("cookie");
      const csrfToken = findHeader("x-csrf-token");
      const authorization = findHeader("authorization");
      const transactionId = findHeader("x-client-transaction-id");

      if (!cookie || !csrfToken || !authorization) {
        throw new Error("Open x.com while logged in so the extension can capture Twitter API auth headers");
      }

      const proofResult = await prove(
        {
          url: REQUEST_URL,
          method: "GET",
          headers: {
            cookie,
            "x-csrf-token": csrfToken,
            ...(transactionId ? { "x-client-transaction-id": transactionId } : {}),
            authorization,
            Host: "${TWITTER_API_HOST}",
            "Accept-Encoding": "identity",
            Connection: "close",
          },
        },
        {
          verifierUrl: VERIFIER_URL,
          proxyUrl: PROXY_URL,
          maxRecvData: 262144,
          maxSentData: 16384,
          handlers: [
            { type: "SENT", part: "START_LINE", action: "REVEAL" },
            { type: "RECV", part: "START_LINE", action: "REVEAL" },
            { type: "RECV", part: "HEADERS", action: "REVEAL", params: { key: "date" } },
            { type: "RECV", part: "BODY", action: "REVEAL", params: { type: "json", path: "data.public_metrics.followers_count" } },
            { type: "RECV", part: "BODY", action: "REVEAL", params: { type: "json", path: "data.username" } },
          ],
        }
      );

      const followerResult = proofResult.results?.find?.((result) =>
        String(result.value ?? "").match(/^\\d+$/)
      );

      done(JSON.stringify({
        proofBase64: proofResult.proofBase64 || proofResult.proof,
        followerCount: followerResult ? Number(followerResult.value) : undefined,
        twitterUsername: TWITTER_USERNAME,
        results: proofResult.results,
      }));
    }

    function main() {
      return div({ style: { padding: "12px", fontFamily: "system-ui", background: "white" } }, [
        h3({}, ["Newton Twitter/X follower prover"]),
        p({}, ["Open x.com while logged in, then generate a TLSNotary proof for @" + TWITTER_USERNAME + "."]),
        button({ onclick: "onClick" }, ["Generate zkTLS proof"]),
      ]);
    }
  `;
}

function readExtensionResult(raw: string): ExtensionProofResult {
  const parsed = JSON.parse(raw) as ExtensionProofResult;
  const nested = typeof parsed.results === "object" && parsed.results !== null
    ? (parsed.results as Record<string, unknown>)
    : undefined;

  return {
    ...parsed,
    proofBase64: parsed.proofBase64 ?? parsed.proof ?? (nested?.proofBase64 as string | undefined),
    followerCount:
      parsed.followerCount ??
      parsed.followersCount ??
      parsed.followers_count ??
      (nested?.followerCount as number | undefined) ??
      (nested?.followers_count as number | undefined),
  };
}

export async function generateTwitterFollowerProof(
  sdk: NewtonSDK,
  request: ProofRequest,
): Promise<ProofGenerationResult> {
  if (!window.tlsn?.execCode) {
    throw new Error("TLSNotary browser extension is required to generate the MPC-TLS proof");
  }

  const session = await sdk.attester.createSession({ maxRecvData: 262_144, maxSentData: 16_384 });
  const proxyUrl = session.proxyUrl(TWITTER_API_HOST);
  const pluginSource = buildTwitterPluginSource(request, session.verifierUrl, proxyUrl);
  const rawResult = await window.tlsn.execCode(pluginSource);
  const extensionResult = readExtensionResult(rawResult);

  if (!extensionResult.proofBase64) {
    throw new Error("TLSNotary extension did not return base64 proof bytes");
  }

  const stored = await sdk.proof.store(extensionResult.proofBase64);

  return {
    cid: stored.cid,
    url: stored.url,
    proofBase64: extensionResult.proofBase64,
    followerCount: extensionResult.followerCount ?? 0,
    twitterUsername: request.twitterUsername,
    sessionId: session.sessionId,
    verifierUrl: session.verifierUrl,
    proxyUrl,
  };
}

export async function submitTwitterFollowersTask(
  sdk: NewtonSDK,
  submission: TwitterTaskSubmission,
): Promise<CreateTaskResponse> {
  return sdk.task.createTask({
    policyClient: submission.policyClient,
    intent: {
      from: submission.from,
      to: submission.to,
      value: "0x0",
      data: "0x",
      chainId: "0xaa36a7",
      functionSignature: "0x",
    },
    proofCid: submission.proofCid,
    wasmArgs: {
      min_followers: submission.minFollowers,
      twitter_username: submission.twitterUsername,
    },
    timeout: 60,
    useTwoPhase: true,
  });
}

export const newtonDemoServices: DemoServices = {
  createSdk(config: DemoConfig): NewtonSDK {
    return createNewtonSDK({
      gatewayUrl: config.gatewayUrl,
      attesterUrl: config.sidecarUrl,
      timeout: 30_000,
    });
  },
  checkSystem,
  generateProof: generateTwitterFollowerProof,
  submitTask: submitTwitterFollowersTask,
};
