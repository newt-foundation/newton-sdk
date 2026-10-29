import { DelegatorError } from '@core/sdk-exceptions'
import { type Hex, hashTypedData, keccak256, recoverTypedDataAddress, stringToBytes, zeroHash } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { describe, expect, it, vi } from 'vitest'
import { audienceFromUrl, createNewtonSession, signNewtonRequest, signSessionGrant } from './auth'
import { createDelegatorClient } from './index'

// Fixed vectors from newton-prover-avs crates/chainio/src/gateway_auth/sign.rs, produced there
// independently with `cast wallet sign`; RFC 6979 makes a matching signature prove matching digests.
const key = (n: number) => privateKeyToAccount(`0x${n.toString(16).padStart(2, '0').repeat(32)}` as Hex)
const NOW_MS = 1_800_000_000_000
const NOW_S = NOW_MS / 1000
const BODY = '{"jsonrpc":"2.0","method":"newt_createTask","params":{"chain_id":1}}'

const decode = (header: string) => {
  const base64 = header.replace(/-/g, '+').replace(/_/g, '/')
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes))
}

const requestTypedData = (request: Record<string, unknown>, chainId?: number) => ({
  domain: chainId ? { name: 'Newton Gateway', version: '1', chainId } : { name: 'Newton Gateway', version: '1' },
  types: {
    NewtonRequest: [
      { name: 'audience', type: 'string' },
      { name: 'method', type: 'string' },
      { name: 'bodyHash', type: 'bytes32' },
      { name: 'signer', type: 'address' },
      { name: 'timestamp', type: 'uint64' },
      { name: 'sessionHash', type: 'bytes32' },
    ],
  },
  primaryType: 'NewtonRequest' as const,
  message: { ...request, timestamp: BigInt(request.timestamp as number) },
})

describe('signNewtonRequest', () => {
  it('matches the gateway_auth request vector', async () => {
    const header = await signNewtonRequest(key(1), {
      audience: 'gateway.testnet.newton.xyz',
      method: 'newt_createTask',
      body: BODY,
      chainId: 1,
      timestamp: NOW_MS,
    })
    const envelope = decode(header)
    expect(envelope.request).toEqual({
      audience: 'gateway.testnet.newton.xyz',
      method: 'newt_createTask',
      bodyHash: keccak256(stringToBytes(BODY)),
      signer: key(1).address,
      timestamp: NOW_MS,
      sessionHash: zeroHash,
    })
    // biome-ignore lint/suspicious/noExplicitAny: typed data built for the test
    expect(hashTypedData(requestTypedData(envelope.request, 1) as any)).toBe(
      '0x423f82818651ad6ea17cc765faf0b1ed540fac545f88d5fcf6737b5876ddc9b5',
    )
    expect(envelope.signature).toBe(
      '0xba4e5dfcd894254424030bf9afd5e4b33f1d5d0b908a3c6813ee94fb9bec71a772947dc010bd9068a8f31c73c039734c815fb94cd1388fc7b441c3d357f9e1f11c',
    )
    expect(envelope.session).toBeUndefined()
    expect(header).not.toMatch(/[=+/]/)
  })

  it('refuses a session request not signed by the session key', async () => {
    const grant = await signSessionGrant(key(1), { sessionKey: key(2).address, expiresAt: NOW_S + 3600 })
    await expect(
      signNewtonRequest(key(3), { audience: 'a', method: 'GET /v1/events', body: '', session: grant }),
    ).rejects.toThrow(/session key/)
  })
})

describe('signSessionGrant', () => {
  it('matches the gateway_auth grant vector', async () => {
    const grant = await signSessionGrant(key(1), { sessionKey: key(2).address, expiresAt: NOW_S + 3600 })
    expect(grant.grant).toEqual({ grantor: key(1).address, sessionKey: key(2).address, expiresAt: NOW_S + 3600 })
    expect(grant.signature).toBe(
      '0xc9d4a89e8ac029cc19faba9563712b37fbeb803e70165a7532f442ff6721f099666065f0ec58ee4c11d5c13a003dce1f118f2bd589ff4e39b2e4164f9c6bf1f61b',
    )
  })

  it('creates a session whose requests carry the grant', async () => {
    const session = await createNewtonSession(key(1), { expiresInSecs: 3600 })
    expect(session.grant.grant.grantor).toBe(key(1).address)
    expect(session.grant.grant.sessionKey).toBe(session.account.address)
    const envelope = decode(
      await signNewtonRequest(session.account, {
        audience: 'a',
        method: 'GET /v1/events',
        body: '',
        chainId: 84532,
        session: session.grant,
      }),
    )
    expect(envelope.session).toEqual(session.grant)
    expect(envelope.request.signer).toBe(session.account.address)
    expect(envelope.request.sessionHash).not.toBe(zeroHash)
  })
})

describe('audienceFromUrl', () => {
  it('is the bare lowercase host', () => {
    expect(audienceFromUrl('https://Delegator.Example.com:8443/base')).toBe('delegator.example.com')
    expect(audienceFromUrl('http://[::1]:8095')).toBe('::1')
  })
})

describe('createDelegatorClient auth', () => {
  const view = {
    intent_id: 'id',
    state: 'accepted',
    chain_id: 84532,
    policy_client: key(9).address,
    from: key(1).address,
    idempotency_key: zeroHash,
    task_id: null,
    execution_id: null,
    task_attempts: 0,
    denial_reasons: null,
    terminal_error: null,
    created_at_ms: 1,
    updated_at_ms: 1,
    completed_at_ms: null,
  }
  const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

  it('signs reads over the verb and path, without the query string', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => ok({ intents: [], next_cursor: null }))
    const client = createDelegatorClient({
      url: 'https://Delegator.Example.com',
      auth: { signer: key(1), chainId: 84532 },
      fetch: fetchMock,
    })
    await client.listIntents({ states: ['denied'] })
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>
    const envelope = decode(headers['X-Newton-Auth'] as string)
    expect(envelope.request).toMatchObject({
      audience: 'delegator.example.com',
      method: 'GET /v1/intents',
      bodyHash: keccak256(new Uint8Array()),
      signer: key(1).address,
    })
    const recovered = await recoverTypedDataAddress({
      // biome-ignore lint/suspicious/noExplicitAny: typed data built for the test
      ...(requestTypedData(envelope.request, 84532) as any),
      signature: envelope.signature,
    })
    expect(recovered).toBe(key(1).address)
  })

  it('signs a submission over its exact body', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => ok(view, 202))
    const client = createDelegatorClient({
      url: 'https://d.example.com',
      auth: { signer: key(1), chainId: 84532, audience: 'acme.example.com' },
      fetch: fetchMock,
    })
    await client.submitIntent({
      intent: {
        from: key(1).address,
        to: key(9).address,
        value: 0n,
        data: '0x',
        chainId: 84532,
        functionSignature: '0x',
      },
      signature: '0xdead',
    })
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    const envelope = decode((init.headers as Record<string, string>)['X-Newton-Auth'] as string)
    expect(envelope.request.method).toBe('POST /v1/intents')
    expect(envelope.request.audience).toBe('acme.example.com')
    expect(envelope.request.bodyHash).toBe(keccak256(stringToBytes(init.body as string)))
  })

  it('sends no auth header without auth, and surfaces the 401 reason', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      ok({ code: 'unauthorized', reason: 'missing_header', error: 'missing X-Newton-Auth header' }, 401),
    )
    const client = createDelegatorClient({ url: 'https://d.example.com', fetch: fetchMock })
    const error = await client.getIntent('id').catch(e => e)
    expect((fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>)['X-Newton-Auth']).toBeUndefined()
    expect(error).toBeInstanceOf(DelegatorError)
    expect(error).toMatchObject({ status: 401, code: 'unauthorized', reason: 'missing_header' })
  })
})
