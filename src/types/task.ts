import type { Address, Hex } from 'viem'

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
  intentSignature?: Hex
  quorumNumber?: Hex
  quorumThresholdPercentage?: number
  wasmArgs?: Hex
  timeout: number // in seconds
  identityDomain?: Hex
  /** Encrypted data reference UUIDs for privacy-preserving evaluation */
  encryptedDataRefs?: string[]
  /** User Ed25519 signature for privacy authorization (hex-encoded) */
  userSignature?: string
  /** Application Ed25519 signature for privacy authorization (hex-encoded) */
  appSignature?: string
  /** User Ed25519 public key for privacy signature verification (hex-encoded, 32 bytes) */
  userPublicKey?: string
  /** Application Ed25519 public key for privacy signature verification (hex-encoded, 32 bytes) */
  appPublicKey?: string
  /** IPFS CID of a TLSNotary presentation proof for zkTLS-backed policy evaluation */
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

export interface TaskResponse {
  taskId: Hex
  policyClient: Address
  policyId: Hex
  policyAddress: Address
  intent: {
    from: Address
    to: Address
    value: bigint
    data: string
    chainId: bigint
    functionSignature: string
  }
  intentSignature: Hex
  evaluationResult: boolean
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

export interface AggregationResponse {
  non_signer_quorum_bitmap_indices: number[]
  non_signer_stake_indices: number[][]
  non_signers_pub_keys_g1: number[][]
  quorum_apk_indices: number[]
  quorum_apks_g1: number[][]
  signers_agg_sig_g1: { g1_point: number[] }
  signers_apk_g2: number[]
  total_stake_indices: number[]
  task_created_block: number
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
  quorumNumbers: Hex
  quorumThresholdPercentage: number
  taskCreatedBlock: number
  taskId: Hex
  wasmArgs: Hex
}

/** PolicyData item for newt_simulateTask policy_task_data.policyData */
export interface SimulateTaskPolicyData {
  wasmArgs: Hex
  data: Hex
  policyDataAddress: Address
  expireBlock: number
}

/** PolicyTaskData for newt_simulateTask */
export interface SimulateTaskPolicyTaskData {
  policyId: Hex
  policyAddress: Address
  policy: Hex
  policyData: SimulateTaskPolicyData[]
}

export interface SimulateTaskParams {
  intent: IntentFromParams
  policyTaskData: SimulateTaskPolicyTaskData
}

export interface SimulateTaskResult {
  success: boolean
  result: { allow?: boolean; reason?: string } | null
  error: string | null
  details: unknown
}

/** PolicyDataInput for newt_simulatePolicy policy_data array */
export interface PolicyDataInput {
  policyDataAddress: Address
  wasmArgs?: Hex
}

export interface SimulatePolicyParams {
  policyClient: Address
  policy: string
  intent: IntentFromParams
  entrypoint?: string
  policyData: PolicyDataInput[]
  policyParams?: Record<string, unknown>
  intentSignature?: Hex
}

export interface SimulatePolicyEvaluationResult {
  policy: string
  parsed_intent: unknown
  policy_params_and_data: unknown
  entrypoint: string
  result: unknown
  expire_after: number
}

export interface SimulatePolicyResult {
  success: boolean
  evaluation_result: SimulatePolicyEvaluationResult | null
  error: string | null
  error_details: {
    missing_secrets?: Array<{
      policy_data_address: Address
      has_secrets_schema: boolean
    }>
    suggested_actions?: string[]
  } | null
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
  policyDataAddress: Address
  secrets?: string
  wasmArgs?: Hex
  chainId: number
}

export interface SimulatePolicyDataResult {
  success: boolean
  policy_data: {
    specifier: string
    data: unknown
    timestamp: number
  } | null
  error: string | null
}

export interface SimulatePolicyDataWithClientParams {
  policyDataAddress: Address
  policyClient: Address
  wasmArgs?: Hex
}

export interface SimulatePolicyDataWithClientResult {
  success: boolean
  policy_data: {
    specifier: string
    data: unknown
    timestamp: number
  } | null
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

export interface GatewayCreateTaskResult {
  aggregation_response: AggregationResponse
  error: string | null
  expiration: number
  reference_block: number
  status: 'success' | 'failed'
  task: Task
  task_id: Hex
  task_response: {
    evaluation_result: number[]
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
    policy_address: Address
    policy_client: Address
    policy_config: { expireAfter: number; policyParams: Hex }
    policy_id: Hex
    policy_task_data: {
      policy: Hex
      policyAddress: Address
      policyData: Array<{
        data: Hex
        expireBlock: number
        policyDataAddress: Address
        wasmArgs: Hex
      }>
      policyId: Hex
    }
    task_id: Hex
  }
  signature_data: Hex
  /** ABI-encoded calldata for validateAttestationDirect (present when include_validate_calldata was true) */
  validate_calldata?: string
  /** Per-operator error details when quorum fails */
  operator_errors?: OperatorError[]
  timestamp: number
}
