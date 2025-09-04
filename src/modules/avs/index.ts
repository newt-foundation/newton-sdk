import { newtonAbi, TaskRespondedLog } from '@core/abi';
import { AVS_CONTRACT_ADDRESS, AVS_METHODS, TEST_AVS_CONTRACT_ADDRESS } from '@core/const';
import { Hex } from '@core/types';
import { NewtonError } from '@core/types/core/sdk-exceptions';
import { SubmitEvaluationParams, TaskCreated, TaskId, TaskResponded } from '@core/types/task';
import { AvsHttpService } from '@core/utils/https';
import { padHex, PublicClient } from 'viem';

interface CreateTaskResult {
  receipt: any;
  task_request_id: Hex;
  timestamp: number;
}

// This is the status of task CREATION, not completion.
// When status === Completed, you'll get a result
export interface WaitForTaskIdResult {
  task_request_id: string;
  task_request: any;
  status: 'Completed' | 'Failed';
  result: {
    task_id: Hex;
    tx_hash: Hex;
  };
  error?: unknown;
  processing_time_ms?: number;
}

interface PendingTaskBuilder {
  readonly taskRequestId: string;
  readonly taskId?: TaskId;
  waitForTaskCreated: () => Promise<WaitForTaskIdResult>;
  waitForTaskResponded: () => Promise<TaskRespondedLog | undefined>;
}

interface TaskIdRef {
  taskId?: TaskId;
  taskRequestedAtBlock?: bigint;
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
    taskId?: Hex;
    client?: PublicClient; // optionally specify WS-enabled client
    timeoutMs?: number; // default e.g., 30_000
    abortSignal?: AbortSignal;
  },
  taskRequestedAtBlock?: bigint,
): Promise<TaskRespondedLog | undefined> => {
  if (!args.taskId) {
    throw new Error('Newton SDK: waitForTaskResponded requires taskId');
  }
  // Ensure 32-byte hex (0x + 64 nibbles) for reliable equality checks.
  const targetTaskId = padHex(args.taskId, { size: 32 });

  // 1) Check historical logs first (best-effort from the recent safe block).
  const defaultFromBlock: bigint | undefined = undefined;
  const fromBlockParam = taskRequestedAtBlock ?? defaultFromBlock;

  if (fromBlockParam !== undefined) {
    const past = await publicClient.getContractEvents({
      address: publicClient.chain?.testnet ? TEST_AVS_CONTRACT_ADDRESS : AVS_CONTRACT_ADDRESS,
      abi: newtonAbi,
      eventName: 'TaskResponded',
      fromBlock: fromBlockParam,
      toBlock: 'latest',
    });

    const match = (past as TaskRespondedLog[]).find(
      log => padHex(log.args.taskResponse.taskId, { size: 32 }) === targetTaskId,
    );
    if (match) return match;
  }

  // 2) If not found, subscribe and resolve on first match.
  return new Promise<TaskRespondedLog | undefined>((resolve, reject) => {
    let unsub: (() => void) | undefined = undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const cleanup = (err?: unknown) => {
      unsub?.();
      if (timeoutId) clearTimeout(timeoutId);
      if (err) reject(err);
    };

    if (args.timeoutMs && args.timeoutMs > 0) {
      timeoutId = setTimeout(() => cleanup(new Error('waitForTaskResponded: timeout')), args.timeoutMs);
    }

    if (args.abortSignal) {
      if (args.abortSignal.aborted) {
        cleanup(new Error('waitForTaskResponded: aborted'));
        return;
      }
      args.abortSignal.addEventListener('abort', () => cleanup(new Error('waitForTaskResponded: aborted')), {
        once: true,
      });
    }

    unsub = publicClient.watchContractEvent({
      address: publicClient.chain?.testnet ? TEST_AVS_CONTRACT_ADDRESS : AVS_CONTRACT_ADDRESS,
      abi: newtonAbi,
      eventName: 'TaskResponded',
      onLogs: logs => {
        for (const log of logs as TaskRespondedLog[]) {
          const id = padHex(log.args.taskResponse.taskId, { size: 32 });
          if (id === targetTaskId) {
            const res = log;
            cleanup(); // unsub + clear timers
            resolve(res);
            return;
          }
        }
      },
      onError: err => {
        cleanup(err);
      },
    });
  });
};

const getTaskResponseHash = (publicClient: PublicClient, args: { taskId: TaskId }): Promise<Hex | null> => {
  return publicClient.readContract({
    address: publicClient.chain?.testnet ? TEST_AVS_CONTRACT_ADDRESS : AVS_CONTRACT_ADDRESS,
    abi: newtonAbi,
    functionName: 'allTaskHashes',
    args: [args.taskId],
  }) as Promise<Hex | null>;
};

const getTaskStatus = (publicClient: PublicClient, args: { taskId: TaskId }): Promise<Hex> => {
  return publicClient.readContract({
    address: publicClient.chain?.testnet ? TEST_AVS_CONTRACT_ADDRESS : AVS_CONTRACT_ADDRESS,
    abi: newtonAbi,
    functionName: 'taskStatus',
    args: [args.taskId],
  }) as Promise<Hex>;
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

async function submitEvaluationRequest(
  publicClient: PublicClient,
  args: SubmitEvaluationParams,
): Promise<({ ok: true } & PendingTaskBuilder) | { ok: false; error: NewtonError }> {
  const taskRequestedAtBlock = await publicClient.getBlockNumber();
  const taskIdRef: TaskIdRef = { taskRequestedAtBlock };

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

    get taskRequestId() {
      return createTaskResult.task_request_id;
    },

    // return the taskId so callers can capture it if they want
    waitForTaskCreated: async () => ensureCreated(),

    // safe: will await creation if caller forgot
    waitForTaskResponded: async () => {
      const taskId = taskIdRef.taskId ?? (await ensureCreated())?.result?.task_id;
      return waitForTaskResponded(publicClient, { taskId }, taskIdRef.taskRequestedAtBlock);
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
