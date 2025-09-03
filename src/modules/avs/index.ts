import { AVS_METHODS } from '@core/const';
import { Hex } from '@core/types';
import { NewtonError } from '@core/types/core/sdk-exceptions';
import { SubmitEvaluationParams, TaskCreated, TaskId, TaskResponded, TaskStatus } from '@core/types/task';
import { AvsHttpService } from '@core/utils/https';
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
  readonly taskId?: string; // getter-backed
  getTaskRequestId: () => string;
  waitForTaskCreated: () => Promise<WaitForTaskIdResult>;
  waitForTaskResponded: () => Promise<WaitForTaskIdResult>;
}

interface TaskIdRef {
  taskId?: string;
}

const waitForTaskCreated = async (
  publicClient: PublicClient,
  args: {
    taskRequestId: string;
    client?: PublicClient; // optionally specify WS-enabled client
    timeoutMs?: number; // default e.g., 30_000
    abortSignal?: AbortSignal;
  },
  taskIdRef: TaskIdRef,
): Promise<WaitForTaskIdResult> => {
  const avsHttpService = new AvsHttpService(!!publicClient?.chain?.testnet);
  const res = await avsHttpService.Post(AVS_METHODS.waitForTaskId, {
    task_request_id: args.taskRequestId,
    timeout_ms: args.timeoutMs ?? 30_000,
  });

  if (res.error) {
    throw new Error(`Newton SDK: newton_waitForTaskId failed: ${res.error.message}`);
  }
  taskIdRef.taskId = res.result.task_id;
  // this assumes no need for a polling mechanism for now.
  return res.result as WaitForTaskIdResult;
};
const waitForTaskResponded = async (
  publicClient: PublicClient,
  args: {
    taskId?: string;
    client?: PublicClient; // optionally specify WS-enabled client
    timeoutMs?: number; // default e.g., 30_000
    abortSignal?: AbortSignal;
  },
): Promise<WaitForTaskIdResult> => {
  if (!args.taskId) {
    throw new Error('waitForTaskResponded: taskId is required');
  }
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

async function submitEvaluationRequest(
  publicClient: PublicClient,
  args: SubmitEvaluationParams,
): Promise<({ ok: true } & PendingTaskBuilder) | { ok: false; error: NewtonError }> {
  const taskIdRef: TaskIdRef = {};

  const avsHttpService = new AvsHttpService(!!publicClient?.chain?.testnet);

  const res = await avsHttpService.Post(AVS_METHODS.createTask, {
    policy_client: args.policyClient,
    intent: args.intent,
    quorum_number: args.quorumNumber,
    quorum_threshold_percentage: args.quorumThresholdPercentage,
    timeout: args.timeout,
  });
  if (res.error) return { ok: false, error: res.error };

  const createTaskResult = res.result as CreateTaskResult;

  let createdSingleton: Promise<WaitForTaskIdResult> | null = null;
  const ensureCreated = () => {
    if (!createdSingleton) {
      createdSingleton = (async () => {
        const created = await waitForTaskCreated(
          publicClient,
          { taskRequestId: createTaskResult.task_request_id },
          taskIdRef,
        );
        if (!taskIdRef.taskId) throw new Error('Task ID not set after creation.');
        return created;
      })();
    }
    return createdSingleton;
  };

  const builder: { ok: true } & PendingTaskBuilder = {
    ok: true as const,

    // live view of the ref
    get taskId() {
      return taskIdRef.taskId;
    },

    getTaskRequestId: () => createTaskResult.task_request_id,

    // return the taskId so callers can capture it if they want
    waitForTaskCreated: async () => ensureCreated(),

    // safe: will await creation if caller forgot
    waitForTaskResponded: async () => {
      const taskId = taskIdRef.taskId ?? (await ensureCreated())?.result?.task_id;
      return waitForTaskResponded(publicClient, { taskId });
    },
  };

  return builder;
}
export {
  submitEvaluationRequest,
  waitForTaskCreated,
  waitForTaskResponded,
  onTaskEvents,
  getTaskResponseHash,
  getTaskStatus,
};
