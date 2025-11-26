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
