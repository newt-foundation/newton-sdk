import { newtonAbi, TaskRespondedLog } from '@core/abi';
import { MAINNET_NEWTON_PROVER_TASK_MANAGER, AVS_METHODS, SEPOLIA_NEWTON_PROVER_TASK_MANAGER } from '@core/const';
import { Hex } from '@core/types';
import { NewtonError } from '@core/types/core/sdk-exceptions';
import { SubmitEvaluationParams, TaskId, TaskResponse, TaskStatus } from '@core/types/task';
import { AvsHttpService } from '@core/utils/https';
import { hexToBigInt, padHex, PublicClient, WalletClient } from 'viem';

interface CreateTaskAndWaitResult {
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
  readonly taskId?: TaskId;
  waitForTaskResponded: () => Promise<TaskResponse | undefined>;
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
): Promise<TaskResponse | undefined> => {
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
      address: publicClient.chain?.testnet ? SEPOLIA_NEWTON_PROVER_TASK_MANAGER : MAINNET_NEWTON_PROVER_TASK_MANAGER,
      abi: newtonAbi,
      eventName: 'TaskResponded',
      fromBlock: fromBlockParam,
      toBlock: 'latest',
    });

    const match = (past as TaskRespondedLog[]).find(
      log => padHex(log.args.taskResponse.taskId, { size: 32 }) === targetTaskId,
    );
    if (match) return match.args.taskResponse;
  }

  // 2) If not found, subscribe and resolve on first match.
  return new Promise<TaskResponse | undefined>((resolve, reject) => {
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
      address: publicClient.chain?.testnet ? SEPOLIA_NEWTON_PROVER_TASK_MANAGER : MAINNET_NEWTON_PROVER_TASK_MANAGER,
      abi: newtonAbi,
      eventName: 'TaskResponded',
      onLogs: logs => {
        for (const log of logs as TaskRespondedLog[]) {
          const id = padHex(log.args.taskResponse.taskId, { size: 32 });
          if (id === targetTaskId) {
            const res = log.args.taskResponse;
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
    address: publicClient.chain?.testnet ? SEPOLIA_NEWTON_PROVER_TASK_MANAGER : MAINNET_NEWTON_PROVER_TASK_MANAGER,
    abi: newtonAbi,
    functionName: 'allTaskHashes',
    args: [args.taskId],
  }) as Promise<Hex | null>;
};

const getTaskStatus = async (publicClient: PublicClient, args: { taskId: TaskId }): Promise<TaskStatus> => {
  const taskManagerAddress = publicClient.chain?.testnet
    ? SEPOLIA_NEWTON_PROVER_TASK_MANAGER
    : MAINNET_NEWTON_PROVER_TASK_MANAGER;

  const allTaskHashes = (await publicClient.readContract({
    address: taskManagerAddress,
    abi: newtonAbi,
    functionName: 'allTaskHashes',
    args: [args.taskId],
  })) as Hex;
  const doesTaskIdExist = !!hexToBigInt(allTaskHashes); // returns 0x0...0 if taskId does not exist
  if (!doesTaskIdExist) throw new Error(`Failed to retrieve task status for taskId ${args.taskId}`);

  const isAttestationSpent = (await publicClient.readContract({
    address: taskManagerAddress,
    abi: newtonAbi,
    functionName: 'attestationsSpent',
    args: [args.taskId],
  })) as boolean;
  if (isAttestationSpent) return 'TaskUsed';

  const isTaskChallenged = (await publicClient.readContract({
    address: taskManagerAddress,
    abi: newtonAbi,
    functionName: 'taskSuccesfullyChallenged',
    args: [args.taskId],
  })) as boolean;
  if (isTaskChallenged) return 'TaskChallenged';

  // TODO: check if task is expired,
  // within attestation field if there is a block number for expires at block, compare it against the current block
  // task response metadata is emitted, so check contract events.
  const allTaskResponses = (await publicClient.readContract({
    address: taskManagerAddress,
    abi: newtonAbi,
    functionName: 'allTaskResponses',
    args: [args.taskId],
  })) as Hex;
  const isTaskResponded = !!hexToBigInt(allTaskResponses);

  if (isTaskResponded) return 'TaskResponded';

  return 'TaskCreated';
};

async function submitEvaluationRequest(
  publicClient: PublicClient,
  walletClient: WalletClient,
  args: SubmitEvaluationParams,
): Promise<({ ok: true } & PendingTaskBuilder) | { ok: false; error: NewtonError }> {
  if (walletClient.account === undefined) {
    throw new Error('Newton SDK: No account found in walletClient for newtonWalletClientActions');
  }

  const taskRequestedAtBlock = await publicClient.getBlockNumber();
  const taskIdRef: TaskIdRef = { taskRequestedAtBlock };

  const avsHttpService = new AvsHttpService(!!publicClient?.chain?.testnet);

  // dummy message to validate address
  const authorizationMessage = await walletClient.signMessage({
    message: 'Evaluation Request',
    account: walletClient.account,
  });

  const res = await avsHttpService.Post(
    AVS_METHODS.createTaskAndWait,
    {
      policy_client: args.policyClient,
      intent: args.intent,
      quorum_number: args.quorumNumber,
      quorum_threshold_percentage: args.quorumThresholdPercentage,
      timeout: args.timeout,
    },
    authorizationMessage,
  );
  if (res.error) return { ok: false, error: res.error };

  const createTaskResult = res.result as CreateTaskAndWaitResult;
  taskIdRef.taskId = createTaskResult.result.task_id;

  const builder: { ok: true } & PendingTaskBuilder = {
    ok: true as const,

    // live view of the ref
    get taskId() {
      return taskIdRef.taskId;
    },

    waitForTaskResponded: async () => {
      const taskId = taskIdRef.taskId;
      return waitForTaskResponded(publicClient, { taskId }, taskIdRef.taskRequestedAtBlock);
    },
  };

  return builder;
}
export { submitEvaluationRequest, waitForTaskCreated, waitForTaskResponded, getTaskResponseHash, getTaskStatus };
