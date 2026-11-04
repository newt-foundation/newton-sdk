/**
 * Newton Protocol Gateway JSON-RPC client.
 *
 * Wraps all `newt_*` RPC methods exposed by the gateway at POST /rpc.
 */

import type {
  CreateTaskRequest,
  CreateTaskResponse,
  GetConfidentialDataRequest,
  GetConfidentialDataResponse,
  GetIdentityRequest,
  GetIdentityResponse,
  GetPrivacyPublicKeyResponse,
  GetSecretsPublicKeyResponse,
  JsonRpcRequest,
  JsonRpcResponse,
  NewtonSDKConfig,
  RegisterWebhookRequest,
  RegisterWebhookResponse,
  SendTaskRequest,
  SendTaskResponse,
  SimulatePolicyDataRequest,
  SimulatePolicyDataResponse,
  SimulatePolicyDataWithClientRequest,
  SimulatePolicyRequest,
  SimulatePolicyResponse,
  SimulateTaskRequest,
  SimulateTaskResponse,
  StoreSecretsRequest,
  StoreSecretsResponse,
  UnregisterWebhookResponse,
  UploadConfidentialDataRequest,
  UploadConfidentialDataResponse,
  UploadIdentityRequest,
  UploadIdentityResponse,
} from "./types.js";
import { RpcError, TimeoutError } from "./errors.js";
import { camelToSnake } from "./utils.js";

export class GatewayClient {
  private readonly url: string;
  private readonly headers: Record<string, string>;
  private readonly timeout: number;

  constructor(config: NewtonSDKConfig) {
    // Ensure URL ends with /rpc
    this.url = config.gatewayUrl.endsWith("/rpc")
      ? config.gatewayUrl
      : `${config.gatewayUrl.replace(/\/+$/, "")}/rpc`;

    this.headers = { "Content-Type": "application/json" };
    if (config.apiKey) {
      this.headers["Authorization"] = `Bearer ${config.apiKey}`;
    }
    this.timeout = config.timeout ?? 30_000;
  }

  // -------------------------------------------------------------------------
  // Task management
  // -------------------------------------------------------------------------

  /** Create a task synchronously — waits for BLS aggregation result. */
  async createTask(req: CreateTaskRequest): Promise<CreateTaskResponse> {
    return this.call("newt_createTask", req);
  }

  /** Send a task asynchronously — returns immediately with a subscription topic. */
  async sendTask(req: SendTaskRequest): Promise<SendTaskResponse> {
    return this.call("newt_sendTask", req);
  }

  /** Simulate a task with pre-assembled policy data (replay mode). */
  async simulateTask(req: SimulateTaskRequest): Promise<SimulateTaskResponse> {
    return this.call("newt_simulateTask", req);
  }

  // -------------------------------------------------------------------------
  // Policy simulation
  // -------------------------------------------------------------------------

  /** Full policy evaluation simulation with WASM execution pipeline. */
  async simulatePolicy(req: SimulatePolicyRequest): Promise<SimulatePolicyResponse> {
    return this.call("newt_simulatePolicy", req);
  }

  /** Direct WASM execution with caller-provided secrets. */
  async simulatePolicyData(req: SimulatePolicyDataRequest): Promise<SimulatePolicyDataResponse> {
    return this.call("newt_simulatePolicyData", req);
  }

  /** WASM execution with stored DB secrets (requires ownership verification). */
  async simulatePolicyDataWithClient(
    req: SimulatePolicyDataWithClientRequest,
  ): Promise<SimulatePolicyDataResponse> {
    return this.call("newt_simulatePolicyDataWithClient", req);
  }

  // -------------------------------------------------------------------------
  // Secrets & data
  // -------------------------------------------------------------------------

  /** Upload HPKE-encrypted secrets for a policy client. */
  async storeEncryptedSecrets(req: StoreSecretsRequest): Promise<StoreSecretsResponse> {
    return this.call("newt_storeEncryptedSecrets", req);
  }

  /** Upload identity data with EIP-712 signature. */
  async uploadIdentityEncrypted(req: UploadIdentityRequest): Promise<UploadIdentityResponse> {
    return this.call("newt_uploadIdentityEncrypted", req);
  }

  /** Retrieve encrypted identity data by content-hash reference. */
  async getIdentityEncrypted(req: GetIdentityRequest): Promise<GetIdentityResponse> {
    return this.call("newt_getIdentityEncrypted", req);
  }

  /** Upload confidential data. */
  async uploadConfidentialData(
    req: UploadConfidentialDataRequest,
  ): Promise<UploadConfidentialDataResponse> {
    return this.call("newt_uploadConfidentialData", req);
  }

  /** Retrieve confidential data by reference ID. */
  async getConfidentialData(req: GetConfidentialDataRequest): Promise<GetConfidentialDataResponse> {
    return this.call("newt_getConfidentialData", req);
  }

  // -------------------------------------------------------------------------
  // Public keys
  // -------------------------------------------------------------------------

  /** Get X25519 HPKE public key for privacy (threshold MPK if DKG enabled). */
  async getPrivacyPublicKey(): Promise<GetPrivacyPublicKeyResponse> {
    return this.call("newt_getPrivacyPublicKey", {});
  }

  /** Get individual operator HPKE public key for secrets encryption. */
  async getSecretsPublicKey(): Promise<GetSecretsPublicKeyResponse> {
    return this.call("newt_getSecretsPublicKey", {});
  }

  // -------------------------------------------------------------------------
  // Webhooks
  // -------------------------------------------------------------------------

  /** Register the failure-notification webhook for this API key. */
  async registerWebhook(req: RegisterWebhookRequest): Promise<RegisterWebhookResponse> {
    return this.call("newt_registerWebhook", req);
  }

  /** Remove the webhook registered for this API key. */
  async unregisterWebhook(): Promise<UnregisterWebhookResponse> {
    return this.call("newt_unregisterWebhook", {});
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  /**
   * Send a JSON-RPC call to the gateway. Only the top-level request params are
   * converted from camelCase to snake_case to match the gateway's Rust serde
   * conventions. Nested objects intentionally pass through unchanged: `intent`
   * is the known exception because the gateway accepts its camelCase fields
   * (`chainId`, `functionSignature`). If a future nested object needs snake_case
   * fields, add an explicit converter for that shape instead of relying on this
   * shallow helper.
   */
  private async call<TReq, TRes>(
    method: string,
    params: TReq,
  ): Promise<TRes> {
    const id = this.nextRequestId();

    // Convert top-level keys to snake_case for the gateway
    const snakeParams = camelToSnake(params as unknown as Record<string, unknown>);

    const body: JsonRpcRequest<typeof snakeParams> = {
      jsonrpc: "2.0",
      id,
      method,
      params: snakeParams,
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(this.url, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      // Reject responses that advertise an oversized body before reading it.
      // Production gateways send compact JSON-RPC envelopes; a multi-MiB body
      // here is either misconfigured or hostile and should not pour into JSON.parse.
      if (!isAdvertisedSizeAcceptable(response)) {
        throw new RpcError(
          method,
          response.status,
          "response_too_large",
          `body exceeds ${MAX_RPC_BODY_BYTES} byte cap`,
        );
      }

      const text = await readBoundedText(response);
      const envelope = parseJson(text) as JsonRpcResponse<TRes> | null | undefined;

      if (envelope?.error != null) {
        const { code, message, data } = parseGatewayError(envelope.error);
        throw new RpcError(method, response.status, code, message, data);
      }
      if (!response.ok) {
        throw new RpcError(
          method,
          response.status,
          "http_error",
          text || response.statusText || "empty body",
        );
      }
      // A method can answer with a null result, so only a body without the key is malformed.
      if (envelope == null || typeof envelope !== "object" || !("result" in envelope)) {
        throw new RpcError(method, response.status, "malformed_response", "expected a JSON-RPC result");
      }

      return envelope.result as TRes;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new TimeoutError(this.timeout);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  private nextRequestId(): string | null {
    // The gateway parses `id` as an optional UUID, answers any other value with
    // a 422, and assigns its own id, so without crypto.randomUUID send null.
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return null;
  }
}

// JSON-RPC envelopes are compact by design; cap defends against a hostile or
// misconfigured upstream pushing megabytes through the error/JSON paths.
const MAX_RPC_BODY_BYTES = 1_048_576;

function isAdvertisedSizeAcceptable(response: Response): boolean {
  const header =
    typeof response.headers?.get === "function"
      ? response.headers.get("content-length")
      : null;
  if (!header) return true;
  const declared = Number.parseInt(header, 10);
  return Number.isFinite(declared) && declared <= MAX_RPC_BODY_BYTES;
}

async function readBoundedText(response: Response): Promise<string> {
  const text = await response.text();
  return text.length > MAX_RPC_BODY_BYTES ? text.slice(0, MAX_RPC_BODY_BYTES) : text;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // Status-only rejections (401 bad key, 408, 413, 503) and axum's 400/415/422
    // body rejections carry an empty or plain-text body.
    return undefined;
  }
}

/**
 * The gateway serializes its error enum with serde's external tagging: a unit
 * variant is a bare string (`"RateLimitExceeded"`), any other variant a one-key
 * object (`{"InvalidRequest":"..."}`, `{"QuorumNotReached":[reason, errors]}`).
 */
function parseGatewayError(error: unknown): { code: string; message: string; data?: unknown } {
  if (typeof error === "string") return { code: error, message: error };
  const entries = error !== null && typeof error === "object" ? Object.entries(error) : [];
  if (entries.length === 1) {
    const [code, data] = entries[0];
    return { code, message: typeof data === "string" ? data : JSON.stringify(data), data };
  }
  return { code: "unknown_error", message: JSON.stringify(error), data: error };
}
