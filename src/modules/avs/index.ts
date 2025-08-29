import { AVS_METHODS, MAINNET_AVS_API, TESTNET_AVS_API } from '@core/const';
import { Hex } from '@core/types';
import { NewtonError } from '@core/types/core/sdk-exceptions';
import { SubmitEvaluationParams, TaskCreated, TaskId, TaskResponded, TaskStatus } from '@core/types/task';
import { createJsonRpcRequestPayload } from '@core/utils/json-rpc';
import { PublicClient } from 'viem';

interface PendingTaskBuilder {
  getTaskId: () => Promise<TaskId>;
  waitForTaskCreated: () => Promise<TaskCreated>;
  waitForTaskResponded: () => Promise<TaskResponded>;
}

const submitEvaluationRequest = async (
  publicClient: PublicClient,
  args: SubmitEvaluationParams,
): Promise<
  ({ ok: true; taskRequestId: string; txHash?: Hex } & PendingTaskBuilder) | { ok: false; error: NewtonError }
> => {
  const endpoint = publicClient?.chain?.testnet ? TESTNET_AVS_API : MAINNET_AVS_API;
  const body = createJsonRpcRequestPayload(AVS_METHODS.createTask, args);
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.error) {
    return { ok: false, error: data.error };
  }
  return {
    ok: true,
    taskRequestId: data.result.task_request_id,
    txHash: data.result.txHash,
    getTaskId: () => Promise.resolve(data.result.task_id),
    waitForTaskCreated: () => Promise.resolve(data.result.task_id),
    waitForTaskResponded: () => Promise.resolve(data.result.task_id),
  };
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
  submitEvaluationRequest,
  waitForTaskCreated,
  waitForTaskResponded,
  onTaskEvents,
  getTaskResponseHash,
  getTaskStatus,
};
