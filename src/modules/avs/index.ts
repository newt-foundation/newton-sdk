import { AttestationValidatorAbi, NewtonProverTaskManagerAbi } from '@core/abis/newtonAbi'
import { GATEWAY_METHODS } from '@core/const'
import { SDKError } from '@core/sdk-exceptions'
import { SDKErrorCode } from '@core/types/core/exception-types'
import type { SecureEnvelope } from '@core/types/privacy'
import {
  type GatewayCreateTaskResult,
  type RegisterWebhookParams,
  type RegisterWebhookResult,
  type SimulatePolicyDataParams,
  type SimulatePolicyDataResult,
  type SimulatePolicyDataWithClientParams,
  type SimulatePolicyDataWithClientResult,
  type SimulatePolicyParams,
  type SimulatePolicyResult,
  type SimulateTaskParams,
  type SimulateTaskResult,
  type SubmitEvaluationRequestParams,
  type SubmitIntentResult,
  type Task,
  type TaskId,
  type TaskResponse,
  type TaskResponseResult,
  TaskStatus,
  type UnregisterWebhookResult,
} from '@core/types/task'
import { AvsHttpService } from '@core/utils/https'
import { removeHexPrefix, sanitizeIntentForRequest } from '@core/utils/intent'
import { convertLogToTaskResponse } from '@core/utils/task'
import { assertWebSocketApiKey, getTaskEventsUrl, getTaskEventsWebSocket } from '@core/utils/task-events'
import {
  type Address,
  type PublicClient as Client,
  type Hex,
  type PublicClient,
  type WalletClient,
  hexToBigInt,
  padHex,
  parseAbi,
  publicActions,
  zeroAddress,
} from 'viem'
import { mainnet, sepolia } from 'viem/chains'

// ChallengeVerifier is not in the synced ABIs; getTaskStatus needs only this public mapping getter.
const CHALLENGE_VERIFIER_ABI = parseAbi(['function taskSuccesfullyChallenged(bytes32 taskId) view returns (bool)'])

export interface PendingTaskBuilder {
  readonly taskId?: TaskId
  waitForTaskResponded: ({
    timeoutMs,
  }: {
    timeoutMs?: number
  }) => Promise<TaskResponseResult>
}

interface TaskIdRef {
  taskId?: TaskId
  taskRequestedAtBlock?: bigint
}

const SafeFromBlock: Record<number, bigint> = {
  [sepolia.id]: BigInt(9223883),
  [mainnet.id]: BigInt(23385048),
} as const

const waitForTaskResponded = async (
  publicClient: Client,
  args: {
    taskId?: Hex
    timeoutMs?: number
    abortSignal?: AbortSignal
  },
  taskManagerAddress: Address,
  taskRequestedAtBlock?: bigint,
): Promise<TaskResponseResult> => {
  if (!args.taskId) {
    throw new Error('Newton SDK: waitForTaskResponded requires taskId')
  }
  // Ensure 32-byte hex (0x + 64 nibbles) for reliable equality checks.
  const targetTaskId = padHex(args.taskId, { size: 32 })

  // 1) Check historical logs first (best-effort from the recent safe block).
  const defaultFromBlock = SafeFromBlock[publicClient.chain?.id ?? 1]
  const fromBlockParam = taskRequestedAtBlock ?? defaultFromBlock

  const past = await publicClient.getContractEvents({
    address: taskManagerAddress,
    abi: NewtonProverTaskManagerAbi,
    eventName: 'TaskResponded',
    fromBlock: fromBlockParam,
    toBlock: 'latest',
    strict: true,
  })

  const match = past.find(log => padHex(log.args.taskResponse.taskId, { size: 32 }) === targetTaskId)
  if (match) return convertLogToTaskResponse(match)

  // 2) If not found, subscribe and resolve on first match.
  return new Promise<TaskResponseResult>((resolve, reject) => {
    let unsub: (() => void) | undefined = undefined
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    const cleanup = (err?: unknown) => {
      unsub?.()
      if (timeoutId) clearTimeout(timeoutId)
      if (err) reject(err)
    }

    if (args.timeoutMs && args.timeoutMs > 0) {
      timeoutId = setTimeout(() => cleanup(new Error('waitForTaskResponded: timeout')), args.timeoutMs)
    }

    if (args.abortSignal) {
      if (args.abortSignal.aborted) {
        cleanup(new Error('waitForTaskResponded: aborted'))
        return
      }
      args.abortSignal.addEventListener('abort', () => cleanup(new Error('waitForTaskResponded: aborted')), {
        once: true,
      })
    }

    unsub = publicClient.watchContractEvent({
      address: taskManagerAddress,
      abi: NewtonProverTaskManagerAbi,
      eventName: 'TaskResponded',
      strict: true,
      onLogs: logs => {
        for (const log of logs) {
          const id = padHex(log.args.taskResponse.taskId, { size: 32 })
          if (id === targetTaskId) {
            const res = convertLogToTaskResponse(log)
            cleanup() // unsub + clear timers
            resolve(res)
            return
          }
        }
      },
      onError: err => {
        cleanup(err)
      },
    })
  })
}

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
  }) as Promise<Hex | null>
}

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
  })) as Hex
  const doesTaskIdExist = !!hexToBigInt(allTaskHashes) // returns 0x0...0 if taskId does not exist
  if (!doesTaskIdExist) throw new Error(`Failed to retrieve task status for taskId ${args.taskId}`)

  const [allTaskResponses, challengeVerifier] = await Promise.all([
    publicClient.readContract({
      address: taskManagerAddress,
      abi: NewtonProverTaskManagerAbi,
      functionName: 'allTaskResponses',
      args: [args.taskId],
    }) as Promise<Hex>,
    publicClient.readContract({
      address: taskManagerAddress,
      abi: NewtonProverTaskManagerAbi,
      functionName: 'challengeVerifier',
    }),
  ])

  // Every successful challenge path sets this flag and invalidates the attestation, so it outranks every other
  // status. It is checked before the response: challengeDirectlyVerifiedAttestation only succeeds on a task that
  // was never responded to.
  if (challengeVerifier !== zeroAddress) {
    const isChallenged = await publicClient.readContract({
      address: challengeVerifier,
      abi: CHALLENGE_VERIFIER_ABI,
      functionName: 'taskSuccesfullyChallenged',
      args: [args.taskId],
    })
    if (isChallenged) return TaskStatus.SuccessfullyChallenged
  }

  if (!hexToBigInt(allTaskResponses)) return TaskStatus.Created

  // attestationExpirations: 0 = no attestation (negative eval), uint32 max = spent, else expiry block
  const SPENT_SENTINEL = 0xffffffff
  const expiration = await publicClient.readContract({
    address: attestationValidatorAddress,
    abi: AttestationValidatorAbi,
    functionName: 'attestationExpirations',
    args: [args.taskId],
  })

  if (expiration === SPENT_SENTINEL) return TaskStatus.AttestationSpent

  if (expiration !== 0) {
    const currentBlock = await publicClient.getBlockNumber()
    if (currentBlock > BigInt(expiration)) return TaskStatus.AttestationExpired
  }

  return TaskStatus.Responded
}

async function submitEvaluationRequest(
  walletClient: WalletClient,
  args: SubmitEvaluationRequestParams,
  taskManagerAddress: Address,
  apiKey: string,
  gatewayApiUrlOverride?: string,
): Promise<{ result: { taskId: Hex; txHash?: Hex } } & PendingTaskBuilder> {
  const walletWithPublic = walletClient.extend(publicActions)

  const taskIdRef: TaskIdRef = {
    taskRequestedAtBlock: await walletWithPublic.getBlockNumber(),
  }

  const avsHttpService = new AvsHttpService(walletWithPublic?.chain?.id ?? sepolia.id, gatewayApiUrlOverride)

  const sanitiziedIntent = sanitizeIntentForRequest(args.intent)
  const requestBody = {
    policy_client: args.policyClient,
    intent: sanitiziedIntent,
    intent_signature: args.intentSignature ? removeHexPrefix(args.intentSignature) : null,
    quorum_number: args.quorumNumber ? removeHexPrefix(args.quorumNumber) : null,
    quorum_threshold_percentage: args.quorumThresholdPercentage ?? null,
    wasm_args: args.wasmArgs.map(removeHexPrefix),
    timeout: args.timeout,
    proof_cid: args.proofCid ?? null,
    include_validate_calldata: args.includeValidateCalldata ?? null,
  }

  const res = await avsHttpService.Post(GATEWAY_METHODS.createTask, requestBody, apiKey)
  if (res.result.error) throw new Error(`newt_createTask failed for task ${res.result.task_id}: ${res.result.error}`)

  const createTaskResult = res.result as GatewayCreateTaskResult
  taskIdRef.taskId = createTaskResult.task_id

  const builder: PendingTaskBuilder = {
    // live view of the ref
    get taskId() {
      return taskIdRef.taskId
    },

    waitForTaskResponded: async ({ timeoutMs }: { timeoutMs?: number }) => {
      const taskId = taskIdRef.taskId
      return waitForTaskResponded(
        walletWithPublic as PublicClient,
        { taskId, timeoutMs },
        taskManagerAddress,
        taskIdRef.taskRequestedAtBlock,
      )
    },
  }

  return {
    result: { taskId: createTaskResult.task_id },
    ...builder,
  }
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
    allowed: boolean
    task: Task
    taskResponse: TaskResponse
    blsSignature: unknown
  }
}> {
  const walletWithPublic = walletClient.extend(publicActions)
  const avsHttpService = new AvsHttpService(walletWithPublic?.chain?.id ?? sepolia.id, gatewayApiUrlOverride)

  const sanitiziedIntent = sanitizeIntentForRequest(args.intent)
  const requestBody = {
    policy_client: args.policyClient,
    intent: sanitiziedIntent,
    intent_signature: args.intentSignature ? removeHexPrefix(args.intentSignature) : null,
    quorum_number: args.quorumNumber ? removeHexPrefix(args.quorumNumber) : null,
    quorum_threshold_percentage: args.quorumThresholdPercentage ?? null,
    wasm_args: args.wasmArgs.map(removeHexPrefix),
    timeout: args.timeout,
    proof_cid: args.proofCid ?? null,
    include_validate_calldata: args.includeValidateCalldata ?? null,
  }

  const res = await avsHttpService.Post(GATEWAY_METHODS.createTask, requestBody, apiKey)
  if (res.result.error) throw new Error(`newt_createTask failed for task ${res.result.task_id}: ${res.result.error}`)

  const createTaskResult = res.result as GatewayCreateTaskResult
  const gatewayTaskResponse = createTaskResult.task_response
  if (!gatewayTaskResponse) {
    throw new SDKError(
      SDKErrorCode.MalformedResponse,
      `newt_createTask returned status ${createTaskResult.status} without task_response for task ${createTaskResult.task_id}`,
    )
  }
  // policyTaskData passes through unflattened: the order is what operators signed over.
  const taskResponse = {
    allowed: gatewayTaskResponse.allowed,
    intent: gatewayTaskResponse.intent,
    intentSignature: gatewayTaskResponse.intent_signature,
    policyClient: gatewayTaskResponse.policy_client,
    policyId: gatewayTaskResponse.policy_id,
    policyTaskData: gatewayTaskResponse.policy_task_data,
    taskId: createTaskResult.task_id,
    initializationTimestamp: gatewayTaskResponse.initialization_timestamp,
  } as unknown as TaskResponse

  return {
    result: {
      allowed: gatewayTaskResponse.allowed,
      task: createTaskResult.task,
      taskResponse,
      blsSignature: createTaskResult.signature_data,
    },
  }
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
  const walletWithPublic = walletClient.extend(publicActions)

  const avsHttpService = new AvsHttpService(walletWithPublic?.chain?.id ?? sepolia.id, gatewayApiUrlOverride)
  const wsUrl = getTaskEventsUrl(avsHttpService.baseUrl)
  // before newt_sendTask, so an unusable key cannot leave a task created with no subscription
  assertWebSocketApiKey(apiKey, wsUrl)

  const sanitiziedIntent = sanitizeIntentForRequest(args.intent)
  const requestBody = {
    policy_client: args.policyClient,
    intent: sanitiziedIntent,
    intent_signature: args.intentSignature ? removeHexPrefix(args.intentSignature) : null,
    quorum_number: args.quorumNumber ? removeHexPrefix(args.quorumNumber) : null,
    quorum_threshold_percentage: args.quorumThresholdPercentage ?? null,
    wasm_args: args.wasmArgs.map(removeHexPrefix),
    timeout: args.timeout,
    proof_cid: args.proofCid ?? null,
  }

  const res = await avsHttpService.Post(GATEWAY_METHODS.sendTask, requestBody, apiKey)
  if (res.result.error) throw new Error(`newt_sendTask failed for task ${res.result.task_id}: ${res.result.error}`)

  const submitIntentResult = res.result as SubmitIntentResult

  const ws = getTaskEventsWebSocket(wsUrl, submitIntentResult.subscription_topic, apiKey)

  return { result: submitIntentResult, ws }
}

/**
 * Evaluates the policy client's policy set on the gateway (newt_simulateTask) without creating a task or collecting
 * operator signatures. The set is read at the current block, so it can differ from the set a past task was admitted
 * with.
 */
async function simulateTask(
  walletClient: WalletClient,
  args: SimulateTaskParams,
  apiKey: string,
  gatewayApiUrlOverride?: string,
): Promise<SimulateTaskResult> {
  const walletWithPublic = walletClient.extend(publicActions)
  const avsHttpService = new AvsHttpService(walletWithPublic?.chain?.id ?? sepolia.id, gatewayApiUrlOverride)
  const requestBody = {
    policy_client: args.policyClient,
    chain_id: args.chainId,
    intent: sanitizeIntentForRequest(args.intent),
    wasm_args: args.wasmArgs.map(removeHexPrefix),
  }
  const res = await avsHttpService.Post(GATEWAY_METHODS.simulateTask, requestBody, apiKey)
  return res.result as SimulateTaskResult
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
  const walletWithPublic = walletClient.extend(publicActions)
  const avsHttpService = new AvsHttpService(walletWithPublic?.chain?.id ?? sepolia.id, gatewayApiUrlOverride)
  const requestBody = {
    policy_client: args.policyClient,
    chain_id: args.chainId,
    intent: sanitizeIntentForRequest(args.intent),
    wasm_args: args.wasmArgs.map(removeHexPrefix),
    intent_signature: args.intentSignature ? removeHexPrefix(args.intentSignature) : undefined,
  }
  const res = await avsHttpService.Post(GATEWAY_METHODS.simulatePolicy, requestBody, apiKey)
  return res.result as SimulatePolicyResult
}

/** newt_simulatePolicyData takes the envelope as a JSON object; callers of the old `string` type pass its JSON. */
function parseSecureEnvelope(secrets: string): SecureEnvelope {
  let envelope: SecureEnvelope
  try {
    envelope = JSON.parse(secrets)
  } catch (error) {
    throw new SDKError(
      SDKErrorCode.InvalidArgument,
      `simulatePolicyData secrets is not SecureEnvelope JSON: ${String(error)}`,
    )
  }
  if (typeof envelope !== 'object' || envelope === null || Array.isArray(envelope)) {
    throw new SDKError(
      SDKErrorCode.InvalidArgument,
      `simulatePolicyData secrets is not SecureEnvelope JSON: it parses to ${Array.isArray(envelope) ? 'an array' : String(envelope)}`,
    )
  }
  return envelope
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
  const walletWithPublic = walletClient.extend(publicActions)
  const avsHttpService = new AvsHttpService(walletWithPublic?.chain?.id ?? sepolia.id, gatewayApiUrlOverride)
  const requestBody = {
    policy_address: args.policyAddress,
    secrets: typeof args.secrets === 'string' ? parseSecureEnvelope(args.secrets) : args.secrets,
    wasm_args: args.wasmArgs,
    chain_id: args.chainId,
  }
  const res = await avsHttpService.Post(GATEWAY_METHODS.simulatePolicyData, requestBody, apiKey)
  return res.result as SimulatePolicyDataResult
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
  const walletWithPublic = walletClient.extend(publicActions)
  const avsHttpService = new AvsHttpService(walletWithPublic?.chain?.id ?? sepolia.id, gatewayApiUrlOverride)
  const requestBody = {
    policy_address: args.policyAddress,
    chain_id: args.chainId,
    policy_client: args.policyClient,
    wasm_args: args.wasmArgs,
  }
  const res = await avsHttpService.Post(GATEWAY_METHODS.simulatePolicyDataWithClient, requestBody, apiKey)
  return res.result as SimulatePolicyDataWithClientResult
}

/**
 * Register a webhook for task failure notifications (newt_registerWebhook).
 */
async function registerWebhook(
  chainId: number,
  apiKey: string,
  params: RegisterWebhookParams,
  gatewayApiUrlOverride?: string,
): Promise<RegisterWebhookResult> {
  const avsHttpService = new AvsHttpService(chainId, gatewayApiUrlOverride)
  const requestBody = {
    url: params.url,
    secret: params.secret ?? undefined,
    timeout_seconds: params.timeoutSeconds ?? 10,
    max_retries: params.maxRetries ?? 3,
    failure_types: params.failureTypes ?? undefined,
  }
  const res = await avsHttpService.Post(GATEWAY_METHODS.registerWebhook, requestBody, apiKey)
  return res.result as RegisterWebhookResult
}

/**
 * Unregister the webhook for the API key (newt_unregisterWebhook).
 */
async function unregisterWebhook(
  chainId: number,
  apiKey: string,
  gatewayApiUrlOverride?: string,
): Promise<UnregisterWebhookResult> {
  const avsHttpService = new AvsHttpService(chainId, gatewayApiUrlOverride)
  const res = await avsHttpService.Post(GATEWAY_METHODS.unregisterWebhook, {}, apiKey)
  return res.result as UnregisterWebhookResult
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
  registerWebhook,
  unregisterWebhook,
}
