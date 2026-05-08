import { createNewtonSDK } from "@newton-protocol/zktls-twitter-example";
import type { CreateTaskResponse, NewtonSDK } from "@newton-protocol/zktls-twitter-example";
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

const TWITTER_API_HOST = "x.com";

interface ExtensionProofResult {
  error?: string;
  errorMessage?: string;
  proof?: string;
  proofBase64?: string;
  followerCount?: number;
  followersCount?: number;
  followers_count?: number;
  serverName?: string;
  requestTarget?: string;
  responseBody?: string;
  sessionId?: string;
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

function hasTlsnExtension(): boolean {
  return typeof window !== "undefined" && typeof window.tlsn?.execCode === "function";
}

async function checkTlsnExtension(): Promise<SystemCheckResult> {
  if (hasTlsnExtension()) {
    return { status: "success", message: "TLSNotary extension bridge available" };
  }

  await new Promise<void>((resolve) => {
    if (typeof window === "undefined") {
      resolve();
      return;
    }

    const timeout = window.setTimeout(resolve, 750);
    window.addEventListener(
      "tlsn_loaded",
      () => {
        window.clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
  });

  return hasTlsnExtension()
    ? { status: "success", message: "TLSNotary extension bridge available" }
    : {
        status: "error",
        message: "TLSNotary extension bridge not found; use the Chrome for Testing window with the unpacked extension loaded",
      };
}

export async function checkSystem(config: DemoConfig): Promise<SystemChecks> {
  const browserSupported =
    typeof WebSocket !== "undefined" &&
    typeof fetch !== "undefined" &&
    typeof crypto !== "undefined" &&
    isChromeLikeBrowser();

  const [extension, gateway, attester] = await Promise.all([
    checkTlsnExtension(),
    checkHttpHealth(config.gatewayUrl, "Gateway"),
    checkHttpHealth(config.sidecarUrl, "Attester sidecar"),
  ]);

  return {
    browser: browserSupported
      ? { status: "success", message: "Chrome-compatible browser with fetch/WebSocket APIs" }
      : { status: "error", message: "Use Chrome/Brave/Edge with fetch, WebSocket, and crypto APIs" },
    extension,
    gateway,
    attester,
  };
}

function buildTwitterPluginSource(request: ProofRequest, verifierUrl: string, proxyUrl: string): string {
  return `
    /// <reference types="@tlsn/plugin-sdk/src/globals" />

    const VERIFIER_URL = ${JSON.stringify(verifierUrl)};
    const PROXY_URL = ${JSON.stringify(proxyUrl)};
    const TWITTER_USERNAME = ${JSON.stringify(request.twitterUsername)};
    let windowOpened = false;

    function isUserByScreenNameHeader(header) {
      const url = header?.url ?? "";
      const decodedUrl = decodeURIComponent(url);
      return url.includes("x.com/i/api/graphql/") &&
        url.includes("/UserByScreenName?") &&
        decodedUrl.includes('"screen_name":"' + TWITTER_USERNAME + '"');
    }

    function latestTwitterHeader() {
      return JSON.parse(getHeadersJson())
        .filter(isUserByScreenNameHeader)
        .slice(-1)[0];
    }

    function normalizeJsonBody(body) {
      if (typeof body !== "string") return "";
      const start = body.indexOf("{");
      const end = body.lastIndexOf("}");
      return start >= 0 && end > start ? body.slice(start, end + 1) : body;
    }

    function readFollowerCount(responseBody) {
      try {
        const responseJson = JSON.parse(normalizeJsonBody(responseBody));
        const followers =
          responseJson?.data?.public_metrics?.followers_count ??
          responseJson?.data?.user?.result?.legacy?.followers_count;
        return typeof followers === "number" ? followers : undefined;
      } catch {
        return undefined;
      }
    }

    const config = {
      name: "Newton Twitter/X follower prover",
      description: "Proves a Twitter/X follower count for Newton policy evaluation.",
      requests: [{ method: "GET", host: "${TWITTER_API_HOST}", pathname: "/i/api/graphql/*/UserByScreenName", verifierUrl: VERIFIER_URL }],
      urls: ["https://x.com/*", "https://twitter.com/*"],
    };

    async function onClick() {
      setState("proofError", "");
      setState("isProving", true);

      const header = latestTwitterHeader();
      if (!header?.url) {
        throw new Error("Open the target X profile while logged in so the extension can capture the UserByScreenName API request");
      }

      const requestHeaders = header?.requestHeaders ?? [];
      const findHeader = (name) => requestHeaders.find((h) => h.name.toLowerCase() === name)?.value;
      const cookie = findHeader("cookie");
      const csrfToken = findHeader("x-csrf-token");
      const authorization = findHeader("authorization");

      if (!cookie || !csrfToken || !authorization) {
        throw new Error("Open x.com while logged in so the extension can capture Twitter/X auth headers");
      }

      const requestUrl = header.url;
      const requestPath = new URL(requestUrl).pathname + new URL(requestUrl).search;
      const requestHost = new URL(requestUrl).host;
      const passthroughHeaders = {};
      requestHeaders.forEach((h) => {
        const name = h.name;
        const lower = name.toLowerCase();
        if (lower.startsWith(":") || ["host", "content-length", "accept-encoding", "connection"].includes(lower)) {
          return;
        }
        passthroughHeaders[name] = h.value;
      });

      const proofResult = JSON.parse(await proveJson(
        {
          url: requestUrl,
          method: "GET",
          headers: {
            ...passthroughHeaders,
            Host: requestHost,
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
            { type: "RECV", part: "BODY", action: "REVEAL" },
          ],
        }
      ));

      const responseBody = proofResult.results?.find?.((result) =>
        result?.type === "RECV" && result?.part === "BODY"
      )?.value;
      const normalizedResponseBody = normalizeJsonBody(responseBody);
      const followerCount = readFollowerCount(normalizedResponseBody);

      done(JSON.stringify({
        proofBase64: proofResult.proofBase64 || proofResult.proof,
        followerCount: typeof followerCount === "number" ? followerCount : undefined,
        twitterUsername: TWITTER_USERNAME,
        sessionId: proofResult.sessionId,
        serverName: proofResult.serverName || "${TWITTER_API_HOST}",
        requestTarget: requestPath,
        responseBody: normalizedResponseBody,
        results: proofResult.results,
      }));
    }

    function main() {
      if (!windowOpened) {
        windowOpened = true;
        openWindow("https://x.com/" + TWITTER_USERNAME);
      }

      const header = latestTwitterHeader();
      const requestHeaders = header?.requestHeaders ?? [];
      const findHeader = (name) => requestHeaders.find((h) => h.name.toLowerCase() === name)?.value;
      const ready = Boolean(findHeader("cookie") && findHeader("x-csrf-token") && findHeader("authorization"));
      const autoStarted = useState("autoStarted", false);
      const isProving = useState("isProving", false);
      const proofError = useState("proofError", "");

      useEffect(() => {
        if (!ready || autoStarted || isProving) return;

        setState("autoStarted", true);
        onClick().catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          setState("proofError", message);
          done(JSON.stringify({ errorMessage: message }));
        });
      }, [ready, autoStarted, isProving]);

      return div({ style: { padding: "12px", fontFamily: "system-ui", background: "white" } }, [
        div({ style: { fontWeight: "700", marginBottom: "8px" } }, ["Newton Twitter/X follower prover"]),
        div({ style: { marginBottom: "12px" } }, ["Open x.com while logged in. The proof starts automatically after X auth headers are detected for @" + TWITTER_USERNAME + "."]),
        div({ style: { marginBottom: "12px", color: ready ? "#166534" : "#92400e" } }, [
          isProving ? "Generating zkTLS proof..." : ready ? "X auth headers detected. Starting proof automatically." : "Waiting for UserByScreenName auth headers from a logged-in X tab."
        ]),
        proofError ? div({ style: { marginBottom: "12px", color: "#b91c1c" } }, [
          "Proof failed: " + proofError
        ]) : div({ style: { display: "none" } }, [
          ""
        ]),
        button({ onclick: "onClick" }, ["Generate zkTLS proof"]),
      ]);
    }

    export default { main, onClick, config };
  `;
}

function encodeBase64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  if (typeof btoa === "function") {
    return btoa(binary);
  }

  const nodeBuffer = (globalThis as unknown as {
    Buffer?: { from(value: Uint8Array): { toString(encoding: "base64"): string } };
  }).Buffer;
  if (nodeBuffer) {
    return nodeBuffer.from(bytes).toString("base64");
  }

  throw new Error("No base64 encoder is available");
}

function readExtensionResult(raw: string): ExtensionProofResult {
  const parsed = JSON.parse(raw) as ExtensionProofResult;
  if (parsed.errorMessage || parsed.error) {
    throw new Error(parsed.errorMessage ?? parsed.error);
  }

  const nested = typeof parsed.results === "object" && parsed.results !== null
    ? (parsed.results as Record<string, unknown>)
    : undefined;
  const proofBase64 = parsed.proofBase64
    ?? parsed.proof
    ?? (nested?.proofBase64 as string | undefined)
    ?? encodeBase64Utf8(JSON.stringify({
      type: "newton-tlsn-attester-verification-v1",
      payload: {
        ...parsed,
        serverName: parsed.serverName ?? TWITTER_API_HOST,
      },
    }));

  return {
    ...parsed,
    proofBase64,
    followerCount:
      parsed.followerCount ??
      parsed.followersCount ??
      parsed.followers_count ??
      (nested?.followerCount as number | undefined) ??
      (nested?.followers_count as number | undefined) ??
      (() => {
        try {
          const response = parsed.responseBody ? JSON.parse(parsed.responseBody) : undefined;
          const followers =
            response?.data?.public_metrics?.followers_count ??
            response?.data?.user?.result?.legacy?.followers_count;
          return typeof followers === "number" ? followers : undefined;
        } catch {
          return undefined;
        }
      })(),
  };
}

function toHexQuantity(value: string | number): string {
  if (typeof value === "string" && value.trim().startsWith("0x")) {
    return value.trim().toLowerCase();
  }

  return `0x${BigInt(String(value || "0")).toString(16)}`;
}

function buildVerifierUrl(attesterUrl: string): string {
  return attesterUrl.replace(/\/+$/, "");
}

function buildProxyUrl(attesterUrl: string, host: string): string {
  const url = new URL(buildVerifierUrl(attesterUrl));
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/proxy";
  url.search = "";
  url.searchParams.set("token", host);
  return url.toString();
}

export async function generateTwitterFollowerProof(
  sdk: NewtonSDK,
  request: ProofRequest,
): Promise<ProofGenerationResult> {
  if (!hasTlsnExtension()) {
    throw new Error("TLSNotary browser extension is required to generate the MPC-TLS proof");
  }
  const tlsn = window.tlsn;
  if (!tlsn) {
    throw new Error("TLSNotary browser extension is required to generate the MPC-TLS proof");
  }

  const verifierUrl = buildVerifierUrl(request.attesterUrl);
  const proxyUrl = buildProxyUrl(request.attesterUrl, TWITTER_API_HOST);
  const pluginSource = buildTwitterPluginSource(request, verifierUrl, proxyUrl);
  const rawResult = await tlsn.execCode(pluginSource);
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
    sessionId: extensionResult.sessionId ?? "extension-managed",
    serverName: extensionResult.serverName ?? TWITTER_API_HOST,
    verifierUrl,
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
      chainId: toHexQuantity(submission.chainId),
      functionSignature: "0x",
    },
    proofCid: submission.proofCid,
    wasmArgs: {
      min_followers: submission.minFollowers,
      twitter_username: submission.twitterUsername,
      base_symbol: "BTC",
      quote_symbol: "USD",
      feed_id: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
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
      apiKey: config.apiKey,
      timeout: 30_000,
    });
  },
  checkSystem,
  generateProof: generateTwitterFollowerProof,
  submitTask: submitTwitterFollowersTask,
};
