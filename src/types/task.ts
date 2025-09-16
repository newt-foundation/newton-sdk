import { Address, Hex } from 'viem';

export type TaskId = Hex;

export interface NewtonIntent {
  from: Address;
  to: Address;
  value: string;
  data: Hex;
  chainId: number;
  functionSignature: Hex;
}

export interface CreateTaskParams {
  policyClient: Address;
  intent: NewtonIntent;
  quorumNumber?: Hex | Uint8Array;
  quorumThresholdPercentage?: number;
  timeout: number; // in seconds
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
}

export type TaskStatus = 'TaskUsed' | 'TaskChallenged' | 'TaskResponded' | 'TaskCreated';
