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

// This is the status of task CREATION, not completion.
// When status === Completed, you'll get a result
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
  getTaskRequestId: () => string;
  waitForTaskCreated: () => Promise<WaitForTaskIdResult>;
  waitForTaskResponded: () => Promise<WaitForTaskIdResult>;
}

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

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.error) {
    throw new Error(`Newton SDK: newton_waitForTaskId failed: ${data.error.message}`);
  }
  // this assumes no need for a polling mechanism for now.
  return data.result as WaitForTaskIdResult;
};
const waitForTaskResponded = async (
  publicClient: PublicClient,
  args: {
    taskId: string;
    client?: PublicClient; // optionally specify WS-enabled client
    timeoutMs?: number; // default e.g., 30_000
    abortSignal?: AbortSignal;
  },
): Promise<WaitForTaskIdResult> => {
  console.log(publicClient, args);
  throw new Error('waitForTaskResponded: Not Implemented');
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
): Promise<({ ok: true; taskId?: string } & PendingTaskBuilder) | { ok: false; error: NewtonError }> => {
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
    taskId: 'NotImplemented',
    getTaskRequestId: () => createTaskResult.task_request_id,
    waitForTaskCreated: () => waitForTaskCreated(publicClient, { taskRequestId: createTaskResult.task_request_id }),
    waitForTaskResponded: () => waitForTaskResponded(publicClient, { taskId: 'NotImplemented' }),
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
