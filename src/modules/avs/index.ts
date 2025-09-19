import { NewtonAbi, TaskRespondedLog } from '@core/abis/newtonAbi';
import { MAINNET_NEWTON_PROVER_TASK_MANAGER, AVS_METHODS, SEPOLIA_NEWTON_PROVER_TASK_MANAGER } from '@core/const';
import { SubmitEvaluationRequestParams, TaskId, TaskResponseResult, TaskStatus } from '@core/types/task';
import { normalizeBytes } from '@core/utils/bytes';
import { AvsHttpService } from '@core/utils/https';
import { hexlifyIntentForRequest, normalizeIntent } from '@core/utils/intent';
import { convertLogToTaskResponse, getEvaluationRequestHash } from '@core/utils/task';
import { hexToBigInt, padHex, PublicClient as Client, WalletClient, Hex, publicActions, PublicClient } from 'viem';
import { mainnet, sepolia } from 'viem/chains';

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

export interface PendingTaskBuilder {
  readonly taskId?: TaskId;
  waitForTaskResponded: ({ timeoutMs }: { timeoutMs?: number }) => Promise<TaskResponseResult>;
}

interface TaskIdRef {
  taskId?: TaskId;
  taskRequestedAtBlock?: bigint;
}

const SafeFromBlock: Record<number, bigint> = {
  [sepolia.id]: BigInt(9223883),
  [mainnet.id]: BigInt(23385048),
} as const;

const waitForTaskResponded = async (
  publicClient: Client,
  args: {
    taskId?: Hex;
    timeoutMs?: number;
    abortSignal?: AbortSignal;
  },
  taskRequestedAtBlock?: bigint,
): Promise<TaskResponseResult> => {
  if (!args.taskId) {
    throw new Error('Newton SDK: waitForTaskResponded requires taskId');
  }
  // Ensure 32-byte hex (0x + 64 nibbles) for reliable equality checks.
  const targetTaskId = padHex(args.taskId, { size: 32 });

  // 1) Check historical logs first (best-effort from the recent safe block).
  const defaultFromBlock = SafeFromBlock[publicClient.chain?.id ?? 1];
  const fromBlockParam = taskRequestedAtBlock ?? defaultFromBlock;

  const past = await publicClient.getContractEvents({
    address: publicClient.chain?.testnet ? SEPOLIA_NEWTON_PROVER_TASK_MANAGER : MAINNET_NEWTON_PROVER_TASK_MANAGER,
    abi: NewtonAbi,
    eventName: 'TaskResponded',
    fromBlock: fromBlockParam,
    toBlock: 'latest',
  });

  const match = (past as TaskRespondedLog[]).find(
    log => padHex(log.args.taskResponse.taskId, { size: 32 }) === targetTaskId,
  );
  if (match) return convertLogToTaskResponse(match);

  // 2) If not found, subscribe and resolve on first match.
  return new Promise<TaskResponseResult>((resolve, reject) => {
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
      abi: NewtonAbi,
      eventName: 'TaskResponded',
      onLogs: logs => {
        for (const log of logs as TaskRespondedLog[]) {
          const id = padHex(log.args.taskResponse.taskId, { size: 32 });
          if (id === targetTaskId) {
            const res = convertLogToTaskResponse(log);
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

const getTaskResponseHash = (publicClient: Client, args: { taskId: TaskId }): Promise<Hex | null> => {
  return publicClient.readContract({
    address: publicClient.chain?.testnet ? SEPOLIA_NEWTON_PROVER_TASK_MANAGER : MAINNET_NEWTON_PROVER_TASK_MANAGER,
    abi: NewtonAbi,
    functionName: 'allTaskHashes',
    args: [args.taskId],
  }) as Promise<Hex | null>;
};

const getTaskStatus = async (publicClient: Client, args: { taskId: TaskId }): Promise<TaskStatus> => {
  const taskManagerAddress = publicClient.chain?.testnet
    ? SEPOLIA_NEWTON_PROVER_TASK_MANAGER
    : MAINNET_NEWTON_PROVER_TASK_MANAGER;

  const allTaskHashes = (await publicClient.readContract({
    address: taskManagerAddress,
    abi: NewtonAbi,
    functionName: 'allTaskHashes',
    args: [args.taskId],
  })) as Hex;
  const doesTaskIdExist = !!hexToBigInt(allTaskHashes); // returns 0x0...0 if taskId does not exist
  if (!doesTaskIdExist) throw new Error(`Failed to retrieve task status for taskId ${args.taskId}`);

  const isAttestationSpent = (await publicClient.readContract({
    address: taskManagerAddress,
    abi: NewtonAbi,
    functionName: 'attestationsSpent',
    args: [args.taskId],
  })) as boolean;
  if (isAttestationSpent) return TaskStatus.TaskUsed;

  const isTaskChallenged = (await publicClient.readContract({
    address: taskManagerAddress,
    abi: NewtonAbi,
    functionName: 'taskSuccesfullyChallenged',
    args: [args.taskId],
  })) as boolean;
  if (isTaskChallenged) return TaskStatus.TaskChallenged;

  const taskResponse = await waitForTaskResponded(publicClient, { taskId: args.taskId, timeoutMs: 5000 });
  const currentBlock = await publicClient.getBlockNumber();
  if (
    taskResponse.taskResponseMetadata.responseExpireBlock &&
    currentBlock > taskResponse.taskResponseMetadata.responseExpireBlock
  )
    return TaskStatus.TaskExpired;

  const allTaskResponses = (await publicClient.readContract({
    address: taskManagerAddress,
    abi: NewtonAbi,
    functionName: 'allTaskResponses',
    args: [args.taskId],
  })) as Hex;
  const isTaskResponded = !!hexToBigInt(allTaskResponses);

  if (isTaskResponded) return TaskStatus.TaskResponded;

  return TaskStatus.TaskCreated;
};

async function submitEvaluationRequest(
  walletClient: WalletClient,
  args: SubmitEvaluationRequestParams,
): Promise<{ result: { taskId: Hex; txHash: Hex } } & PendingTaskBuilder> {
  const walletWithPublic = walletClient.extend(publicActions);

  const taskIdRef: TaskIdRef = { taskRequestedAtBlock: await walletWithPublic.getBlockNumber() };

  const avsHttpService = new AvsHttpService(!!walletWithPublic?.chain?.testnet);

  const account = walletClient.account;

  if (!account || !account.sign) {
    throw new Error('Newton SDK: walletClient must have a local account to sign the request');
  }

  const { policyClient, quorumNumber, quorumThresholdPercentage, timeout } = args;

  const normalizedIntent = normalizeIntent(args.intent);

  const hash = getEvaluationRequestHash({
    policyClient,
    intent: normalizedIntent,
    quorumNumber: quorumNumber ? normalizeBytes(quorumNumber) : '0x',
    quorumThresholdPercentage,
    timeout,
  });

  const signature = await account.sign({ hash });

  const hexlifiedIntent = hexlifyIntentForRequest(args.intent);
  const requestBody = {
    policy_client: args.policyClient,
    intent: hexlifiedIntent,
    quorum_number: args.quorumNumber ? normalizeBytes(args.quorumNumber) : null,
    quorum_threshold_percentage: args.quorumThresholdPercentage ?? null,
    timeout: args.timeout,
    signature,
  };

  const res = await avsHttpService.Post(AVS_METHODS.createTaskAndWait, [requestBody], signature);
  if (res.error) throw res.error;

  const createTaskResult = res.result as WaitForTaskIdResult;
  taskIdRef.taskId = createTaskResult.result.task_id;

  const builder: PendingTaskBuilder = {
    // live view of the ref
    get taskId() {
      return taskIdRef.taskId;
    },

    waitForTaskResponded: async ({ timeoutMs }: { timeoutMs?: number }) => {
      const taskId = taskIdRef.taskId;
      return waitForTaskResponded(
        walletWithPublic as PublicClient,
        { taskId, timeoutMs },
        taskIdRef.taskRequestedAtBlock,
      );
    },
  };

  return { result: { taskId: res.result.task_id, txHash: res.result.tx_hash }, ...builder };
}
export { submitEvaluationRequest, waitForTaskResponded, getTaskResponseHash, getTaskStatus };
