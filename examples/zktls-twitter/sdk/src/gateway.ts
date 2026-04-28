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
  UnregisterWebhookRequest,
  UnregisterWebhookResponse,
  UploadConfidentialDataRequest,
  UploadConfidentialDataResponse,
  UploadIdentityRequest,
  UploadIdentityResponse,
} from "./types.js";
import { JsonRpcError_, TimeoutError } from "./errors.js";
import { camelToSnake } from "./utils.js";

export class GatewayClient {
  private readonly url: string;
  private readonly headers: Record<string, string>;
  private readonly timeout: number;
  private requestId = 0;

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

  /** Register a webhook for failure notifications. */
  async registerWebhook(req: RegisterWebhookRequest): Promise<RegisterWebhookResponse> {
    return this.call("newt_registerWebhook", req);
  }

  /** Remove a webhook configuration. */
  async unregisterWebhook(req: UnregisterWebhookRequest): Promise<UnregisterWebhookResponse> {
    return this.call("newt_unregisterWebhook", req);
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
    const id = ++this.requestId;

    // Convert top-level keys to snake_case for the gateway
    const snakeParams = camelToSnake(params as unknown as Record<string, unknown>);

    const body: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params: [snakeParams],
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

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const json = (await response.json()) as JsonRpcResponse<TRes>;

      if (json.error) {
        throw new JsonRpcError_(json.error);
      }

      return json.result as TRes;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new TimeoutError(this.timeout);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
