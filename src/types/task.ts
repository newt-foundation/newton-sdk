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

export interface TaskResponded {
  foo: string;
  bar: string;
}

export type TaskStatus = 'TaskUsed' | 'TaskChallenged' | 'TaskResponded' | 'TaskCreated';
