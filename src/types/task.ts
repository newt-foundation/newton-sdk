import { Address, Hex } from 'viem';

export type TaskId = Hex;

export interface IntentFromParams {
  from: Address;
  to: Address;
  value: Hex | bigint;
  data: Hex;
  chainId: Hex | number | bigint;
  functionSignature: Hex;
}

export interface SubmitEvaluationRequestParams {
  policyClient: Address;
  intent: IntentFromParams;
  intentSignature?: Hex;
  quorumNumber?: Hex;
  quorumThresholdPercentage?: number;
  wasmArgs?: Hex;
  timeout: number; // in seconds
}

export interface NormalizedIntent {
  from: Address;
  to: Address;
  value: bigint;
  data: Hex;
  chainId: bigint;
  functionSignature: Hex;
}

export interface HexlifiedIntent {
  from: Address;
  to: Address;
  value: Hex;
  data: string;
  chain_id: Hex;
  function_signature: string;
}

interface TaskResponse {
  taskId: Hex;
  policyClient: Address;
  policyId: Hex;
  policyAddress: Address;
  intent: {
    from: Address;
    to: Address;
    value: bigint;
    data: string;
    chainId: bigint;
    functionSignature: string;
  };
  intentSignature: Hex;
  evaluationResult: boolean;
}

interface ResponseCertificate {
  taskResponsedBlock: number;
  responseExpireBlock: number;
  hashOfNonSigners: Hex;
}

export interface TaskResponseResult {
  taskResponse: TaskResponse;
  responseCertificate: ResponseCertificate;
  attestation: {
    taskId: Hex;
    policyId: Hex;
    policyClient: Address;
    intent: NormalizedIntent;
    intentSignature: Hex;
    expiration: number;
  };
}

export enum TaskStatus {
  AttestationSpent = 'AttestationSpent',
  SuccessfullyChallenged = 'SuccessfullyChallenged',
  Responded = 'Responded',
  Created = 'Created',
  AttestationExpired = 'AttestationExpired',
}

export interface AggregationResponse {
  non_signer_quorum_bitmap_indices: number[];
  non_signer_stake_indices: number[][];
  non_signers_pub_keys_g1: number[][];
  quorum_apk_indices: number[];
  quorum_apks_g1: number[][];
  signers_agg_sig_g1: { g1_point: number[] };
  signers_apk_g2: number[];
}

export interface Attestation {
  taskId: Hex;
  policyId: Hex;
  policyClient: Address;
  intentSignature: Hex;
  expiration: number;
  intent: {
    chainId: Hex;
    data: Hex;
    from: Address;
    functionSignature: Hex;
    to: Address;
    value: Hex;
  };
}

export interface GatewayCreateTaskResult {
  aggregation_response: AggregationResponse;
  error: null;
  expiration: number;
  reference_block: number;
  status: 'success' | 'failed';
  task: {
    intent: {
      chainId: Hex;
      data: Hex;
      from: Address;
      functionSignature: Hex;
      to: Address;
      value: Hex;
    };
    intentSignature: Hex;
    policyClient: Address;
    quorumNumbers: Hex;
    quorumThresholdPercentage: number;
    taskCreatedBlock: number;
    taskId: Hex;
    wasmArgs: Hex;
  };
  task_id: Hex;
  task_response: {
    evaluation_result: number[];
    intent: {
      chainId: Hex;
      data: Hex;
      from: Address;
      functionSignature: Hex;
      to: Address;
      value: Hex;
    };
    intent_signature: Hex;
    policy_address: Address;
    policy_client: Address;
    policy_config: { expireAfter: number; policyParams: Hex };
    policy_id: Hex;
    policy_task_data: {
      policy: Hex;
      policyAddress: Address;
      policyData: Array<{
        attestation: Hex;
        data: Hex;
        expireBlock: number;
        policyDataAddress: Address;
        wasmArgs: Hex;
      }>;
      policyId: Hex;
    };
    task_id: Hex;
  };
  timestamp: number;
}
