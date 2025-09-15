import { Address, Hex } from './generic';

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
  timeout: number;
}

export const createTaskParamsTypes = {
  CreateTaskParams: [
    { name: 'policy_client', type: 'address' },
    { name: 'intent', type: 'Intent' },
    { name: 'timeout', type: 'uint256' },
  ],
  Intent: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'data', type: 'bytes' },
    { name: 'chain_id', type: 'uint256' },
    { name: 'function_signature', type: 'bytes' },
  ],
} as const;

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
