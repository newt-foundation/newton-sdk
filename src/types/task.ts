import { Address, Hex } from './generic';

export type TaskId = Hex;
export interface Intent {
  sender: Address;
  target: Address;
  value: string;
  data: Hex;
  abi: Hex;
  chain_id: number;
}

export interface SubmitEvaluationParams {
  policyClient: Address;
  intent: Intent;
  quorumNumber: number[];
  quorumThresholdPercentage: number;
  timeout: number;
}

export interface TaskCreated {
  foo: string;
  bar: string;
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
