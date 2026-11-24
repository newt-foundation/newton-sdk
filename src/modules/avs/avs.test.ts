import { SDKError } from '@core/sdk-exceptions'
import { type IntentFromParams, TaskStatus } from '@core/types/task'
import { http, type PublicClient, createWalletClient, zeroAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  evaluateIntentDirect,
  getTaskStatus,
  simulatePolicyData,
  simulatePolicyDataWithClient,
  simulateTask,
  submitIntentAndSubscribe,
} from './index'

const GATEWAY = 'https://gateway.example.com/rpc'
const POLICY_CLIENT = '0x1234567890abcdef1234567890abcdef12345678'
const POLICY = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
const wallet = createWalletClient({ chain: sepolia, transport: http('http://127.0.0.1:1') })
const auth = { signer: privateKeyToAccount(`0x${'01'.repeat(32)}`) }
const intent: IntentFromParams = {
  from: '0x1111111111111111111111111111111111111111',
  to: '0x2222222222222222222222222222222222222222',
  value: 0n,
  data: '0x',
  chainId: sepolia.id,
  functionSignature: '0x',
}

const answer = (result: unknown) => {
  const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ jsonrpc: '2.0', result, id: 1 })))
  vi.stubGlobal('fetch', fetchMock)
  return () => JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string).params
}

describe('avs gateway calls', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('simulateTask sends the gateway SimulateTaskRequest fields', async () => {
    const sent = answer({
      success: true,
      allowed: true,
      policy_id: null,
      policies: [],
      error: null,
      parsed_intent: null,
    })

    await simulateTask(
      wallet,
      { policyClient: POLICY_CLIENT, chainId: sepolia.id, intent, wasmArgs: ['0x', '0x0102'] },
      auth,
      GATEWAY,
    )

    expect(sent()).toMatchObject({ policy_client: POLICY_CLIENT, chain_id: sepolia.id, wasm_args: ['', '0102'] })
    expect(Object.keys(sent()).sort()).toEqual(['chain_id', 'intent', 'policy_client', 'wasm_args'])
  })

  it('simulatePolicyDataWithClient sends chain_id', async () => {
    const sent = answer({ success: true, policy_data: { a: 1 }, error: null })

    const result = await simulatePolicyDataWithClient(
      wallet,
      { policyAddress: POLICY, policyClient: POLICY_CLIENT, chainId: sepolia.id },
      auth,
      GATEWAY,
    )

    expect(sent()).toMatchObject({ policy_address: POLICY, policy_client: POLICY_CLIENT, chain_id: sepolia.id })
    expect(result.policy_data).toEqual({ a: 1 })
  })

  it('simulatePolicyData sends a JSON-string envelope as an object', async () => {
    const envelope = { enc: 'aa', ciphertext: 'bb', policy_client: POLICY_CLIENT, chain_id: sepolia.id }
    const sent = answer({ success: true, policy_data: null, error: null })

    await simulatePolicyData(
      wallet,
      { policyAddress: POLICY, chainId: sepolia.id, secrets: JSON.stringify(envelope) },
      auth,
      GATEWAY,
    )

    expect(sent().secrets).toEqual(envelope)
  })

  it('simulatePolicyData rejects secrets that are not JSON before calling the gateway', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      simulatePolicyData(wallet, { policyAddress: POLICY, chainId: sepolia.id, secrets: 'not json' }, auth, GATEWAY),
    ).rejects.toBeInstanceOf(SDKError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('simulatePolicyData rejects JSON secrets that are not an object before calling the gateway', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      simulatePolicyData(wallet, { policyAddress: POLICY, chainId: sepolia.id, secrets: '"envelope"' }, auth, GATEWAY),
    ).rejects.toThrow('it parses to envelope')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('evaluateIntentDirect names the task when the gateway returns no task_response', async () => {
    const taskId = `0x${'cd'.repeat(32)}`
    const sent = answer({ status: 'success', task_id: taskId, task_response: null, error: null })

    await expect(
      evaluateIntentDirect(
        wallet,
        { policyClient: POLICY_CLIENT, intent, wasmArgs: [], timeout: 10, identityDomain: '0x01', userSignature: 's' },
        auth,
        GATEWAY,
      ),
    ).rejects.toThrow(`newt_createTask returned status success without task_response for task ${taskId}`)
    expect(Object.keys(sent()).sort()).toEqual([
      'include_validate_calldata',
      'intent',
      'intent_signature',
      'policy_client',
      'proof_cid',
      'quorum_number',
      'quorum_threshold_percentage',
      'timeout',
      'wasm_args',
    ])
  })

  it('evaluateIntentDirect names the task when it failed', async () => {
    const taskId = `0x${'cd'.repeat(32)}`
    answer({ status: 'failed', task_id: taskId, task_response: null, error: 'quorum not reached' })

    await expect(
      evaluateIntentDirect(wallet, { policyClient: POLICY_CLIENT, intent, wasmArgs: [], timeout: 10 }, auth, GATEWAY),
    ).rejects.toThrow(`newt_createTask failed for task ${taskId}: quorum not reached`)
  })
})

describe('submitIntentAndSubscribe', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const log: string[] = []
  class FakeWebSocket {
    static upgrades = true
    closed = false
    constructor(
      public url: string,
      public protocols: string[],
    ) {
      log.push(`open ${protocols[1]}`)
    }
    addEventListener(type: string, listener: () => void) {
      if (type === (FakeWebSocket.upgrades ? 'open' : 'error')) queueMicrotask(listener)
    }
    send(data: string) {
      log.push(`send ${JSON.parse(data).method}`)
    }
    close() {
      log.push('close')
    }
  }

  // each gateway answer in turn: a result, or an `Error` for a refusal
  const submit = (answers: unknown[], upgrades = true) => {
    log.length = 0
    FakeWebSocket.upgrades = upgrades
    const fetchMock = vi.fn<typeof fetch>(async (_url, init) => {
      log.push(`post ${JSON.parse(init?.body as string).method}`)
      const result = answers.shift()
      return result instanceof Error
        ? new Response(JSON.stringify({ jsonrpc: '2.0', error: { AuthorizationFailed: 'no' } }), { status: 403 })
        : new Response(JSON.stringify({ jsonrpc: '2.0', result }))
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const sendTaskParams = () => JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string).params
    const run = submitIntentAndSubscribe(
      wallet,
      { policyClient: POLICY_CLIENT, intent, wasmArgs: [], timeout: 10, includeValidateCalldata: true },
      auth,
      GATEWAY,
    )
    return { run, sendTaskParams }
  }
  const ticket = { ticket: 'tkt', expires_at: 0 }
  const task = { message: 'ok', subscription_topic: 'ef'.repeat(32), task_id: `0x${'ef'.repeat(32)}`, timestamp: 0 }

  it('opens the stream with a fresh ticket before sending the task, then subscribes', async () => {
    const { run, sendTaskParams } = submit([ticket, task])

    expect((await run).result.task_id).toBe(task.task_id)
    expect(log).toEqual([
      'post newt_createWsTicket',
      'open newton.ticket.tkt',
      'post newt_sendTask',
      `send ${task.subscription_topic}`,
    ])
    expect(Object.keys(sendTaskParams()).sort()).toEqual([
      'intent',
      'intent_signature',
      'policy_client',
      'proof_cid',
      'quorum_number',
      'quorum_threshold_percentage',
      'timeout',
      'wasm_args',
    ])
  })

  it('sends no task when the ticket is refused', async () => {
    await expect(submit([new Error()]).run).rejects.toMatchObject({ code: 'AuthorizationFailed' })
    expect(log).toEqual(['post newt_createWsTicket'])
  })

  it('sends no task when the upgrade fails', async () => {
    await expect(submit([ticket], false).run).rejects.toMatchObject({ code: 'ws_upgrade_failed' })
    expect(log).toEqual(['post newt_createWsTicket', 'open newton.ticket.tkt'])
  })

  it('closes the stream when the task is refused', async () => {
    await expect(submit([ticket, new Error()]).run).rejects.toMatchObject({ code: 'AuthorizationFailed' })
    expect(log).toEqual(['post newt_createWsTicket', 'open newton.ticket.tkt', 'post newt_sendTask', 'close'])
  })

  it('rejects a ticket a subprotocol cannot carry without echoing it', async () => {
    const secret = 'tkt with/chars'
    const error = await submit([{ ticket: secret }]).run.catch(e => e)
    expect(error).toBeInstanceOf(SDKError)
    expect(error.message).not.toContain(secret)
    expect(log).toEqual(['post newt_createWsTicket'])
  })
})

describe('getTaskStatus', () => {
  const taskId = `0x${'ab'.repeat(32)}` as const
  const taskManager = '0x2222222222222222222222222222222222222222'
  const attestationValidator = '0x3333333333333333333333333333333333333333'
  const challengeVerifier = '0x4444444444444444444444444444444444444444'

  const clientWith = (reads: Record<string, unknown>) =>
    ({
      readContract: vi.fn(async ({ functionName }: { functionName: string }) => reads[functionName]),
      getBlockNumber: vi.fn(async () => 100n),
    }) as unknown as PublicClient

  const responded = { allTaskHashes: `0x${'01'.repeat(32)}`, allTaskResponses: `0x${'02'.repeat(32)}` }

  it('returns SuccessfullyChallenged when the challenge verifier marks the task', async () => {
    const client = clientWith({
      ...responded,
      challengeVerifier,
      taskSuccesfullyChallenged: true,
      attestationExpirations: 0,
    })
    await expect(getTaskStatus(client, { taskId }, taskManager, attestationValidator)).resolves.toBe(
      TaskStatus.SuccessfullyChallenged,
    )
  })

  it('returns SuccessfullyChallenged for a challenged task that was never responded to', async () => {
    const client = clientWith({
      allTaskHashes: responded.allTaskHashes,
      allTaskResponses: `0x${'00'.repeat(32)}`,
      challengeVerifier,
      taskSuccesfullyChallenged: true,
    })
    await expect(getTaskStatus(client, { taskId }, taskManager, attestationValidator)).resolves.toBe(
      TaskStatus.SuccessfullyChallenged,
    )
  })

  it('returns Created for an unchallenged task with no response', async () => {
    const client = clientWith({
      allTaskHashes: responded.allTaskHashes,
      allTaskResponses: `0x${'00'.repeat(32)}`,
      challengeVerifier,
      taskSuccesfullyChallenged: false,
    })
    await expect(getTaskStatus(client, { taskId }, taskManager, attestationValidator)).resolves.toBe(TaskStatus.Created)
  })

  it('falls through to the attestation checks when the task is not challenged', async () => {
    const client = clientWith({
      ...responded,
      challengeVerifier,
      taskSuccesfullyChallenged: false,
      attestationExpirations: 500,
    })
    await expect(getTaskStatus(client, { taskId }, taskManager, attestationValidator)).resolves.toBe(
      TaskStatus.Responded,
    )
  })

  it('skips the challenge read when no challenge verifier is set', async () => {
    const client = clientWith({ ...responded, challengeVerifier: zeroAddress, attestationExpirations: 0xffffffff })
    await expect(getTaskStatus(client, { taskId }, taskManager, attestationValidator)).resolves.toBe(
      TaskStatus.AttestationSpent,
    )
    expect(client.readContract).not.toHaveBeenCalledWith(
      expect.objectContaining({ functionName: 'taskSuccesfullyChallenged' }),
    )
  })
})
