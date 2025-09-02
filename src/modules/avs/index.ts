import { AVS_METHODS, MAINNET_AVS_API, TESTNET_AVS_API } from '@core/const';
import { Hex } from '@core/types';
import { NewtonError } from '@core/types/core/sdk-exceptions';
import { SubmitEvaluationParams, TaskCreated, TaskId, TaskResponded, TaskStatus } from '@core/types/task';
import { createJsonRpcRequestPayload } from '@core/utils/json-rpc';
import { PublicClient } from 'viem';

interface CreateTaskResult {
  receipt: any;
  task_request_id: Hex;
  timestamp: number;
}

// this is ostensibly the task result query
interface WaitForTaskIdResult {
  task_request_id: string;
  task_request: any;
  status: 'Queued' | 'Processing' | 'Completed' | 'Failed';
  result?: {
    task_id?: Hex;
    tx_hash?: Hex;
  };
  error?: unknown;
  processing_time_ms?: number;
}

interface PendingTaskBuilder {
  getTaskId: () => Promise<WaitForTaskIdResult>;
  waitForTaskCreated: () => Promise<WaitForTaskIdResult>;
  waitForTaskResponded: () => Promise<TaskResponded>;
}

const getTaskId = async (
  publicClient: PublicClient,
  args: {
    taskRequestId: string;
    client?: PublicClient; // optionally specify WS-enabled client
    timeoutMs?: number; // default e.g., 30_000
    abortSignal?: AbortSignal;
  },
): Promise<WaitForTaskIdResult> => {
  const endpoint = publicClient.chain?.testnet ? TESTNET_AVS_API : MAINNET_AVS_API;

  const body = createJsonRpcRequestPayload(AVS_METHODS.waitForTaskId, {
    task_request_id: args.taskRequestId,
    timeout_secs: args.timeoutMs ?? 60,
  });

  // Question: This endpoint blocks until the task is completed or the timeout is reached -> do you mean until the task is created?
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.error) {
    throw new Error(`Newton SDK: getTaskId failed: ${data.error.message}`);
  }
  // this assumes no need for a polling mechanism for now.
  return data.result as WaitForTaskIdResult;
};

const waitForTaskCreated = async (
  publicClient: PublicClient,
  args: {
    taskRequestId: string;
    client?: PublicClient; // optionally specify WS-enabled client
    timeoutMs?: number; // default e.g., 30_000
    abortSignal?: AbortSignal;
  },
): Promise<WaitForTaskIdResult> => {
  const endpoint = publicClient.chain?.testnet ? TESTNET_AVS_API : MAINNET_AVS_API;

  const body = createJsonRpcRequestPayload(AVS_METHODS.waitForTaskId, {
    task_request_id: args.taskRequestId,
    timeout_secs: args.timeoutMs ?? 60,
  });

  // Question: This endpoint blocks until the task is completed or the timeout is reached -> do you mean until the task is created?
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.error) {
    throw new Error(`Newton SDK: getTaskId failed: ${data.error.message}`);
  }
  // this assumes no need for a polling mechanism for now.
  return data.result as WaitForTaskIdResult;
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

const submitEvaluationRequest = async (
  publicClient: PublicClient,
  args: SubmitEvaluationParams,
): Promise<({ ok: true; taskRequestId: string } & PendingTaskBuilder) | { ok: false; error: NewtonError }> => {
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
  const createTaskResult = data.result as CreateTaskResult;
  return {
    ok: true,
    taskRequestId: createTaskResult.task_request_id,
    getTaskId: () => getTaskId(publicClient, { taskRequestId: createTaskResult.task_request_id }),
    waitForTaskCreated: () => waitForTaskCreated(publicClient, { taskRequestId: createTaskResult.task_request_id }),
    waitForTaskResponded: () => Promise.resolve({} as any),
  };
};
export {
  submitEvaluationRequest,
  waitForTaskCreated,
  waitForTaskResponded,
  onTaskEvents,
  getTaskResponseHash,
  getTaskStatus,
};
