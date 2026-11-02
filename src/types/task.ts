import type { Address, Hex } from 'viem'
import type { PolicySpec } from './policy'
import type { SecureEnvelope } from './privacy'

export type TaskId = Hex

export interface IntentFromParams {
  from: Address
  to: Address
  value: Hex | bigint
  data: Hex
  chainId: Hex | number | bigint
  functionSignature: Hex
}

export interface SubmitEvaluationRequestParams {
  policyClient: Address
  intent: IntentFromParams
  /**
   * EIP-712 signature of the intent under the policy client's `eip712Domain()`. Identity policies need it: operators
   * resolve identity for the recovered signer, which must equal `intent.from`, and skip identity data without it.
   */
  intentSignature?: Hex
  quorumNumber?: Hex
  quorumThresholdPercentage?: number
  /** One per policy, positionally aligned. Pure-Rego policies still need a slot — pass `'0x'`. */
  wasmArgs: Hex[]
  /**
   * Sent as `timeout`, but the gateway does not apply it: it ends any HTTP request that runs past its server request
   * timeout (30 seconds by default) with a 408.
   */
  timeout: number
  /**
   * @deprecated Not sent: the gateway has no such field. Operators resolve identity from every domain linked to the
   * intent signer, recovered from `intentSignature`.
   */
  identityDomain?: Hex
  /** @deprecated Not sent: the gateway has no dual-signature privacy path. Ephemeral data goes inline in `wasmArgs`. */
  encryptedDataRefs?: string[]
  /** @deprecated Not sent, see `encryptedDataRefs`. */
  userSignature?: string
  /** @deprecated Not sent, see `encryptedDataRefs`. */
  appSignature?: string
  /** @deprecated Not sent, see `encryptedDataRefs`. */
  userPublicKey?: string
  /** @deprecated Not sent, see `encryptedDataRefs`. */
  appPublicKey?: string
  /** @deprecated The gateway rejects any value: zkTLS proof verification is unavailable. */
  proofCid?: string
  /** Include ABI-encoded validateAttestationDirect calldata in the response */
  includeValidateCalldata?: boolean
}

export interface SubmitIntentResult {
  message: string
  subscription_topic: string
  task_id: Hex
  timestamp: number
}

export interface NormalizedIntent {
  from: Address
  to: Address
  value: bigint
  data: Hex
  chainId: bigint
  functionSignature: Hex
}

export interface HexlifiedIntent {
  from: Address
  to: Address
  value: Hex
  data: string
  chain_id: Hex
  function_signature: string
}

/** One oracle's contribution to a policy's evidence. The policy address is one level up, in `PolicyTaskData.policyAddress`. */
export interface PolicyDataEntry {
  wasmArgs: Hex
  data: Hex
  expireBlock: number
}

/** One entry per policy, in set order. Never collapse repeats or reorder — operators signed this. */
export interface PolicyTaskData {
  policyId: Hex
  policyAddress: Address
  policy: Hex
  policyData: PolicyDataEntry[]
}

export interface TaskResponse {
  taskId: Hex
  policyClient: Address
  policyId: Hex
  intent: NormalizedIntent
  intentSignature: Hex
  /** True only when every policy allows. */
  allowed: boolean
  policyTaskData: PolicyTaskData[]
}

interface ResponseCertificate {
  taskResponsedBlock: number
  responseExpireBlock: number
  hashOfNonSigners: Hex
}

export interface TaskResponseResult {
  taskResponse: TaskResponse
  responseCertificate: ResponseCertificate
  attestation: {
    taskId: Hex
    policyId: Hex
    policyClient: Address
    intent: NormalizedIntent
    intentSignature: Hex
    expiration: number
  }
}

export enum TaskStatus {
  AttestationSpent = 'AttestationSpent',
  SuccessfullyChallenged = 'SuccessfullyChallenged',
  Responded = 'Responded',
  Created = 'Created',
  AttestationExpired = 'AttestationExpired',
}

/** The gateway's `BlsAggregationServiceResponse`. BN254 points are their uncompressed bytes. */
export interface AggregationResponse {
  non_signer_quorum_bitmap_indices: number[]
  non_signer_stake_indices: number[][]
  non_signers_operators_ids: Hex[]
  non_signers_pub_keys_g1: number[][]
  quorum_apk_indices: number[]
  quorum_apks_g1: number[][]
  signers_agg_sig_g1: { g1_point: number[] }
  signers_apk_g2: number[]
  signers_count: number
  task_created_block: number
  task_id: Hex
  task_response_digest: Hex
  total_stake_indices: number[]
}

export interface Task {
  initializationTimestamp: Hex
  intent: {
    chainId: Hex
    data: Hex
    from: Address
    functionSignature: Hex
    to: Address
    value: Hex
  }
  intentSignature: Hex
  policyClient: Address
  policyId: Hex
  policyRevision: number
  /** Frozen at admission. Order and repeats are significant. */
  policies: PolicySpec[]
  wasmArgs: Hex[]
  quorumNumbers: Hex
  quorumThresholdPercentage: number
  taskCreatedBlock: number
  taskId: Hex
}

export interface SimulateTaskParams {
  policyClient: Address
  chainId: number
  intent: IntentFromParams
  /** One per policy, positionally aligned. `'0x'` for a pure-Rego policy. */
  wasmArgs: Hex[]
}

/** newt_simulateTask answers in the same shape as newt_simulatePolicy. */
export type SimulateTaskResult = SimulatePolicyResult

export interface SimulatePolicyParams {
  policyClient: Address
  chainId: number
  intent: IntentFromParams
  /** One per policy, positionally aligned. `'0x'` for a pure-Rego policy. */
  wasmArgs: Hex[]
  intentSignature?: Hex
}

/** One policy's outcome within a simulated set. */
export interface PolicySimulationResult {
  policy_index: number
  policy: Address
  result: unknown
  allowed: boolean
  expire_after: number
}

export interface SimulatePolicyResult {
  success: boolean
  allowed: boolean | null
  policy_id: string | null
  policies: PolicySimulationResult[] | null
  error: string | null
  parsed_intent: unknown | null
}

export type TaskFailureType =
  | 'channel_error'
  | 'timeout'
  | 'quorum_not_reached'
  | 'onchain_submission_failed'
  | 'policy_evaluation_failed'
  | 'signature_verification_failed'
  | 'internal_error'

export interface RegisterWebhookParams {
  /** Webhook URL to receive notifications (must be HTTPS, or http://localhost for testing) */
  url: string
  /** Optional HMAC secret for payload signing (recommended) */
  secret?: string
  /** Request timeout in seconds (default: 10) */
  timeoutSeconds?: number
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number
  /** Failure types to notify about (default: all) */
  failureTypes?: TaskFailureType[]
}

export interface RegisterWebhookResult {
  success: boolean
  message: string
}

export interface UnregisterWebhookResult {
  success: boolean
  message: string
}

export interface SimulatePolicyDataParams {
  policyAddress: Address
  /** The `envelope` that `createSecureEnvelope` returns, or its JSON string. */
  secrets?: SecureEnvelope | string
  wasmArgs?: Hex
  chainId: number
}

export interface SimulatePolicyDataResult {
  success: boolean
  /** The PolicyData WASM's JSON output on success, `null` on failure. */
  policy_data: unknown
  error: string | null
}

export interface SimulatePolicyDataWithClientParams {
  policyAddress: Address
  policyClient: Address
  chainId: number
  wasmArgs?: Hex
}

export interface SimulatePolicyDataWithClientResult {
  success: boolean
  /** The PolicyData WASM's JSON output on success, `null` on failure. */
  policy_data: unknown
  error: string | null
}

export interface OperatorError {
  operator_address: Address
  operator_id: Hex
  error_code: number
  message: string
  timestamp: string
  retryable: boolean
}

/** The `newt_createTask` result. A failed task has `status: 'failed'`, `error` set and nulls elsewhere. */
export interface GatewayCreateTaskResult {
  bls_aggregation_result: AggregationResponse | null
  error: string | null
  /** Always `null`: read `AttestationValidator.attestationExpirations(taskId)` for the onchain expiry. */
  expiration: null
  reference_block: number | null
  status: 'success' | 'failed'
  task: Task
  task_id: Hex
  task_response: {
    allowed: boolean
    initialization_timestamp: Hex
    intent: {
      chainId: Hex
      data: Hex
      from: Address
      functionSignature: Hex
      to: Address
      value: Hex
    }
    intent_signature: Hex
    policy_client: Address
    policy_id: Hex
    policy_task_data: Array<{
      policy: Hex
      policyAddress: Address
      policyData: Array<{
        data: Hex
        expireBlock: number
        wasmArgs: Hex
      }>
      policyId: Hex
    }>
    task_id: Hex
  } | null
  signature_data: Hex | null
  /** ABI-encoded calldata for validateAttestationDirect; `null` unless include_validate_calldata was true */
  validate_calldata: string | null
  /** Absent in practice: the gateway leaves it unset on every task response. */
  operator_errors?: OperatorError[]
  timestamp: number
}
