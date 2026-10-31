import { NewtonPolicyClientDelegationAbi } from '@core/abis/newtonPolicyAbi'
import { DelegatorError } from '@core/sdk-exceptions'
import {
  DELEGATED_INTENT_TERMINAL_STATES,
  type DelegatedIntent,
  type DelegatedIntentFilter,
  type DelegatedIntentList,
  type DelegatedIntentState,
  type DelegatorApprovalSignature,
  type DelegatorAttestation,
  type DelegatorClientConfig,
  type DelegatorEvent,
  type DelegatorEventPage,
  type GetDelegatorEventsParams,
  type ListDelegatedIntentsParams,
  type PendingDelegatedIntent,
  type SignAndSubmitDelegatedIntentParams,
  type SignDelegatorApprovalParams,
  type SubmitDelegatedIntentParams,
  type SubmitDelegatedIntentResult,
  type WaitForDelegatedIntentParams,
} from '@core/types/delegator'
import type { IntentFromParams } from '@core/types/task'
import { normalizeIntent } from '@core/utils/intent'
import {
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
  bytesToHex,
  hashTypedData,
  isAddressEqual,
  publicActions,
  toHex,
} from 'viem'
import { NEWTON_AUTH_HEADER, audienceFromUrl, signNewtonRequest } from './auth'

// EIP-712, as NewtonPolicyClient defines it: one domain per client proxy.
const POLICY_CLIENT_DOMAIN_NAME = 'NewtonPolicyClient'
const POLICY_CLIENT_DOMAIN_VERSION = '1'

const INTENT_TYPES = {
  Intent: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'data', type: 'bytes' },
    { name: 'chainId', type: 'uint256' },
    { name: 'functionSignature', type: 'bytes' },
  ],
} as const

const DELEGATOR_APPROVAL_TYPES = {
  DelegatorApproval: [
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const

const policyClientDomain = (policyClient: Address, chainId: bigint) => ({
  name: POLICY_CLIENT_DOMAIN_NAME,
  version: POLICY_CLIENT_DOMAIN_VERSION,
  chainId,
  verifyingContract: policyClient,
})

/**
 * EIP-712 typed data `intent.from` signs for a delegator: the `Intent` struct under the domain of
 * the policy client at `intent.to`, on `intent.chainId`.
 */
const delegatedIntentTypedData = (intent: IntentFromParams) => {
  const normalized = normalizeIntent(intent)
  return {
    domain: policyClientDomain(normalized.to, normalized.chainId),
    types: INTENT_TYPES,
    primaryType: 'Intent' as const,
    message: {
      from: normalized.from,
      to: normalized.to,
      value: normalized.value,
      data: normalized.data,
      chainId: normalized.chainId,
      functionSignature: normalized.functionSignature,
    },
  }
}

/**
 * The policy client's `intentDigest(intent)`: what `intent.from` signs, and what the client marks
 * spent once a delegator lands it (see `isIntentSpent`).
 */
const getDelegatedIntentDigest = (intent: IntentFromParams): Hex => hashTypedData(delegatedIntentTypedData(intent))

const resolveAccount = async (walletClient: WalletClient) => {
  const account = walletClient.account ?? (await walletClient.getAddresses())[0]
  if (!account) {
    throw new Error('Newton SDK: walletClient has no account to sign with')
  }
  return account
}

/**
 * Sign `intent` as `intent.from` for submission through a delegator. Works with local and
 * JSON-RPC (browser wallet) accounts.
 */
async function signDelegatedIntent(walletClient: WalletClient, args: { intent: IntentFromParams }): Promise<Hex> {
  const account = await resolveAccount(walletClient)
  const signer = typeof account === 'string' ? account : account.address
  if (!isAddressEqual(signer, args.intent.from)) {
    throw new Error(`Newton SDK: intent.from ${args.intent.from} does not match the signing account ${signer}`)
  }
  return walletClient.signTypedData({ account, ...delegatedIntentTypedData(args.intent) })
}

/**
 * Sign, as the delegator key, consent to being added as a delegator of `policyClient`
 * (`DelegatorApproval(nonce, deadline)`). The client owner then submits it with `approveDelegator`.
 * `nonce` defaults to the client's current `delegatorNonces(signer)`.
 */
async function signDelegatorApproval(
  walletClient: WalletClient,
  args: SignDelegatorApprovalParams,
): Promise<DelegatorApprovalSignature> {
  const chainId = walletClient.chain?.id
  if (!chainId) {
    throw new Error('Newton SDK: walletClient has no chain')
  }
  const account = await resolveAccount(walletClient)
  const signer = typeof account === 'string' ? account : account.address
  const nonce =
    args.nonce ??
    (await walletClient.extend(publicActions).readContract({
      address: args.policyClient,
      abi: NewtonPolicyClientDelegationAbi,
      functionName: 'delegatorNonces',
      args: [signer],
    }))
  const signature = await walletClient.signTypedData({
    account,
    domain: policyClientDomain(args.policyClient, BigInt(chainId)),
    types: DELEGATOR_APPROVAL_TYPES,
    primaryType: 'DelegatorApproval',
    message: { nonce, deadline: args.deadline },
  })
  return { signature, nonce, deadline: args.deadline }
}

// Wire shapes, as newton-delegator serializes them.

interface RawIntentView {
  intent_id: string
  state: DelegatedIntentState
  chain_id: number
  policy_client: Address
  from: Address
  idempotency_key: Hex
  task_id: Hex | null
  execution_id: string | null
  task_attempts: number
  denial_reasons: string | null
  terminal_error: string | null
  created_at_ms: number
  updated_at_ms: number
  completed_at_ms: number | null
}

interface RawEvent {
  cursor: number
  intent_id: string
  policy_client: Address
  sender: Address
  from_state: DelegatedIntentState | null
  to_state: DelegatedIntentState
  task_id: Hex | null
  execution_id: string | null
  transaction_hash: Hex | null
  detail: string | null
  created_at_ms: number
}

const toDelegatedIntent = (raw: RawIntentView): DelegatedIntent => ({
  intentId: raw.intent_id,
  state: raw.state,
  chainId: raw.chain_id,
  policyClient: raw.policy_client,
  from: raw.from,
  idempotencyKey: raw.idempotency_key,
  taskId: raw.task_id ?? null,
  executionId: raw.execution_id ?? null,
  taskAttempts: raw.task_attempts,
  denialReasons: raw.denial_reasons ?? null,
  terminalError: raw.terminal_error ?? null,
  createdAtMs: raw.created_at_ms,
  updatedAtMs: raw.updated_at_ms,
  completedAtMs: raw.completed_at_ms ?? null,
})

const toDelegatorEvent = (raw: RawEvent): DelegatorEvent => ({
  cursor: raw.cursor,
  intentId: raw.intent_id,
  policyClient: raw.policy_client,
  sender: raw.sender,
  fromState: raw.from_state ?? null,
  toState: raw.to_state,
  taskId: raw.task_id ?? null,
  executionId: raw.execution_id ?? null,
  transactionHash: raw.transaction_hash ?? null,
  detail: raw.detail ?? null,
  createdAtMs: raw.created_at_ms,
})

const filterParams = (query: URLSearchParams, filter: DelegatedIntentFilter) => {
  if (filter.policyClient) query.set('policy_client', filter.policyClient)
  if (filter.sender) query.set('sender', filter.sender)
  if (filter.states?.length) query.set('state', filter.states.join(','))
  if (filter.createdAfterMs !== undefined) query.set('created_after_ms', String(filter.createdAfterMs))
  if (filter.createdBeforeMs !== undefined) query.set('created_before_ms', String(filter.createdBeforeMs))
}

const sleep = (ms: number, abortSignal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer)
      reject(new Error('Newton SDK: waitForIntent aborted'))
    }
    const timer = setTimeout(() => {
      abortSignal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    abortSignal?.addEventListener('abort', onAbort, { once: true })
  })

// The happy path in order; `denied` and `failed` are off it.
const HAPPY_PATH: readonly DelegatedIntentState[] = [
  'accepted',
  'attested',
  'tasked',
  'broadcast',
  'included',
  'finalized',
]

/** `state` is `target`, or past it on the happy path. */
const reached = (state: DelegatedIntentState, target: DelegatedIntentState) => {
  const at = HAPPY_PATH.indexOf(target)
  return state === target || (at >= 0 && HAPPY_PATH.indexOf(state) >= at)
}

/** HTTP client for a newton-delegator. Every `/v1/*` read must be signed (see `DelegatorAuth`). */
function createDelegatorClient(config: DelegatorClientConfig) {
  // trim trailing slashes without a regex (CodeQL js/polynomial-redos)
  let end = config.url.length
  while (end > 0 && config.url[end - 1] === '/') end--
  const baseUrl = config.url.slice(0, end)
  const doFetch: typeof fetch = config.fetch ?? ((input, init) => fetch(input, init))

  const auth = config.auth
  const audience = auth?.audience ?? (auth ? audienceFromUrl(baseUrl) : undefined)

  const request = async <T>(path: string, init?: RequestInit): Promise<{ status: number; body: T }> => {
    // an already-aborted call signs nothing and sends nothing
    init?.signal?.throwIfAborted()
    const url = `${baseUrl}${path}`
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (init?.body) headers['Content-Type'] = 'application/json'
    if (auth && audience) {
      headers[NEWTON_AUTH_HEADER] = await signNewtonRequest(auth.signer, {
        audience,
        // signed without the query string, as the delegator checks it
        method: `${init?.method ?? 'GET'} ${new URL(url).pathname}`,
        body: typeof init?.body === 'string' ? init.body : '',
        chainId: auth.chainId,
        session: auth.session,
      })
    }
    const response = await doFetch(url, { ...init, headers })
    const text = await response.text()
    // a fetch that ignores its signal must not resolve after the abort
    init?.signal?.throwIfAborted()
    let body: unknown = null
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      body = text
    }
    if (!response.ok) {
      const detail = (body && typeof body === 'object' ? body : {}) as { code?: string; error?: string }
      throw new DelegatorError(
        response.status,
        detail.code ?? 'http_error',
        detail.error ?? (typeof body === 'string' && body ? body : response.statusText),
        body,
      )
    }
    // every route this client calls answers a JSON object; anything else is not a delegator, e.g. an SPA fallback page
    if (!body || typeof body !== 'object') {
      throw new DelegatorError(
        response.status,
        'malformed_response',
        `expected a JSON object from ${init?.method ?? 'GET'} ${url}`,
        body,
      )
    }
    return { status: response.status, body: body as T }
  }

  const submitIntent = async (args: SubmitDelegatedIntentParams): Promise<SubmitDelegatedIntentResult> => {
    const intent = normalizeIntent(args.intent)
    const { status, body } = await request<RawIntentView | Pick<RawIntentView, 'intent_id' | 'state'>>('/v1/intents', {
      method: 'POST',
      body: JSON.stringify({
        intent: {
          from: intent.from,
          to: intent.to,
          value: toHex(intent.value),
          data: intent.data,
          chainId: toHex(intent.chainId),
          functionSignature: intent.functionSignature,
        },
        signature: args.signature,
        wasm_args: args.wasmArgs ?? [],
      }),
      signal: args.abortSignal,
    })
    return {
      // a 200 replay answers only these two unless the caller can read the intent
      intent: 'policy_client' in body ? toDelegatedIntent(body) : { intentId: body.intent_id, state: body.state },
      created: status === 202,
    }
  }

  const getIntent = async (
    intentId: string,
    { abortSignal }: { abortSignal?: AbortSignal } = {},
  ): Promise<DelegatedIntent> => {
    const { body } = await request<RawIntentView>(`/v1/intents/${encodeURIComponent(intentId)}`, {
      signal: abortSignal,
    })
    return toDelegatedIntent(body)
  }

  const listIntents = async (params: ListDelegatedIntentsParams = {}): Promise<DelegatedIntentList> => {
    const query = new URLSearchParams()
    filterParams(query, params)
    if (params.cursor) query.set('cursor', params.cursor)
    if (params.limit !== undefined) query.set('limit', String(params.limit))
    const qs = query.toString()
    const { body } = await request<{ intents: RawIntentView[]; next_cursor: string | null }>(
      `/v1/intents${qs ? `?${qs}` : ''}`,
      { signal: params.abortSignal },
    )
    return { intents: body.intents.map(toDelegatedIntent), nextCursor: body.next_cursor ?? null }
  }

  /**
   * The attestation for `intentId`, or `null` while the intent has none yet. A denied intent can return the
   * gateway's denying attestation, with `taskResponse.allowed` false, so check it before submitting.
   * Throws `DelegatorError` with code `not_found` for an unknown intent. `abortSignal` cancels the read in flight.
   */
  const getAttestation = async (
    intentId: string,
    { abortSignal }: { abortSignal?: AbortSignal } = {},
  ): Promise<DelegatorAttestation | null> => {
    try {
      const { body } = await request<{
        task: DelegatorAttestation['task']
        task_response: DelegatorAttestation['taskResponse']
        signature_data: Hex
      }>(`/v1/intents/${encodeURIComponent(intentId)}/attestation`, { signal: abortSignal })
      return { task: body.task, taskResponse: body.task_response, signatureData: body.signature_data }
    } catch (error) {
      if (!(error instanceof DelegatorError && error.status === 404)) throw error
      // the delegator answers 404 both for an unknown intent and for one not attested yet;
      // the intent itself tells them apart (getIntent throws not_found for the first)
      await getIntent(intentId, { abortSignal })
      return null
    }
  }

  const getEvents = async (params: GetDelegatorEventsParams = {}): Promise<DelegatorEventPage> => {
    const query = new URLSearchParams()
    if (params.after !== undefined) query.set('after', String(params.after))
    if (params.limit !== undefined) query.set('limit', String(params.limit))
    if (params.waitMs !== undefined) query.set('wait_ms', String(params.waitMs))
    filterParams(query, params)
    const qs = query.toString()
    const { body } = await request<{
      events: RawEvent[]
      next_cursor: number
      latest_cursor: number
      retention_floor: number
    }>(`/v1/events${qs ? `?${qs}` : ''}`, { signal: params.abortSignal })
    return {
      events: body.events.map(toDelegatorEvent),
      nextCursor: body.next_cursor,
      latestCursor: body.latest_cursor,
      retentionFloor: body.retention_floor,
    }
  }

  /**
   * Poll `intentId` until it is at or past one of `until` (default: a terminal state). Rejects once
   * the intent ends without reaching any of them. The deadline and `abortSignal` cancel the read in flight.
   */
  const waitForIntent = async (
    intentId: string,
    { timeoutMs, pollIntervalMs = 2000, abortSignal, until }: WaitForDelegatedIntentParams = {},
  ): Promise<DelegatedIntent> => {
    const targets = until ?? DELEGATED_INTENT_TERMINAL_STATES
    let state: DelegatedIntentState | undefined
    // one signal for the caller's abort and the deadline, so either one cancels the read in flight
    const controller = new AbortController()
    const onAbort = () => controller.abort(new Error('Newton SDK: waitForIntent aborted'))
    if (abortSignal?.aborted) onAbort()
    abortSignal?.addEventListener('abort', onAbort, { once: true })
    const timer =
      timeoutMs === undefined
        ? undefined
        : setTimeout(() => {
            controller.abort(
              new Error(`Newton SDK: waitForIntent timed out with intent ${intentId} in state ${state ?? 'unknown'}`),
            )
          }, timeoutMs)
    try {
      for (;;) {
        controller.signal.throwIfAborted()
        const intent = await getIntent(intentId, { abortSignal: controller.signal })
        state = intent.state
        if (targets.some(target => reached(intent.state, target))) return intent
        if (DELEGATED_INTENT_TERMINAL_STATES.includes(intent.state)) {
          throw new Error(
            `Newton SDK: intent ${intentId} ended in state ${intent.state} without reaching ${targets.join(', ')}`,
          )
        }
        await sleep(pollIntervalMs, controller.signal)
      }
    } catch (error) {
      // report why the wait stopped, not how the cancelled read failed
      throw controller.signal.aborted ? controller.signal.reason : error
    } finally {
      clearTimeout(timer)
      abortSignal?.removeEventListener('abort', onAbort)
    }
  }

  return {
    submitIntent,
    getIntent,
    listIntents,
    getAttestation,
    getEvents,
    waitForIntent,
  }
}

type DelegatorClient = ReturnType<typeof createDelegatorClient>

/**
 * Sign `intent` as `intent.from` and submit it to the delegator at `delegatorUrl`. By default a
 * delegator only accepts a submission signed by a reader or the policy client's owner; with no
 * `auth`, or the user's own, this needs one that accepts sender submissions.
 */
async function submitDelegatedIntent(
  walletClient: WalletClient,
  args: SignAndSubmitDelegatedIntentParams,
): Promise<PendingDelegatedIntent> {
  const signature = await signDelegatedIntent(walletClient, { intent: args.intent })
  const client = createDelegatorClient({ url: args.delegatorUrl, auth: args.auth, fetch: args.fetch })
  const result = await client.submitIntent({
    intent: args.intent,
    signature,
    wasmArgs: args.wasmArgs,
    abortSignal: args.abortSignal,
  })
  return {
    ...result,
    signature,
    waitForIntent: params => client.waitForIntent(result.intent.intentId, params),
  }
}

/**
 * Check a delegator webhook delivery: `X-Newton-Signature` is `sha256=<hex HMAC-SHA256(secret, body)>`
 * over the raw request body. Pass the body exactly as received, before any JSON parsing.
 */
async function verifyDelegatorWebhook(args: {
  body: string | Uint8Array
  signature: string | null | undefined
  secret: string
}): Promise<boolean> {
  if (!args.signature?.startsWith('sha256=')) return false
  const encoder = new TextEncoder()
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(args.secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const body = typeof args.body === 'string' ? encoder.encode(args.body) : args.body
  const mac = await globalThis.crypto.subtle.sign('HMAC', key, body)
  const expected = `sha256=${bytesToHex(new Uint8Array(mac)).slice(2)}`
  const received = args.signature.toLowerCase()
  if (received.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ received.charCodeAt(i)
  return diff === 0
}

// NewtonPolicyClient delegation surface (INewtonPolicyClientDelegation)

const delegatorReadFunctions = {
  isDelegator: ({
    publicClient,
    policyClient,
    account,
  }: { publicClient: PublicClient; policyClient: Address; account: Address }): Promise<boolean> =>
    publicClient.readContract({
      address: policyClient,
      abi: NewtonPolicyClientDelegationAbi,
      functionName: 'isDelegator',
      args: [account],
    }),

  delegatorRequired: ({
    publicClient,
    policyClient,
  }: { publicClient: PublicClient; policyClient: Address }): Promise<boolean> =>
    publicClient.readContract({
      address: policyClient,
      abi: NewtonPolicyClientDelegationAbi,
      functionName: 'delegatorRequired',
    }),

  delegatorNonces: ({
    publicClient,
    policyClient,
    delegator,
  }: { publicClient: PublicClient; policyClient: Address; delegator: Address }): Promise<bigint> =>
    publicClient.readContract({
      address: policyClient,
      abi: NewtonPolicyClientDelegationAbi,
      functionName: 'delegatorNonces',
      args: [delegator],
    }),

  /** Whether a delegator already landed `intent` (or the intent with this digest). */
  isIntentSpent: ({
    publicClient,
    policyClient,
    ...args
  }: { publicClient: PublicClient; policyClient: Address } & (
    | { intent: IntentFromParams }
    | { digest: Hex }
  )): Promise<boolean> =>
    publicClient.readContract({
      address: policyClient,
      abi: NewtonPolicyClientDelegationAbi,
      functionName: 'isIntentSpent',
      args: ['digest' in args ? args.digest : getDelegatedIntentDigest(args.intent)],
    }),
}

const delegatorWriteFunctions = {
  /** Owner only. Adds `delegator`, which signed `signDelegatorApproval` for this client. */
  approveDelegator: async ({
    walletClient,
    policyClient,
    delegator,
    deadline,
    signature,
  }: {
    walletClient: WalletClient
    policyClient: Address
    delegator: Address
    deadline: bigint
    signature: Hex
  }): Promise<Hex> => {
    const account = await resolveAccount(walletClient)
    return walletClient.writeContract({
      address: policyClient,
      abi: NewtonPolicyClientDelegationAbi,
      functionName: 'approveDelegator',
      args: [delegator, deadline, signature],
      chain: walletClient.chain,
      account,
    })
  },

  /** Owner only. */
  removeDelegator: async ({
    walletClient,
    policyClient,
    delegator,
  }: { walletClient: WalletClient; policyClient: Address; delegator: Address }): Promise<Hex> => {
    const account = await resolveAccount(walletClient)
    return walletClient.writeContract({
      address: policyClient,
      abi: NewtonPolicyClientDelegationAbi,
      functionName: 'removeDelegator',
      args: [delegator],
      chain: walletClient.chain,
      account,
    })
  },

  /** Owner only. When `required`, `intent.from` can no longer submit its own attestation. */
  setDelegatorRequired: async ({
    walletClient,
    policyClient,
    required,
  }: { walletClient: WalletClient; policyClient: Address; required: boolean }): Promise<Hex> => {
    const account = await resolveAccount(walletClient)
    return walletClient.writeContract({
      address: policyClient,
      abi: NewtonPolicyClientDelegationAbi,
      functionName: 'setDelegatorRequired',
      args: [required],
      chain: walletClient.chain,
      account,
    })
  },

  /** Called by a delegator to remove itself; also voids its unused approvals. */
  resignDelegator: async ({
    walletClient,
    policyClient,
  }: { walletClient: WalletClient; policyClient: Address }): Promise<Hex> => {
    const account = await resolveAccount(walletClient)
    return walletClient.writeContract({
      address: policyClient,
      abi: NewtonPolicyClientDelegationAbi,
      functionName: 'resignDelegator',
      chain: walletClient.chain,
      account,
    })
  },
}

export {
  createDelegatorClient,
  delegatedIntentTypedData,
  delegatorReadFunctions,
  delegatorWriteFunctions,
  getDelegatedIntentDigest,
  signDelegatedIntent,
  signDelegatorApproval,
  submitDelegatedIntent,
  verifyDelegatorWebhook,
  type DelegatorClient,
}
