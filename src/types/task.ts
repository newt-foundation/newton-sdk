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

export interface ResponseIntent {
  from: Address;
  to: Address;
  value: Hex;
  data: Hex;
  chainId: Hex;
  functionSignature: Hex;
}

export interface TaskResponse {
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
  evaluationResult: Hex;
  attestation: Hex;
}

export type TaskStatus = 'TaskUsed' | 'TaskChallenged' | 'TaskResponded' | 'TaskCreated';
