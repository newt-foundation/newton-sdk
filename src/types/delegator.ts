import type { Address, Hex, LocalAccount, WalletClient } from 'viem'
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

/** What a resubmission tells a caller that cannot read the intent (see `DelegatorAuth`). */
export interface DelegatedIntentRef {
  intentId: string
  state: DelegatedIntentState
}

export interface SubmitDelegatedIntentParams {
  intent: IntentFromParams
  /** `intent.from`'s EIP-712 signature over the policy client's intent digest. See `signDelegatedIntent`. */
  signature: Hex
  /** One per policy, positionally aligned with the client's policy set. `'0x'` for a pure-Rego policy. */
  wasmArgs?: Hex[]
  /** Cancels the request in flight. */
  abortSignal?: AbortSignal
}

export interface SubmitDelegatedIntentResult {
  /** Only `intentId` and `state` when a resubmission comes from a caller that cannot read the intent. */
  intent: DelegatedIntent | DelegatedIntentRef
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
  /** Cancels the request in flight. */
  abortSignal?: AbortSignal
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
  /** Cancels the request in flight, such as a long-poll. */
  abortSignal?: AbortSignal
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
  /** uint256, as hex. */
  initializationTimestamp: Hex
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
  /** Reject with a `DOMException` named `TimeoutError` after this long. No timeout by default. */
  timeoutMs?: number
  /** Delay between status reads. Default 2000. */
  pollIntervalMs?: number
  /** Rejects with the signal's `reason`: a `DOMException` named `AbortError` unless `abort()` was given one. */
  abortSignal?: AbortSignal
  /**
   * Resolve once the intent is at or past any of these on the happy path; `denied` and `failed`
   * match only themselves. Rejects when the intent ends short of all of them. Default: the terminal states.
   */
  until?: DelegatedIntentState[]
}

/** Signs Newton requests: a local account (such as a session key) or a wallet client. */
export type NewtonAuthSigner = LocalAccount | WalletClient

/** The EIP-712 `NewtonRequest` carried in `X-Newton-Auth`. */
export interface NewtonRequest {
  /** Lowercased hostname of the service. */
  audience: string
  /**
   * For the delegator, `"<VERB> <path>"` with the path as the delegator receives it: percent-encoded, without
   * the query string or a prefix that a proxy strips, e.g. `GET /v1/events`.
   */
  method: string
  /** keccak256 of the exact body bytes. */
  bodyHash: Hex
  signer: Address
  /** Unix milliseconds. */
  timestamp: number
  /** Zero, or the digest of the attached session grant. */
  sessionHash: Hex
}

/** A grantor's offline delegation to a session key, and the grantor's signature over it. */
export interface SignedSessionGrant {
  grant: {
    grantor: Address
    sessionKey: Address
    /** Unix seconds. */
    expiresAt: number
  }
  signature: Hex
}

/** An ephemeral session key and the grant that lets it sign for the grantor. */
export interface NewtonSession {
  account: LocalAccount
  grant: SignedSessionGrant
}

export interface SignNewtonRequestParams {
  audience: string
  method: string
  /** The exact body sent; `''` for a request without one. */
  body: string
  /** Chain in the EIP-712 domain; omit (or 0) for none. The delegator signs under its own chain. */
  chainId?: number
  /** Present when the signer is a session key. */
  session?: SignedSessionGrant
  /** Unix milliseconds. Defaults to now. */
  timestamp?: number
}

/**
 * How the delegator client signs its calls. The principal (the signer, or the session grant's
 * grantor) decides what it can read: a configured reader sees everything, a policy client's owner
 * sees that client's intents, anyone else sees the intents it signed.
 */
export interface DelegatorAuth {
  /** Signs every request. Pass a session's `account` together with its `grant` to avoid a wallet prompt per call. */
  signer: NewtonAuthSigner
  /** The delegator's chain. */
  chainId: number
  /** Defaults to the hostname of the delegator URL. */
  audience?: string
  /** The grant, when `signer` is a session key. */
  session?: SignedSessionGrant
}

export interface DelegatorClientConfig {
  /**
   * Base URL of the delegator, e.g. `https://delegator.example.com`. It can include the path prefix a proxy
   * serves the delegator under, e.g. `https://api.example.com/delegator`; calls are signed over the route after it.
   */
  url: string
  /**
   * Signs requests with `X-Newton-Auth`. Every read needs it, and by default so does a submission,
   * which a reader or the policy client's owner must sign.
   */
  auth?: DelegatorAuth
  /** Custom fetch, e.g. to add headers for a proxy in front of the delegator. Defaults to global `fetch`. */
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
  | 'unauthorized'
  | 'forbidden'
  | 'sender_rate_exceeded'
  | 'owner_unavailable'
  | 'verifier_unavailable'
  | 'internal_error'

export interface SignAndSubmitDelegatedIntentParams extends Omit<SubmitDelegatedIntentParams, 'signature'> {
  /** Base URL of the delegator. */
  delegatorUrl: string
  /** Needed for the returned `waitForIntent`, and by default for the submission (see `submitDelegatedIntent`). */
  auth?: DelegatorAuth
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
