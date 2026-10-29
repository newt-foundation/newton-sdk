import type { Address, Hex } from 'viem'
import type { IntentFromParams, PolicyTaskData, Task } from './task'

/**
 * Lifecycle of an intent held by a newton-delegator.
 *
 * `accepted -> attested -> tasked -> broadcast -> included -> finalized` is the happy path.
 * `accepted -> denied` when the policy says no; nothing touches the chain. Any non-terminal
 * state may become `failed`, and `attested`/`tasked`/`broadcast`/`included` may fall back to
 * `accepted` (re-tasked) when the attestation can no longer land.
 */
export type DelegatedIntentState =
  | 'accepted'
  | 'attested'
  | 'tasked'
  | 'broadcast'
  | 'included'
  | 'finalized'
  | 'denied'
  | 'failed'

/** States no transition leaves. */
export const DELEGATED_INTENT_TERMINAL_STATES: readonly DelegatedIntentState[] = ['finalized', 'denied', 'failed']

/** Status of one intent, as `GET /v1/intents/{id}` reports it. */
export interface DelegatedIntent {
  /** Delegator-assigned UUID. */
  intentId: string
  state: DelegatedIntentState
  chainId: number
  policyClient: Address
  /** `intent.from`. */
  from: Address
  /** `keccak256(intent.from ‖ intentDigest(intent))`; one per signed intent however its signature is encoded. */
  idempotencyKey: Hex
  /** Bound once the gateway returns an attestation. */
  taskId: Hex | null
  executionId: string | null
  taskAttempts: number
  /** Set when the policy denied the intent. */
  denialReasons: string | null
  /** Set when the intent failed. */
  terminalError: string | null
  /** Unix milliseconds. */
  createdAtMs: number
  updatedAtMs: number
  completedAtMs: number | null
}

export interface SubmitDelegatedIntentParams {
  intent: IntentFromParams
  /** `intent.from`'s EIP-712 signature over the policy client's intent digest. See `signDelegatedIntent`. */
  signature: Hex
  /** One per policy, positionally aligned with the client's policy set. `'0x'` for a pure-Rego policy. */
  wasmArgs?: Hex[]
}

export interface SubmitDelegatedIntentResult {
  intent: DelegatedIntent
  /** `false` when the delegator already held this signed intent (HTTP 200 rather than 202). */
  created: boolean
}

/** Filters shared by `listIntents` and `getEvents`. */
export interface DelegatedIntentFilter {
  policyClient?: Address
  /** `intent.from`. */
  sender?: Address
  /** For intents, their current state; for events, the state each event reached. */
  states?: DelegatedIntentState[]
  /** Strictly after this time, Unix milliseconds. */
  createdAfterMs?: number
  /** Strictly before this time, Unix milliseconds. */
  createdBeforeMs?: number
}

export interface ListDelegatedIntentsParams extends DelegatedIntentFilter {
  /** `nextCursor` from the previous page. */
  cursor?: string
  /** Default 100. */
  limit?: number
}

export interface DelegatedIntentList {
  /** Newest first. */
  intents: DelegatedIntent[]
  nextCursor: string | null
}

/** One durable state change on the delegator's event feed. */
export interface DelegatorEvent {
  /** Monotonic replay position. */
  cursor: number
  intentId: string
  policyClient: Address
  /** `intent.from`. */
  sender: Address
  /** Absent for acceptance. */
  fromState: DelegatedIntentState | null
  toState: DelegatedIntentState
  taskId: Hex | null
  executionId: string | null
  transactionHash: Hex | null
  /** Denial reasons, failure or supersession detail. */
  detail: string | null
  /** Unix milliseconds. */
  createdAtMs: number
}

export interface GetDelegatorEventsParams extends DelegatedIntentFilter {
  /** Return events with a cursor greater than this. Default 0. */
  after?: number
  /** Default 100. */
  limit?: number
  /** Long-poll for up to this many milliseconds when nothing is newer than `after`. Capped at 30000 by the delegator. */
  waitMs?: number
}

export interface DelegatorEventPage {
  /** Ascending cursor order. */
  events: DelegatorEvent[]
  /** Pass as `after` on the next request. */
  nextCursor: number
  /** Latest cursor present when the page was read. */
  latestCursor: number
  /** Oldest cursor from which a complete replay remains available. */
  retentionFloor: number
}

/** `TaskResponse` as the delegator returns it: Solidity field names, uint256 values as hex. */
export interface DelegatorTaskResponse {
  taskId: Hex
  policyClient: Address
  policyId: Hex
  intent: Task['intent']
  intentSignature: Hex
  allowed: boolean
  policyTaskData: PolicyTaskData[]
}

/**
 * Everything the policy client's entrypoint takes — `(task, taskResponse, signatureData)` —
 * for an `intent.from` that would rather submit the call itself.
 */
export interface DelegatorAttestation {
  task: Task
  taskResponse: DelegatorTaskResponse
  signatureData: Hex
}

export interface WaitForDelegatedIntentParams {
  /** Reject after this long. No timeout by default. */
  timeoutMs?: number
  /** Delay between status reads. Default 2000. */
  pollIntervalMs?: number
  abortSignal?: AbortSignal
  /** Resolve once the intent reaches any of these. Default: the terminal states. */
  until?: DelegatedIntentState[]
}

export interface DelegatorClientConfig {
  /** Base URL of the delegator, e.g. `https://delegator.example.com`. */
  url: string
  /** Custom fetch, e.g. to add auth headers for a proxy in front of the delegator. Defaults to global `fetch`. */
  fetch?: typeof fetch
}

/** Error codes returned in the delegator's error body. */
export type DelegatorErrorCode =
  | 'invalid_intent'
  | 'invalid_query'
  | 'idempotency_conflict'
  | 'not_found'
  | 'resource_gone'
  | 'cursor_pruned'
  | 'sender_capacity_exceeded'
  | 'capacity_exceeded'
  | 'event_feed_busy'
  | 'internal_error'

export interface SignAndSubmitDelegatedIntentParams extends Omit<SubmitDelegatedIntentParams, 'signature'> {
  /** Base URL of the delegator. */
  delegatorUrl: string
  fetch?: typeof fetch
}

export interface PendingDelegatedIntent extends SubmitDelegatedIntentResult {
  /** The signature that was submitted. */
  signature: Hex
  /** Poll this intent until it reaches a terminal state (or `until`). */
  waitForIntent: (params?: WaitForDelegatedIntentParams) => Promise<DelegatedIntent>
}

export interface SignDelegatorApprovalParams {
  policyClient: Address
  /** Unix seconds; `approveDelegator` reverts after it. */
  deadline: bigint
  /** Defaults to the client's current `delegatorNonces(signer)`. */
  nonce?: bigint
}

export interface DelegatorApprovalSignature {
  signature: Hex
  nonce: bigint
  deadline: bigint
}
