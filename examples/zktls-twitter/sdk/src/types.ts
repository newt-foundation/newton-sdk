/**
 * Newton Protocol SDK — Core type definitions
 *
 * Mirrors the Rust types in crates/gateway/src/rpc/types/ with camelCase JSON conventions.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/**
 * Ethereum address (0x-prefixed hex string).
 *
 * TODO: If this example package graduates beyond tutorial/demo scope, re-export
 * viem's branded `Address` type from the main SDK (or narrow to
 * `0x${string}`) so invalid addresses fail at compile time.
 */
export type Address = string;

/** Hex-encoded bytes (0x-prefixed) */
export type HexBytes = string;

/** Uint256 represented as 0x-prefixed hex string */
export type U256 = string;

/** Task identifier (u32 on-chain) */
export type TaskId = number;

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
  wasmArgs?: HexBytes;
  timeout?: number;
  useTwoPhase?: boolean;
  proofCid?: string;
  includeValidateCalldata?: boolean;
}

export interface OperatorError {
  operatorId: string;
  operatorAddress: Address;
  error: string;
}

export interface CreateTaskResponse {
  taskId: TaskId;
  status: TaskStatus;
  aggregationResponse?: unknown;
  signatureData?: string;
  task?: unknown;
  taskResponse?: unknown;
  referenceBlock?: number;
  expiration?: number;
  validateCalldata?: string;
  error?: string;
  operatorErrors?: OperatorError[];
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
  wasmArgs?: HexBytes;
  timeout?: number;
  proofCid?: string;
}

export interface SendTaskResponse {
  taskId: TaskId;
  subscriptionTopic: string;
  message: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Simulate Task
// ---------------------------------------------------------------------------

export interface SimulateTaskRequest {
  intent: TaskIntent;
  policyTaskData: unknown;
  chainId: number;
}

export interface SimulateTaskResponse {
  success: boolean;
  result?: unknown;
  error?: string;
  details?: unknown;
}

// ---------------------------------------------------------------------------
// Simulate Policy (full evaluation)
// ---------------------------------------------------------------------------

export interface PolicyDataInput {
  policyDataAddress: Address;
  wasmArgs?: HexBytes;
}

export interface SimulatePolicyRequest {
  policyClient: Address;
  chainId: number;
  policy: string;
  intent: TaskIntent;
  entrypoint?: string;
  policyData: PolicyDataInput[];
  policyParams?: Record<string, unknown>;
  intentSignature?: string;
}

export interface PolicyEvaluationResult {
  policy: string;
  parsedIntent: unknown;
  policyParamsAndData: unknown;
  entrypoint: string;
  result: unknown;
  expireAfter: number;
}

export interface MissingSecretInfo {
  policyDataAddress: Address;
  hasSecretsSchema: boolean;
}

export interface SimulatePolicyResponse {
  success: boolean;
  evaluationResult?: PolicyEvaluationResult;
  error?: string;
  errorDetails?: {
    missingSecrets: MissingSecretInfo[];
    suggestedActions: string[];
  };
}

// ---------------------------------------------------------------------------
// Simulate Policy Data (WASM execution)
// ---------------------------------------------------------------------------

export interface SimulatePolicyDataRequest {
  policyDataAddress: Address;
  chainId: number;
  secrets?: unknown;
  wasmArgs?: HexBytes;
}

export interface SimulatePolicyDataWithClientRequest {
  policyDataAddress: Address;
  chainId: number;
  policyClient: Address;
  wasmArgs?: HexBytes;
}

export interface SimulatePolicyDataResponse {
  success: boolean;
  policyData?: unknown;
  error?: string;
}

// ---------------------------------------------------------------------------
// Secrets
// ---------------------------------------------------------------------------

export interface StoreSecretsRequest {
  policyClient: Address;
  policyDataAddress: Address;
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
  dataRefId: string;
  gatewaySignature: string;
  deadline: number;
}

export interface GetIdentityRequest {
  dataRefId: string;
}

export interface GetIdentityResponse {
  envelope: string;
  identityDomain: string;
  identityOwner: string;
}

// ---------------------------------------------------------------------------
// Confidential Data
// ---------------------------------------------------------------------------

export interface UploadConfidentialDataRequest {
  policyClient: Address;
  policyDataAddress: Address;
  envelope: string;
  chainId: number;
}

export interface UploadConfidentialDataResponse {
  success: boolean;
  dataRefId?: string;
  error?: string;
}

export interface GetConfidentialDataRequest {
  dataRefId: string;
}

export interface GetConfidentialDataResponse {
  envelope: string;
}

// ---------------------------------------------------------------------------
// Public Keys
// ---------------------------------------------------------------------------

export interface GetPrivacyPublicKeyResponse {
  publicKey: string;
}

export interface GetSecretsPublicKeyResponse {
  publicKey: string;
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

export interface RegisterWebhookRequest {
  url: string;
  policyClient: Address;
  events?: string[];
}

export interface RegisterWebhookResponse {
  success: boolean;
  webhookId?: string;
  error?: string;
}

export interface UnregisterWebhookRequest {
  webhookId: string;
}

export interface UnregisterWebhookResponse {
  success: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Task WebSocket Events
// ---------------------------------------------------------------------------

export type TaskEventType = "status_update" | "success" | "failure" | "operator_response";

export interface OperatorResponse {
  operatorId: string;
  operatorAddress: Address;
  status: OperatorStatus;
  data?: unknown;
  error?: string;
  responseTimeMs: number;
}

export interface TaskUpdateData {
  status: TaskStatus;
  operatorResponses: OperatorResponse[];
  result?: unknown;
  error?: string;
  progress: number;
}

export interface TaskUpdateEvent {
  event: TaskEventType;
  taskId: TaskId;
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
  id: number | string;
  method: string;
  params: T;
}

export interface JsonRpcResponse<T = unknown> {
  jsonrpc: "2.0";
  id: number | string;
  result?: T;
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

// ---------------------------------------------------------------------------
// SDK Configuration
// ---------------------------------------------------------------------------

export interface NewtonSDKConfig {
  /** Gateway RPC endpoint URL (e.g. "http://localhost:8080/rpc") */
  gatewayUrl: string;
  /** Attester endpoint URL (e.g. "http://localhost:7047") */
  attesterUrl?: string;
  /** API key for authenticated endpoints */
  apiKey?: string;
  /** Default timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Default chain ID */
  chainId?: number;
}
