import { AttestationValidatorAbi, NewtonProverTaskManagerAbi, TaskRespondedLog } from '@core/abis/newtonAbi';
import { GATEWAY_METHODS } from '@core/const';
import {
  GatewayCreateTaskResult,
  SubmitEvaluationRequestParams,
  TaskId,
  SubmitIntentResult,
  TaskResponseResult,
  TaskStatus,
  SimulateTaskParams,
  SimulateTaskResult,
  SimulatePolicyParams,
  SimulatePolicyResult,
  SimulatePolicyDataParams,
  SimulatePolicyDataResult,
  SimulatePolicyDataWithClientParams,
  SimulatePolicyDataWithClientResult,
  Task,
} from '@core/types/task';
import { decodeSignatureData } from '@core/utils/format-bls-signature';
import { AvsHttpService } from '@core/utils/https';
import { sanitizeIntentForRequest, removeHexPrefix } from '@core/utils/intent';
import { convertLogToTaskResponse } from '@core/utils/task';
import { getTaskEventsWebSocket } from '@core/utils/task-events';
import {
  hexToBigInt,
  padHex,
  PublicClient as Client,
  WalletClient,
  Hex,
  publicActions,
  PublicClient,
  Address,
  bytesToHex,
} from 'viem';
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
  apiKey: string,
  gatewayApiUrlOverride?: string,
): Promise<{ result: { taskId: Hex; txHash: Hex } } & PendingTaskBuilder> {
  const walletWithPublic = walletClient.extend(publicActions);

  const taskIdRef: TaskIdRef = { taskRequestedAtBlock: await walletWithPublic.getBlockNumber() };

  const avsHttpService = new AvsHttpService(walletWithPublic?.chain?.id ?? sepolia.id, gatewayApiUrlOverride);

  const sanitiziedIntent = sanitizeIntentForRequest(args.intent);
  const requestBody = {
    policy_client: args.policyClient,
    intent: sanitiziedIntent,
    intent_signature: args.intentSignature ? removeHexPrefix(args.intentSignature) : null,
    quorum_number: args.quorumNumber ? removeHexPrefix(args.quorumNumber) : null,
    quorum_threshold_percentage: args.quorumThresholdPercentage ?? null,
    wasm_args: args.wasmArgs ? removeHexPrefix(args.wasmArgs) : null,
    timeout: args.timeout,
    direct_broadcast: true,
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

/**
 * Evaluate intent directly without waiting for task response confirmation on source chain.
 * Results are to be used with `validateAttestationDirect` on NewtonPolicyClient (NewtonProverTaskManagerShared)
 *
 * @param walletClient - Wallet client
 * @param args - Evaluation request parameters
 * @param apiKey - API key
 * @param gatewayApiUrlOverride - Gateway API URL override
 * @returns Evaluation result
 */
async function evaluateIntentDirect(
  walletClient: WalletClient,
  args: SubmitEvaluationRequestParams,
  apiKey: string,
  gatewayApiUrlOverride?: string,
): Promise<{
  result: {
    evaluationResult: boolean;
    task: Task;
    taskResponse: any;
    blsSignature: any;
  };
}> {
  const walletWithPublic = walletClient.extend(publicActions);
  const avsHttpService = new AvsHttpService(walletWithPublic?.chain?.id ?? sepolia.id, gatewayApiUrlOverride);

  const sanitiziedIntent = sanitizeIntentForRequest(args.intent);
  const requestBody = {
    policy_client: args.policyClient,
    intent: sanitiziedIntent,
    intent_signature: args.intentSignature ? removeHexPrefix(args.intentSignature) : null,
    quorum_number: args.quorumNumber ? removeHexPrefix(args.quorumNumber) : null,
    quorum_threshold_percentage: args.quorumThresholdPercentage ?? null,
    wasm_args: args.wasmArgs ? removeHexPrefix(args.wasmArgs) : null,
    timeout: args.timeout,
    direct_broadcast: true,
  };

  const res = await avsHttpService.Post(GATEWAY_METHODS.createTask, requestBody, apiKey);
  if (res.error) throw res.error;
  if (res.result.error) throw new Error(res.result.error);

  const createTaskResult = res.result as GatewayCreateTaskResult;
  const taskResponse = {
    evaluationResult: bytesToHex(Uint8Array.from(createTaskResult.task_response.evaluation_result)),
    intent: createTaskResult.task_response.intent,
    intentSignature: createTaskResult.task_response.intent_signature,
    policyAddress: createTaskResult.task_response.policy_address,
    policyClient: createTaskResult.task_response.policy_client,
    policyConfig: createTaskResult.task_response.policy_config,
    policyId: createTaskResult.task_response.policy_id,
    policyTaskData: createTaskResult.task_response.policy_task_data,
    taskId: createTaskResult.task_id,
  };

  const blsSignature = decodeSignatureData(createTaskResult.signature_data);

  return {
    result: {
      evaluationResult: !!hexToBigInt(taskResponse.evaluationResult),
      task: createTaskResult.task,
      taskResponse,
      blsSignature,
    },
  };
}

/**
 * Submit intent and subscribe to task response on source chain (this will be slower but can be used to challenge the task evaluation)
 * Results are to be used with `validateAttestation` on NewtonPolicyClient (NewtonProverTaskManager)
 *
 * @param walletClient - Wallet client
 * @param args
 * @param apiKey
 * @param gatewayApiUrlOverride
 * @returns
 */
async function submitIntentAndSubscribe(
  walletClient: WalletClient,
  args: SubmitEvaluationRequestParams,
  apiKey: string,
  gatewayApiUrlOverride?: string,
): Promise<{ result: SubmitIntentResult; ws: WebSocket }> {
  const walletWithPublic = walletClient.extend(publicActions);

  const avsHttpService = new AvsHttpService(walletWithPublic?.chain?.id ?? sepolia.id, gatewayApiUrlOverride);

  const sanitiziedIntent = sanitizeIntentForRequest(args.intent);
  const requestBody = {
    policy_client: args.policyClient,
    intent: sanitiziedIntent,
    intent_signature: args.intentSignature ? removeHexPrefix(args.intentSignature) : null,
    quorum_number: args.quorumNumber ? removeHexPrefix(args.quorumNumber) : null,
    quorum_threshold_percentage: args.quorumThresholdPercentage ?? null,
    wasm_args: args.wasmArgs ? removeHexPrefix(args.wasmArgs) : null,
    timeout: args.timeout,
    direct_broadcast: true,
  };

  const res = await avsHttpService.Post(GATEWAY_METHODS.sendTask, requestBody, apiKey);
  if (res.error) throw res.error;
  if (res.result.error) throw new Error(res.result.error);

  const submitIntentResult = res.result as SubmitIntentResult;

  const WS_URL = `wss://${new URL(avsHttpService.baseUrl).hostname}/ws`;

  const ws = getTaskEventsWebSocket(WS_URL, submitIntentResult.subscription_topic, apiKey);

  return { result: submitIntentResult, ws };
}

/**
 * Simulates task evaluation (newt_simulateTask). Forwards to an operator and returns allow/deny without executing on-chain.
 */
async function simulateTask(
  walletClient: WalletClient,
  args: SimulateTaskParams,
  apiKey: string,
  gatewayApiUrlOverride?: string,
): Promise<SimulateTaskResult> {
  const walletWithPublic = walletClient.extend(publicActions);
  const avsHttpService = new AvsHttpService(walletWithPublic?.chain?.id ?? sepolia.id, gatewayApiUrlOverride);
  const requestBody = {
    intent: sanitizeIntentForRequest(args.intent),
    policy_task_data: {
      policyId: args.policyTaskData.policyId,
      policyAddress: args.policyTaskData.policyAddress,
      policy: args.policyTaskData.policy,
      policyData: args.policyTaskData.policyData.map(pd => ({
        wasmArgs: pd.wasmArgs,
        data: pd.data,
        attestation: pd.attestation,
        policyDataAddress: pd.policyDataAddress,
        expireBlock: pd.expireBlock,
      })),
    },
  };
  const res = await avsHttpService.Post(GATEWAY_METHODS.simulateTask, requestBody, apiKey);
  if (res.error) throw res.error;
  return res.result as SimulateTaskResult;
}

/**
 * Simulates full Rego policy evaluation (newt_simulatePolicy). Tests policy with sample intent and policy data; may require ownership if PolicyData uses stored secrets.
 */
async function simulatePolicy(
  walletClient: WalletClient,
  args: SimulatePolicyParams,
  apiKey: string,
  gatewayApiUrlOverride?: string,
): Promise<SimulatePolicyResult> {
  const walletWithPublic = walletClient.extend(publicActions);
  const avsHttpService = new AvsHttpService(walletWithPublic?.chain?.id ?? sepolia.id, gatewayApiUrlOverride);
  const requestBody = {
    policy_client: args.policyClient,
    policy: args.policy,
    intent: sanitizeIntentForRequest(args.intent),
    entrypoint: args.entrypoint ?? undefined,
    policy_data: args.policyData.map(pd => ({
      policy_data_address: pd.policyDataAddress,
      wasm_args: pd.wasmArgs,
    })),
    policy_params: args.policyParams ?? {},
    intent_signature: args.intentSignature ? removeHexPrefix(args.intentSignature) : undefined,
  };
  const res = await avsHttpService.Post(GATEWAY_METHODS.simulatePolicy, requestBody, apiKey);
  if (res.error) throw res.error;
  return res.result as SimulatePolicyResult;
}

/**
 * Simulates PolicyData WASM execution with caller-provided secrets (newt_simulatePolicyData). No ownership verification.
 */
async function simulatePolicyData(
  walletClient: WalletClient,
  args: SimulatePolicyDataParams,
  apiKey: string,
  gatewayApiUrlOverride?: string,
): Promise<SimulatePolicyDataResult> {
  const walletWithPublic = walletClient.extend(publicActions);
  const avsHttpService = new AvsHttpService(walletWithPublic?.chain?.id ?? sepolia.id, gatewayApiUrlOverride);
  const requestBody = {
    policy_data_address: args.policyDataAddress,
    secrets: args.secrets,
    wasm_args: args.wasmArgs,
  };
  const res = await avsHttpService.Post(GATEWAY_METHODS.simulatePolicyData, requestBody, apiKey);
  if (res.error) throw res.error;
  return res.result as SimulatePolicyDataResult;
}

/**
 * Simulates PolicyData WASM execution with stored secrets for a policy client (newt_simulatePolicyDataWithClient). Requires ownership.
 */
async function simulatePolicyDataWithClient(
  walletClient: WalletClient,
  args: SimulatePolicyDataWithClientParams,
  apiKey: string,
  gatewayApiUrlOverride?: string,
): Promise<SimulatePolicyDataWithClientResult> {
  const walletWithPublic = walletClient.extend(publicActions);
  const avsHttpService = new AvsHttpService(walletWithPublic?.chain?.id ?? sepolia.id, gatewayApiUrlOverride);
  const requestBody = {
    policy_data_address: args.policyDataAddress,
    policy_client: args.policyClient,
    wasm_args: args.wasmArgs,
  };
  const res = await avsHttpService.Post(GATEWAY_METHODS.simulatePolicyDataWithClient, requestBody, apiKey);
  if (res.error) throw res.error;
  return res.result as SimulatePolicyDataWithClientResult;
}

export {
  submitEvaluationRequest,
  waitForTaskResponded,
  getTaskResponseHash,
  getTaskStatus,
  evaluateIntentDirect,
  submitIntentAndSubscribe,
  simulateTask,
  simulatePolicy,
  simulatePolicyData,
  simulatePolicyDataWithClient,
};
