import { AttestationValidatorAbi, NewtonProverTaskManagerAbi, TaskRespondedLog } from '@core/abis/newtonAbi';
import { GATEWAY_METHODS } from '@core/const';
import { SubmitEvaluationRequestParams, TaskId, TaskResponseResult, TaskStatus } from '@core/types/task';
import { AvsHttpService } from '@core/utils/https';
import { sanitizeIntentForRequest, normalizeIntent, removeHexPrefix } from '@core/utils/intent';
import { convertLogToTaskResponse, getEvaluationRequestHash } from '@core/utils/task';
import {
  hexToBigInt,
  padHex,
  PublicClient as Client,
  WalletClient,
  Hex,
  publicActions,
  PublicClient,
  Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, sepolia } from 'viem/chains';

export interface CreateTaskResult {
  task_id: Hex;
  task_request: any;
  status: 'Completed' | 'Failed';
  aggregation_response: any;
  timestamp: number;
  error?: unknown;
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
  taskManagerAddress: Address,
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
    address: taskManagerAddress,
    abi: NewtonProverTaskManagerAbi,
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
      address: taskManagerAddress,
      abi: NewtonProverTaskManagerAbi,
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

const getTaskResponseHash = (
  publicClient: Client,
  args: { taskId: TaskId },
  taskManagerAddress: Address,
): Promise<Hex | null> => {
  return publicClient.readContract({
    address: taskManagerAddress,
    abi: NewtonProverTaskManagerAbi,
    functionName: 'allTaskHashes',
    args: [args.taskId],
  }) as Promise<Hex | null>;
};

const getTaskStatus = async (
  publicClient: Client,
  args: { taskId: TaskId },
  taskManagerAddress: Address,
  attestationValidatorAddress: Address,
): Promise<TaskStatus> => {
  const allTaskHashes = (await publicClient.readContract({
    address: taskManagerAddress,
    abi: NewtonProverTaskManagerAbi,
    functionName: 'allTaskHashes',
    args: [args.taskId],
  })) as Hex;
  const doesTaskIdExist = !!hexToBigInt(allTaskHashes); // returns 0x0...0 if taskId does not exist
  if (!doesTaskIdExist) throw new Error(`Failed to retrieve task status for taskId ${args.taskId}`);

  const allTaskResponses = (await publicClient.readContract({
    address: taskManagerAddress,
    abi: NewtonProverTaskManagerAbi,
    functionName: 'allTaskResponses',
    args: [args.taskId],
  })) as Hex;
  const isTaskResponded = !!hexToBigInt(allTaskResponses);

  if (!isTaskResponded) {
    return TaskStatus.Created;
  }

  const past = await publicClient.getContractEvents({
    address: taskManagerAddress,
    abi: NewtonProverTaskManagerAbi,
    eventName: 'TaskResponded',
    fromBlock: SafeFromBlock[publicClient.chain?.id ?? 1],
    toBlock: 'latest',
  });

  const match = (past as TaskRespondedLog[]).find(
    log => padHex(log.args.taskResponse.taskId, { size: 32 }) === args.taskId,
  );
  if (!match) {
    throw new Error(`Failed to retrieve task status for taskId ${args.taskId}`);
  }

  const taskResponse = convertLogToTaskResponse(match);
  const currentBlock = await publicClient.getBlockNumber();
  if (
    taskResponse?.responseCertificate?.responseExpireBlock &&
    currentBlock > taskResponse.responseCertificate.responseExpireBlock
  ) {
    return TaskStatus.AttestationExpired;
  }

  const attestationHash = await publicClient.readContract({
    address: attestationValidatorAddress,
    abi: AttestationValidatorAbi,
    functionName: 'attestations',
    args: [args.taskId],
  });

  const attestationHashBigInt = hexToBigInt(attestationHash as Hex);

  if (!attestationHashBigInt) return TaskStatus.AttestationSpent;

  if (isTaskResponded) return TaskStatus.Responded;

  return TaskStatus.Created;
};

async function submitEvaluationRequest(
  walletClient: WalletClient,
  args: SubmitEvaluationRequestParams,
  taskManagerAddress: Address,
  developerPk: Hex,
  apiKey: string,
  gatewayApiUrl?: string,
): Promise<{ result: { taskId: Hex; txHash: Hex } } & PendingTaskBuilder> {
  const walletWithPublic = walletClient.extend(publicActions);

  const taskIdRef: TaskIdRef = { taskRequestedAtBlock: await walletWithPublic.getBlockNumber() };

  const avsHttpService = new AvsHttpService(!!walletWithPublic?.chain?.testnet, gatewayApiUrl);

  const { policyClient, intentSignature, quorumNumber, quorumThresholdPercentage, wasmArgs, timeout } = args;

  const normalizedIntent = normalizeIntent(args.intent);

  const hash = getEvaluationRequestHash({
    policyClient,
    intent: normalizedIntent,
    intentSignature,
    quorumNumber,
    quorumThresholdPercentage,
    wasmArgs,
    timeout,
  });

  const devSigner = privateKeyToAccount(developerPk);
  const requestSignature = await devSigner.sign({ hash });

  const sanitiziedIntent = sanitizeIntentForRequest(args.intent);
  const requestBody = {
    policy_client: args.policyClient,
    intent: sanitiziedIntent,
    intent_signature: args.intentSignature ? removeHexPrefix(args.intentSignature) : null,
    quorum_number: args.quorumNumber ? removeHexPrefix(args.quorumNumber) : null,
    quorum_threshold_percentage: args.quorumThresholdPercentage ?? null,
    wasm_args: args.wasmArgs ? removeHexPrefix(args.wasmArgs) : null,
    timeout: args.timeout,
    signature: requestSignature,
  };

  const res = await avsHttpService.Post(GATEWAY_METHODS.createTask, requestBody, apiKey);
  if (res.error) throw res.error;
  if (res.result.error) throw new Error(res.result.error);

  const createTaskResult = res.result as CreateTaskResult;
  taskIdRef.taskId = createTaskResult.task_id;

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
        taskManagerAddress,
        taskIdRef.taskRequestedAtBlock,
      );
    },
  };

  return { result: { taskId: res.result.task_id, txHash: res.result.tx_hash }, ...builder };
}
export { submitEvaluationRequest, waitForTaskResponded, getTaskResponseHash, getTaskStatus };
