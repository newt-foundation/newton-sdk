/**
 * Newton Protocol SDK — Core type definitions
 *
 * Mirrors the Rust types in crates/gateway/src/rpc/. Request fields are camelCase
 * here and converted shallowly to snake_case on the wire (the nested `intent`
 * stays camelCase); response fields keep the gateway's snake_case names.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/**
 * Ethereum address (0x-prefixed hex string).
 *
 * TODO: If this example package graduates beyond tutorial/demo scope, re-export
 * viem's branded `Address` type from the main SDK so invalid addresses fail at
 * compile time.
 */
export type Address = `0x${string}`;

/** Hex-encoded bytes (0x-prefixed) */
export type HexBytes = string;

/** Uint256 represented as 0x-prefixed hex string */
export type U256 = string;

/** Task identifier: 0x-prefixed 32-byte hex */
export type TaskId = string;

// ---------------------------------------------------------------------------
// Intent
// ---------------------------------------------------------------------------

/** Transaction intent to be evaluated by the policy engine. */
export interface TaskIntent {
  from: Address;
  to: Address;
  value: U256;
  data: HexBytes;
  chainId: U256;
  functionSignature: HexBytes;
}

// ---------------------------------------------------------------------------
// Task status
// ---------------------------------------------------------------------------

export type TaskStatus = "pending" | "processing" | "success" | "failed" | "timeout";

export type OperatorStatus = "success" | "error" | "timeout" | "unavailable";

// ---------------------------------------------------------------------------
// Create Task (synchronous)
// ---------------------------------------------------------------------------

export interface CreateTaskRequest {
  policyClient: Address;
  intent: TaskIntent;
  intentSignature?: string;
  quorumNumber?: string;
  quorumThresholdPercentage?: number;
  /** One hex entry per policy in the client's policy set, `"0x"` for a pure-Rego policy. */
  wasmArgs?: HexBytes[];
  timeout?: number;
  /**
   * @deprecated The gateway rejects any value with InvalidRequest "proof_cid is
   * unsupported; zkTLS proof verification is unavailable".
   */
  proofCid?: string;
  includeValidateCalldata?: boolean;
}

export interface OperatorError {
  operator_address: Address;
  operator_id: string;
  error_code: number;
  message: string;
  /** RFC 3339 */
  timestamp: string;
  retryable: boolean;
}

export interface CreateTaskResponse {
  task_id: TaskId;
  status: TaskStatus;
  /** TODO: Replace `unknown` with concrete BLS aggregation response shape once the gateway schema stabilizes. */
  bls_aggregation_result?: unknown;
  signature_data?: string | null;
  /** TODO: Replace `unknown` with concrete task metadata shape once the gateway schema stabilizes. */
  task?: unknown;
  task_response?: unknown;
  reference_block?: number | null;
  expiration?: number | null;
  validate_calldata?: string | null;
  error?: string | null;
  operator_errors?: OperatorError[];
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Send Task (asynchronous)
// ---------------------------------------------------------------------------

export interface SendTaskRequest {
  policyClient: Address;
  intent: TaskIntent;
  intentSignature?: string;
  quorumNumber?: string;
  quorumThresholdPercentage?: number;
  /** One hex entry per policy in the client's policy set, `"0x"` for a pure-Rego policy. */
  wasmArgs?: HexBytes[];
  timeout?: number;
  /**
   * @deprecated The gateway rejects any value with InvalidRequest "proof_cid is
   * unsupported; zkTLS proof verification is unavailable".
   */
  proofCid?: string;
}

export interface SendTaskResponse {
  task_id: TaskId;
  /** Topic for the /ws subscribe frame: the task id as bare lowercase hex, no `0x`. */
  subscription_topic: string;
  message: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Simulate Task
// ---------------------------------------------------------------------------

export interface SimulateTaskRequest {
  policyClient: Address;
  chainId: number;
  intent: TaskIntent;
  /** One hex entry per policy, as for createTask. */
  wasmArgs?: HexBytes[];
}

export interface PolicySimulationResult {
  policy_index: number;
  policy: Address;
  result: unknown;
  allowed: boolean;
  expire_after: number;
}

export interface SimulateTaskResponse {
  success: boolean;
  /** AND over every policy in the set. */
  allowed?: boolean | null;
  policy_id?: string | null;
  policies?: PolicySimulationResult[] | null;
  error?: string | null;
  parsed_intent?: unknown;
}

// ---------------------------------------------------------------------------
// Simulate Policy (full evaluation)
// ---------------------------------------------------------------------------

export interface SimulatePolicyRequest {
  policyClient: Address;
  chainId: number;
  intent: TaskIntent;
  /** One hex entry per policy, as for createTask. */
  wasmArgs?: HexBytes[];
  intentSignature?: string;
}

export type SimulatePolicyResponse = SimulateTaskResponse;

// ---------------------------------------------------------------------------
// Simulate Policy Data (WASM execution)
// ---------------------------------------------------------------------------

export interface SimulatePolicyDataRequest {
  /** NewtonPolicy contract address; the gateway reads the WASM and secrets schema from it. */
  policyAddress: Address;
  chainId: number;
  /** HPKE SecureEnvelope as a JSON object, not a string. */
  secrets?: Record<string, unknown>;
  wasmArgs?: HexBytes;
}

export interface SimulatePolicyDataWithClientRequest {
  /** NewtonPolicy contract address; the gateway reads the WASM and secrets schema from it. */
  policyAddress: Address;
  chainId: number;
  policyClient: Address;
  wasmArgs?: HexBytes;
}

export interface SimulatePolicyDataResponse {
  success: boolean;
  policy_data?: unknown;
  error?: string | null;
}

// ---------------------------------------------------------------------------
// Secrets
// ---------------------------------------------------------------------------

export interface StoreSecretsRequest {
  policyClient: Address;
  policyAddress: Address;
  envelope: string;
  chainId: number;
}

export interface StoreSecretsResponse {
  success: boolean;
  schema?: unknown;
  error?: string;
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export interface UploadIdentityRequest {
  identityOwner: Address;
  identityOwnerSig: HexBytes;
  envelope: string;
  identityDomain: string;
  chainId: number;
}

export interface UploadIdentityResponse {
  data_ref_id: string;
  gateway_signature: string;
  deadline: number;
}

export interface GetIdentityRequest {
  dataRefId: string;
}

export interface GetIdentityResponse {
  envelope: string;
  identity_domain: string;
  identity_owner: string;
}

// ---------------------------------------------------------------------------
// Confidential Data
// ---------------------------------------------------------------------------

export interface UploadConfidentialDataRequest {
  provider: Address;
  /** bytes32, 0x-prefixed */
  domain: HexBytes;
  envelope: string;
  chainId: number;
}

export interface UploadConfidentialDataResponse {
  data_ref_id: string;
}

export interface GetConfidentialDataRequest {
  dataRefId: string;
}

export interface GetConfidentialDataResponse {
  envelope: string;
  domain: string;
  provider: string;
}

// ---------------------------------------------------------------------------
// Public Keys
// ---------------------------------------------------------------------------

export interface GetPrivacyPublicKeyResponse {
  public_key: string;
  key_type: string;
  encryption_suite: string;
}

export interface GetSecretsPublicKeyResponse {
  public_key: string;
  key_type: string;
  encryption_suite: string;
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

/** Failure categories a webhook can filter on. */
export type WebhookFailureType =
  | "channel_error"
  | "timeout"
  | "quorum_not_reached"
  | "onchain_submission_failed"
  | "policy_evaluation_failed"
  | "signature_verification_failed"
  | "internal_error";

/** The webhook belongs to the calling API key. */
export interface RegisterWebhookRequest {
  /** https://, or http://localhost for local testing */
  url: string;
  secret?: string;
  /** Default 10 */
  timeoutSeconds?: number;
  /** Default 3 */
  maxRetries?: number;
  failureTypes?: WebhookFailureType[];
}

export interface RegisterWebhookResponse {
  success: boolean;
  message: string;
}

export interface UnregisterWebhookResponse {
  success: boolean;
  message: string;
}

// ---------------------------------------------------------------------------
// Task WebSocket Events
// ---------------------------------------------------------------------------

/** The gateway only emits `status_update`; completion shows in `data.status`. */
export type TaskEventType = "status_update" | "success" | "failure" | "operator_response";

export interface OperatorResponse {
  operator_id: string;
  operator_address: Address;
  status: OperatorStatus;
  data?: unknown;
  error?: string | null;
  response_time_ms: number;
}

export interface TaskUpdateData {
  status: TaskStatus;
  operator_responses: OperatorResponse[];
  result?: unknown;
  error?: string | null;
  progress: number;
}

/** The `result` of a gateway `update` frame on /ws. */
export interface TaskUpdateEvent {
  event: TaskEventType;
  task_id: TaskId;
  timestamp: number;
  data: TaskUpdateData;
}

// ---------------------------------------------------------------------------
// Attester / MPC-TLS Session
// ---------------------------------------------------------------------------

export interface SessionRegisterMessage {
  type: "register";
  maxRecvData: number;
  maxSentData: number;
}

export interface SessionRegisteredMessage {
  type: "sessionRegistered" | "session_registered";
  sessionId: string;
}

export type HandlerType = "SENT" | "RECV";

export type HandlerPart =
  | "START_LINE"
  | "PROTOCOL"
  | "METHOD"
  | "REQUEST_TARGET"
  | "STATUS_CODE"
  | "HEADERS"
  | "BODY"
  | "ALL";

export interface RangeWithHandler {
  start: number;
  end: number;
  handler: {
    type: HandlerType;
    part: HandlerPart;
  };
}

export interface RevealConfigMessage {
  type: "revealConfig";
  sent: RangeWithHandler[];
  recv: RangeWithHandler[];
}

export interface HandlerResult {
  type: HandlerType;
  part: HandlerPart;
  value: string;
}

export interface SessionCompletedMessage {
  type: "sessionCompleted" | "session_completed";
  results: HandlerResult[];
}

export interface SessionErrorMessage {
  type: "error";
  message: string;
}

export type SessionServerMessage =
  | SessionRegisteredMessage
  | SessionCompletedMessage
  | SessionErrorMessage;

export type SessionClientMessage = SessionRegisterMessage | RevealConfigMessage;

// ---------------------------------------------------------------------------
// Proof (IPFS)
// ---------------------------------------------------------------------------

export interface StoreProofRequest {
  proof: string; // base64-encoded BCS bytes
}

export interface StoreProofResponse {
  cid: string;
  url?: string;
}

// ---------------------------------------------------------------------------
// JSON-RPC
// ---------------------------------------------------------------------------

export interface JsonRpcRequest<T = unknown> {
  jsonrpc: "2.0";
  /** A UUID or null: the gateway answers any other id with a 422 and assigns its own. */
  id: string | null;
  method: string;
  params: T;
}

export interface JsonRpcResponse<T = unknown> {
  jsonrpc: "2.0";
  id: string | null;
  result?: T | null;
  error?: JsonRpcError | null;
}

/**
 * The gateway's error enum in serde's external tagging: a bare string for a
 * unit variant (`"RateLimitExceeded"`), otherwise a one-key object
 * (`{"InvalidRequest":"..."}`).
 */
export type JsonRpcError = string | Record<string, unknown>;

// ---------------------------------------------------------------------------
// SDK Configuration
// ---------------------------------------------------------------------------

export interface NewtonSDKConfig {
  /** Gateway RPC endpoint URL (e.g. "http://localhost:8080/rpc") */
  gatewayUrl: string;
  /** Attester endpoint URL (e.g. "http://localhost:7047") */
  attesterUrl?: string;
  /** API key: a Bearer header on /rpc, a `newton.bearer.<key>` subprotocol on /ws */
  apiKey?: string;
  /** Default timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Default chain ID */
  chainId?: number;
}
