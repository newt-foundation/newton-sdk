import { Address, Hex } from 'viem';

export type TaskId = Hex;

export interface Intent {
  from: Address;
  to: Address;
  value: Hex | bigint;
  data: Hex;
  chainId: Hex | number | bigint;
  functionSignature: Hex;
}

export interface SubmitEvaluationRequestParams {
  policyClient: Address;
  intent: Intent;
  quorumNumber?: Hex | Uint8Array;
  quorumThresholdPercentage?: number;
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
  data: Hex;
  chain_id: Hex;
  function_signature: Hex;
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
    data: Hex;
    chainId: bigint;
    functionSignature: Hex;
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
  attestation: Hex;
}

export enum TaskStatus {
  TaskUsed = 'TaskUsed',
  TaskChallenged = 'TaskChallenged',
  TaskResponded = 'TaskResponded',
  TaskCreated = 'TaskCreated',
  TaskExpired = 'TaskExpired',
}
