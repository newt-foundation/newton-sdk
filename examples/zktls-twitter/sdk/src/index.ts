/**
 * @newton-protocol/zktls-twitter-example
 *
 * Example-scoped TypeScript helpers for the Newton Protocol Twitter/X zkTLS
 * flow. Production integrations should use the main
 * `@magicnewton/newton-protocol-sdk` package for gateway RPC, task submission,
 * identity, privacy, and secrets flows; this package keeps the tutorial
 * self-contained until the zkTLS-specific pieces are promoted into a thin
 * extension on top of the main SDK.
 */

export { GatewayClient } from "./gateway.js";
export { AttesterClient } from "./attester.js";
export type { AttesterSession, SessionOptions } from "./attester.js";
export { ProofClient } from "./proof.js";
export { TaskManager } from "./task.js";
export type { TaskOptions } from "./task.js";
export { encodeWasmArgs, decodeWasmArgs } from "./utils.js";
export { NewtonSDKError, JsonRpcError_, SessionError, TimeoutError } from "./errors.js";

// Re-export all types
export type {
  Address,
  HexBytes,
  U256,
  TaskId,
  TaskIntent,
  TaskStatus,
  OperatorStatus,
  CreateTaskRequest,
  CreateTaskResponse,
  SendTaskRequest,
  SendTaskResponse,
  SimulateTaskRequest,
  SimulateTaskResponse,
  PolicyDataInput,
  SimulatePolicyRequest,
  SimulatePolicyResponse,
  PolicyEvaluationResult,
  SimulatePolicyDataRequest,
  SimulatePolicyDataWithClientRequest,
  SimulatePolicyDataResponse,
  StoreSecretsRequest,
  StoreSecretsResponse,
  UploadIdentityRequest,
  UploadIdentityResponse,
  GetIdentityRequest,
  GetIdentityResponse,
  UploadConfidentialDataRequest,
  UploadConfidentialDataResponse,
  GetConfidentialDataRequest,
  GetConfidentialDataResponse,
  GetPrivacyPublicKeyResponse,
  GetSecretsPublicKeyResponse,
  RegisterWebhookRequest,
  RegisterWebhookResponse,
  UnregisterWebhookRequest,
  UnregisterWebhookResponse,
  TaskEventType,
  OperatorResponse,
  TaskUpdateData,
  TaskUpdateEvent,
  SessionRegisterMessage,
  SessionRegisteredMessage,
  RevealConfigMessage,
  HandlerResult,
  SessionCompletedMessage,
  SessionErrorMessage,
  SessionServerMessage,
  SessionClientMessage,
  StoreProofRequest,
  StoreProofResponse,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcError,
  NewtonSDKConfig,
} from "./types.js";

// ---------------------------------------------------------------------------
// Convenience factory
// ---------------------------------------------------------------------------

import type { NewtonSDKConfig } from "./types.js";
import { GatewayClient } from "./gateway.js";
import { AttesterClient } from "./attester.js";
import { ProofClient } from "./proof.js";
import { TaskManager } from "./task.js";

export interface NewtonSDK {
  gateway: GatewayClient;
  attester: AttesterClient;
  proof: ProofClient;
  task: TaskManager;
}

/**
 * Create a fully-configured Twitter/X zkTLS example SDK instance.
 *
 * This factory intentionally keeps the example runnable without additional
 * setup. It should not be treated as a production replacement for
 * `@magicnewton/newton-protocol-sdk`; production apps should compose the main
 * SDK with the zkTLS-only pieces exported here (`AttesterClient`,
 * `ProofClient`, and wasm-argument helpers).
 *
 * @example
 * ```ts
 * import { createNewtonSDK } from "@newton-protocol/zktls-twitter-example";
 *
 * const sdk = createNewtonSDK({
 *   gatewayUrl: "http://localhost:8080",
 *   attesterUrl: "http://localhost:7047",
 *   apiKey: "my-api-key",
 * });
 *
 * const result = await sdk.task.createTask({
 *   policyClient: "0x1111...",
 *   intent: { from: "0x...", to: "0x...", value: "0x0", data: "0x", chainId: "0xaa36a7", functionSignature: "0x" },
 *   proofCid: "bafybeig...",
 *   wasmArgs: { min_followers: 1000, twitter_username: "newton_protocol" },
 *   useTwoPhase: true,
 * });
 * ```
 */
export function createNewtonSDK(config: NewtonSDKConfig): NewtonSDK {
  const gateway = new GatewayClient(config);
  const attester = new AttesterClient(config);
  const proof = new ProofClient(config);
  const task = new TaskManager(config, gateway);

  return { gateway, attester, proof, task };
}
