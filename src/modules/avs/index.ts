import { Address, Hex } from '@core/types';
import { NewtonError } from '@core/types/core/sdk-exceptions';
import { Intent, SubmitEvaluationParams, TaskCreated, TaskId, TaskResponded, TaskStatus } from '@core/utils/task';
import { PublicClient } from 'viem';

// const TESTNET_AVS_API = 'https://testnet.avs.api';
// const MAINNET_AVS_API = 'https://avs.api';

/* interface ChainLike {
  id: number;
  testnet?: boolean;
}*/

const computeTaskId = (publicClient: PublicClient, args: { client: Address; intent: Intent }): TaskId => {
  console.log('computeTaskId args: ', args, publicClient);
  throw new Error('Newton SDK: computeTaskId Not implemented');
};
const submitEvaluationRequest = (
  publicClient: PublicClient,
  args: SubmitEvaluationParams,
): Promise<{ ok: true; taskId: TaskId; txHash?: Hex } | { ok: false; error: NewtonError }> => {
  console.log('submitEvaluationRequest args: ', args, publicClient);
  throw new Error('Newton SDK: submitEvaluationRequest Not implemented');
};
const waitForTaskCreated = (
  publicClient: PublicClient,
  args: {
    taskId: TaskId;
    client?: PublicClient; // optionally specify WS-enabled client
    timeoutMs?: number; // default e.g., 30_000
    abortSignal?: AbortSignal;
  },
): Promise<TaskCreated> => {
  console.log('waitForTaskCreated args: ', args, publicClient);
  throw new Error('Newton SDK: waitForTaskCreated Not implemented');
};
const waitForTaskResponded = (
  publicClient: PublicClient,
  args: {
    taskId: TaskId;
    client?: PublicClient;
    timeoutMs?: number; // may be short (< 1s) in fast paths
    abortSignal?: AbortSignal;
  },
): Promise<TaskResponded> => {
  console.log('waitForTaskResponded args: ', args, publicClient);
  throw new Error('Newton SDK: waitForTaskResponded Not implemented');
};
const onTaskEvents = (
  publicClient: PublicClient,
  args: {
    taskId: TaskId;
    onCreated?: (e: TaskCreated) => void;
    onResponded?: (e: TaskResponded) => void;
    onError?: (err: unknown) => void;
    client?: PublicClient;
  },
): void => {
  console.log('onTaskEvents args: ', args, publicClient);
  throw new Error('Newton SDK: onTaskEvents Not implemented');
};
const getTaskResponseHash = (publicClient: PublicClient, args: { taskId: TaskId }): Promise<Hex | null> => {
  console.log('getTaskResponseHash args: ', args, publicClient);
  throw new Error('Newton SDK: getTaskResponseHash Not implemented');
};
const getTaskStatus = (publicClient: PublicClient, args: { taskId: TaskId }): Promise<TaskStatus> => {
  console.log('getTaskStatus args: ', args, publicClient);
  throw new Error('Newton SDK: getTaskStatus Not implemented');
};
export {
  computeTaskId,
  submitEvaluationRequest,
  waitForTaskCreated,
  waitForTaskResponded,
  onTaskEvents,
  getTaskResponseHash,
  getTaskStatus,
};
