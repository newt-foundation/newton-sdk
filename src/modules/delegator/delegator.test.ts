import { DelegatorError } from '@core/sdk-exceptions'
import type { IntentFromParams } from '@core/types/task'
import {
  http,
  type Hex,
  createWalletClient,
  encodeAbiParameters,
  encodeFunctionData,
  keccak256,
  recoverTypedDataAddress,
  stringToHex,
  toHex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'
import { describe, expect, it, vi } from 'vitest'
import {
  createDelegatorClient,
  delegatedIntentTypedData,
  getDelegatedIntentDigest,
  signDelegatedIntent,
  signDelegatorApproval,
  submitDelegatedIntent,
  verifyDelegatorWebhook,
} from './index'

const holder = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d')
const TOKEN = '0x2222222222222222222222222222222222222222'

const cosignedTransfer = encodeFunctionData({
  abi: [
    {
      type: 'function',
      name: 'cosignedTransfer',
      inputs: [
        { name: 'to', type: 'address' },
        { name: 'amount', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
      outputs: [],
      stateMutability: 'nonpayable',
    },
  ],
  functionName: 'cosignedTransfer',
  args: ['0x000000000000000000000000000000000000beef', 5n, 0n, 2n ** 64n - 1n],
})

const intent: IntentFromParams = {
  from: holder.address,
  to: TOKEN,
  value: 0n,
  data: cosignedTransfer,
  chainId: sepolia.id,
  functionSignature: stringToHex('cosignedTransfer(address,uint256,uint256,uint256)'),
}

const wallet = createWalletClient({ account: holder, chain: sepolia, transport: http('http://127.0.0.1:1') })

/** `NewtonPolicyClient._intentDigest`, written out the way the contract computes it. */
const solidityIntentDigest = (i: IntentFromParams): Hex => {
  const domainSeparator = keccak256(
    encodeAbiParameters(
      [{ type: 'bytes32' }, { type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint256' }, { type: 'address' }],
      [
        keccak256(stringToHex('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')),
        keccak256(stringToHex('NewtonPolicyClient')),
        keccak256(stringToHex('1')),
        BigInt(i.chainId),
        i.to,
      ],
    ),
  )
  const structHash = keccak256(
    encodeAbiParameters(
      [
        { type: 'bytes32' },
        { type: 'address' },
        { type: 'address' },
        { type: 'uint256' },
        { type: 'bytes32' },
        { type: 'uint256' },
        { type: 'bytes32' },
      ],
      [
        keccak256(
          stringToHex(
            'Intent(address from,address to,uint256 value,bytes data,uint256 chainId,bytes functionSignature)',
          ),
        ),
        i.from,
        i.to,
        BigInt(i.value),
        keccak256(i.data),
        BigInt(i.chainId),
        keccak256(i.functionSignature),
      ],
    ),
  )
  return keccak256(`0x1901${domainSeparator.slice(2)}${structHash.slice(2)}`)
}

describe('getDelegatedIntentDigest', () => {
  it('matches the policy client intentDigest', () => {
    expect(getDelegatedIntentDigest(intent)).toBe(solidityIntentDigest(intent))
  })

  it('accepts hex value and chainId', () => {
    const hexIntent = { ...intent, value: toHex(0n), chainId: toHex(sepolia.id) }
    expect(getDelegatedIntentDigest(hexIntent)).toBe(getDelegatedIntentDigest(intent))
  })

  it('binds the policy client', () => {
    expect(getDelegatedIntentDigest({ ...intent, to: '0x3333333333333333333333333333333333333333' })).not.toBe(
      getDelegatedIntentDigest(intent),
    )
  })
})

describe('signDelegatedIntent', () => {
  it('signs the intent so it recovers to intent.from', async () => {
    const signature = await signDelegatedIntent(wallet, { intent })
    const recovered = await recoverTypedDataAddress({ ...delegatedIntentTypedData(intent), signature })
    expect(recovered).toBe(holder.address)
  })

  it('refuses an intent from another address', async () => {
    await expect(
      signDelegatedIntent(wallet, { intent: { ...intent, from: '0x1111111111111111111111111111111111111111' } }),
    ).rejects.toThrow(/does not match/)
  })
})

describe('signDelegatorApproval', () => {
  it('signs DelegatorApproval under the client domain with the given nonce', async () => {
    const { signature, nonce } = await signDelegatorApproval(wallet, { policyClient: TOKEN, deadline: 100n, nonce: 3n })
    expect(nonce).toBe(3n)
    const recovered = await recoverTypedDataAddress({
      domain: { name: 'NewtonPolicyClient', version: '1', chainId: BigInt(sepolia.id), verifyingContract: TOKEN },
      types: {
        DelegatorApproval: [
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
      primaryType: 'DelegatorApproval',
      message: { nonce: 3n, deadline: 100n },
      signature,
    })
    expect(recovered).toBe(holder.address)
  })
})

const intentView = (state: string, overrides: Record<string, unknown> = {}) => ({
  intent_id: '6f1c2e2a-0d8b-4c39-9a57-6c0d7b0b2f11',
  state,
  chain_id: sepolia.id,
  policy_client: TOKEN,
  from: holder.address,
  idempotency_key: `0x${'ab'.repeat(32)}`,
  task_id: null,
  execution_id: null,
  task_attempts: 0,
  denial_reasons: null,
  terminal_error: null,
  created_at_ms: 1,
  updated_at_ms: 1,
  completed_at_ms: null,
  ...overrides,
})

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

// settles only once its signal aborts, as a fetch honoring the signal does
const hangingFetch: typeof fetch = (_input, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new Error('fetch cancelled')))
  })

describe('createDelegatorClient', () => {
  it('posts the intent the way the delegator deserializes it', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => json(202, intentView('accepted')))
    const client = createDelegatorClient({ url: 'https://delegator.example.com/', fetch: fetchMock })

    const result = await client.submitIntent({ intent, signature: '0xdead', wasmArgs: ['0x0102'] })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://delegator.example.com/v1/intents')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({
      intent: {
        from: holder.address,
        to: TOKEN,
        value: '0x0',
        data: cosignedTransfer,
        chainId: toHex(sepolia.id),
        functionSignature: intent.functionSignature,
      },
      signature: '0xdead',
      wasm_args: ['0x0102'],
    })
    expect(result.created).toBe(true)
    expect(result.intent).toMatchObject({
      intentId: '6f1c2e2a-0d8b-4c39-9a57-6c0d7b0b2f11',
      state: 'accepted',
      policyClient: TOKEN,
      taskId: null,
    })
  })

  it('trims trailing slashes from the base URL', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => json(200, intentView('accepted')))
    const client = createDelegatorClient({ url: 'https://delegator.example.com///', fetch: fetchMock })
    await client.getIntent('id')
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://delegator.example.com/v1/intents/id')
  })

  it('reports a replayed intent as not created', async () => {
    const client = createDelegatorClient({ url: 'http://x', fetch: async () => json(200, intentView('attested')) })
    const result = await client.submitIntent({ intent, signature: '0xdead' })
    expect(result.created).toBe(false)
  })

  it('keeps only the id and state of a resubmission the caller cannot read, and waits on it', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) =>
      init?.method === 'POST' ? json(200, { intent_id: 'id', state: 'tasked' }) : json(200, intentView('finalized')),
    )
    const pending = await submitDelegatedIntent(wallet, { intent, delegatorUrl: 'http://x', fetch: fetchMock })
    expect(pending.intent).toEqual({ intentId: 'id', state: 'tasked' })
    expect(pending.created).toBe(false)
    expect((await pending.waitForIntent()).state).toBe('finalized')
    expect(fetchMock.mock.calls[1]?.[0]).toBe('http://x/v1/intents/id')
  })

  it.each([
    [422, 'invalid_intent'],
    [409, 'idempotency_conflict'],
    [410, 'resource_gone'],
    [429, 'sender_capacity_exceeded'],
    [503, 'capacity_exceeded'],
  ])('throws DelegatorError for %i %s', async (status, code) => {
    const client = createDelegatorClient({ url: 'http://x', fetch: async () => json(status, { code, error: 'nope' }) })
    const error = await client.submitIntent({ intent, signature: '0xdead' }).catch(e => e)
    expect(error).toBeInstanceOf(DelegatorError)
    expect(error).toMatchObject({ status, code, rawMessage: 'nope' })
  })

  it('encodes list filters and maps the page', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      json(200, { intents: [intentView('denied')], next_cursor: 'abc' }),
    )
    const client = createDelegatorClient({ url: 'http://x', fetch: fetchMock })
    const page = await client.listIntents({ sender: holder.address, states: ['accepted', 'denied'], limit: 2 })
    const url = new URL(fetchMock.mock.calls[0]?.[0] as string)
    expect(url.pathname).toBe('/v1/intents')
    expect(url.searchParams.get('sender')).toBe(holder.address)
    expect(url.searchParams.get('state')).toBe('accepted,denied')
    expect(url.searchParams.get('limit')).toBe('2')
    expect(page.nextCursor).toBe('abc')
    expect(page.intents[0]?.state).toBe('denied')
  })

  it('reads the event feed', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      json(200, {
        events: [
          {
            cursor: 3,
            intent_id: 'id',
            policy_client: TOKEN,
            sender: holder.address,
            from_state: 'accepted',
            to_state: 'denied',
            task_id: null,
            execution_id: null,
            transaction_hash: null,
            detail: 'denied',
            created_at_ms: 5,
          },
        ],
        next_cursor: 3,
        latest_cursor: 3,
        retention_floor: 0,
      }),
    )
    const client = createDelegatorClient({ url: 'http://x', fetch: fetchMock })
    const page = await client.getEvents({ after: 2, waitMs: 1000, policyClient: TOKEN })
    const url = new URL(fetchMock.mock.calls[0]?.[0] as string)
    expect(url.searchParams.get('after')).toBe('2')
    expect(url.searchParams.get('wait_ms')).toBe('1000')
    expect(url.searchParams.get('policy_client')).toBe(TOKEN)
    expect(page).toMatchObject({ nextCursor: 3, latestCursor: 3, retentionFloor: 0 })
    expect(page.events[0]).toMatchObject({ fromState: 'accepted', toState: 'denied', detail: 'denied' })
  })

  it('returns null for a known intent that is not attested yet', async () => {
    const client = createDelegatorClient({
      url: 'http://x',
      fetch: async input =>
        String(input).endsWith('/attestation')
          ? json(404, { code: 'not_found', error: 'resource not found' })
          : json(200, intentView('accepted')),
    })
    expect(await client.getAttestation('id')).toBeNull()
  })

  it('throws not_found for an attestation of an unknown intent', async () => {
    const client = createDelegatorClient({
      url: 'http://x',
      fetch: async () => json(404, { code: 'not_found', error: 'resource not found' }),
    })
    await expect(client.getAttestation('id')).rejects.toMatchObject({ status: 404, code: 'not_found' })
  })

  it('waits for a terminal state', async () => {
    const states = ['accepted', 'attested', 'broadcast', 'finalized']
    const fetchMock = vi.fn<typeof fetch>(async () => json(200, intentView(states.shift() ?? 'finalized')))
    const client = createDelegatorClient({ url: 'http://x', fetch: fetchMock })
    const done = await client.waitForIntent('id', { pollIntervalMs: 1 })
    expect(done.state).toBe('finalized')
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  // `attested` lasts milliseconds, so a poll usually lands past it
  it('resolves once the intent is past an until state', async () => {
    const states = ['accepted', 'tasked']
    const client = createDelegatorClient({
      url: 'http://x',
      fetch: async () => json(200, intentView(states.shift() ?? 'failed')),
    })
    const done = await client.waitForIntent('id', { pollIntervalMs: 1, until: ['attested'] })
    expect(done.state).toBe('tasked')
  })

  it('keeps polling through a fallback to accepted', async () => {
    const states = ['tasked', 'accepted', 'broadcast']
    const fetchMock = vi.fn<typeof fetch>(async () => json(200, intentView(states.shift() ?? 'failed')))
    const client = createDelegatorClient({ url: 'http://x', fetch: fetchMock })
    const done = await client.waitForIntent('id', { pollIntervalMs: 1, until: ['broadcast'] })
    expect(done.state).toBe('broadcast')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('rejects when the intent ends short of until', async () => {
    const client = createDelegatorClient({ url: 'http://x', fetch: async () => json(200, intentView('denied')) })
    await expect(client.waitForIntent('id', { until: ['broadcast'] })).rejects.toThrow(/ended in state denied/)
  })

  it('times out while the intent is still live', async () => {
    const client = createDelegatorClient({ url: 'http://x', fetch: async () => json(200, intentView('tasked')) })
    await expect(client.waitForIntent('id', { pollIntervalMs: 5, timeoutMs: 20 })).rejects.toThrow(/timed out/)
  })

  it('cancels the read in flight when aborted', async () => {
    const caller = new AbortController()
    const client = createDelegatorClient({ url: 'http://x', fetch: hangingFetch })
    const wait = client.waitForIntent('id', { abortSignal: caller.signal })
    caller.abort()
    await expect(wait).rejects.toThrow(/waitForIntent aborted/)
  })

  it('cancels the read in flight at the deadline', async () => {
    const client = createDelegatorClient({ url: 'http://x', fetch: hangingFetch })
    await expect(client.waitForIntent('id', { timeoutMs: 5 })).rejects.toThrow(/timed out/)
  })

  it('drops a response that lands after the abort', async () => {
    const caller = new AbortController()
    const client = createDelegatorClient({
      url: 'http://x',
      fetch: async () => {
        caller.abort()
        return json(200, intentView('finalized'))
      },
    })
    await expect(client.waitForIntent('id', { abortSignal: caller.signal })).rejects.toThrow(/aborted/)
  })

  it('drops a response that lands after the deadline', async () => {
    const client = createDelegatorClient({
      url: 'http://x',
      fetch: async () => {
        await new Promise(resolve => setTimeout(resolve, 30))
        return json(200, intentView('finalized'))
      },
    })
    await expect(client.waitForIntent('id', { timeoutMs: 5 })).rejects.toThrow(/timed out/)
  })

  it('clears its deadline and abort listener once settled', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const caller = new AbortController()
      const remove = vi.spyOn(caller.signal, 'removeEventListener')
      const client = createDelegatorClient({ url: 'http://x', fetch: async () => json(200, intentView('finalized')) })
      await client.waitForIntent('id', { timeoutMs: 60_000, abortSignal: caller.signal })
      expect(vi.getTimerCount()).toBe(0)
      expect(remove).toHaveBeenCalledWith('abort', expect.any(Function))
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('verifyDelegatorWebhook', () => {
  // RFC 4231 test case 2, the vector newton-webhook tests against.
  const signature = 'sha256=5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843'

  it('accepts a matching signature', async () => {
    expect(await verifyDelegatorWebhook({ body: 'what do ya want for nothing?', signature, secret: 'Jefe' })).toBe(true)
  })

  it('rejects a wrong secret, body or header', async () => {
    expect(await verifyDelegatorWebhook({ body: 'what do ya want for nothing?', signature, secret: 'jefe' })).toBe(
      false,
    )
    expect(await verifyDelegatorWebhook({ body: 'what do ya want for nothing!', signature, secret: 'Jefe' })).toBe(
      false,
    )
    expect(await verifyDelegatorWebhook({ body: 'x', signature: null, secret: 'Jefe' })).toBe(false)
  })
})
