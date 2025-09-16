import { NewtonAbi, TaskRespondedLog } from '@core/abis/newtonAbi';
import { MAINNET_NEWTON_PROVER_TASK_MANAGER, AVS_METHODS, SEPOLIA_NEWTON_PROVER_TASK_MANAGER } from '@core/const';
import { CreateTaskParams, TaskId, TaskResponse, TaskStatus } from '@core/types/task';
import { AvsHttpService } from '@core/utils/https';
import { hexToBigInt, padHex, PublicClient as Client, WalletClient, keccak256, encodePacked, Hex } from 'viem';

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
  waitForTaskResponded: () => Promise<TaskResponse | undefined>;
}

interface TaskIdRef {
  taskId?: TaskId;
  taskRequestedAtBlock?: bigint;
}

const waitForTaskResponded = async (
  publicClient: Client,
  args: {
    taskId?: Hex;
    timeoutMs?: number;
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
      abi: NewtonAbi,
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
      abi: NewtonAbi,
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
  if (isAttestationSpent) return 'TaskUsed';

  const isTaskChallenged = (await publicClient.readContract({
    address: taskManagerAddress,
    abi: NewtonAbi,
    functionName: 'taskSuccesfullyChallenged',
    args: [args.taskId],
  })) as boolean;
  if (isTaskChallenged) return 'TaskChallenged';

  // TODO: check if task is expired,
  // within attestation field if there is a block number for expires at block, compare it against the current block
  // task response metadata is emitted, so check contract events.
  const allTaskResponses = (await publicClient.readContract({
    address: taskManagerAddress,
    abi: NewtonAbi,
    functionName: 'allTaskResponses',
    args: [args.taskId],
  })) as Hex;
  const isTaskResponded = !!hexToBigInt(allTaskResponses);

  if (isTaskResponded) return 'TaskResponded';

  return 'TaskCreated';
};

async function submitEvaluationRequest(
  publicClient: Client,
  walletClient: WalletClient,
  args: CreateTaskParams,
): Promise<{ result: unknown } & PendingTaskBuilder> {
  const taskRequestedAtBlock = await publicClient.getBlockNumber();
  const taskIdRef: TaskIdRef = { taskRequestedAtBlock };

  const avsHttpService = new AvsHttpService(!!publicClient?.chain?.testnet);

  const account = walletClient.account;

  if (!account || !account.sign) {
    throw new Error('Newton SDK: walletClient must have a local account to sign the request');
  }

  const hash = keccak256(
    encodePacked(
      [
        'address', // policyClient
        'address', // intent.from
        'address', // intent.to
        'uint256', // intent.value
        'bytes', // intent.data
        'uint256', // intent.chainId
        'bytes', // intent.functionSignature
        'bytes', // quorumNumber
        'uint32', // quorumThresholdPercentage
        'uint64', // timeout
      ],
      [
        args.policyClient,
        args.intent.from,
        args.intent.to,
        BigInt(args.intent.value),
        args.intent.data,
        BigInt(args.intent.chainId), // intent.chainId
        args.intent.functionSignature, // intent.functionSignature
        '0x', // quorumNumber
        0, // quorumThresholdPercentage
        BigInt(args.timeout), // timeout
      ],
    ),
  );

  const signature = await account.sign({ hash });

  const requestBody = {
    policy_client: args.policyClient,
    intent: {
      from: args.intent.from,
      to: args.intent.to,
      value: args.intent.value,
      data: args.intent.data,
      chain_id: args.intent.chainId,
      function_signature: args.intent.functionSignature,
    },
    timeout: args.timeout,
    signature,
  };

  const res = await avsHttpService.Post(AVS_METHODS.createTaskAndWait, [requestBody], signature);
  if (res.error) throw res.error;

  const createTaskResult = res.result as WaitForTaskIdResult;
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

  return { result: res.result, ...builder };
}
export { submitEvaluationRequest, waitForTaskResponded, getTaskResponseHash, getTaskStatus };
