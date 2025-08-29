import { Address, Hex } from './generic';

export type TaskId = string;
export interface Intent {
  sender: Address;
  target: Address;
  value: string;
  data: Hex;
  abi: Hex;
  chain_id: number;
}

export interface SubmitEvaluationParams {
  policy_client: Address;
  intent: Intent;
  quorum_number: number[];
  quorum_threshold_percentage: number;
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

export interface TaskStatus {
  foo: string;
  bar: string;
}
