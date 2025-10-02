import { Address, Hex } from 'viem';

export type TaskId = Hex;

export interface IntentFromParams {
  from: Address;
  to: Address;
  value: Hex | bigint;
  data: string;
  chainId: Hex | number | bigint;
  functionSignature: string;
}

export interface SubmitEvaluationRequestParams {
  policyClient: Address;
  intent: IntentFromParams;
  quorumNumber?: string;
  quorumThresholdPercentage?: number;
  wasmArgs?: string;
  timeout: number; // in seconds
}

export interface NormalizedIntent {
  from: Address;
  to: Address;
  value: bigint;
  data: Hex | string;
  chainId: bigint;
  functionSignature: Hex | string;
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
