import { DelegatorError } from '@core/sdk-exceptions'
import { type Hex, hashTypedData, keccak256, recoverTypedDataAddress, stringToBytes, zeroHash } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { describe, expect, it, vi } from 'vitest'
import { createNewtonSession, signNewtonRequest, signSessionGrant } from './auth'
import { createDelegatorClient } from './index'

// Fixed vectors shared with newton-prover-avs crates/chainio/src/gateway_auth/sign.rs, which asserts the
// same values; RFC 6979 makes a matching signature prove matching digests.
const key = (n: number) => privateKeyToAccount(`0x${n.toString(16).padStart(2, '0').repeat(32)}` as Hex)
const NOW_MS = 1_800_000_000_000
const NOW_S = NOW_MS / 1000
const BODY = '{"jsonrpc":"2.0","method":"newt_createTask","params":{"chain_id":1}}'

const decode = (header: string) => {
  const base64 = header.replace(/-/g, '+').replace(/_/g, '/')
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes))
}

const requestTypedData = (request: Record<string, unknown>, chainId: number) => ({
  domain: { name: 'Newton Gateway', version: '1', chainId },
  types: {
    NewtonRequest: [
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
      method: 'newt_createTask',
      body: BODY,
      chainId: 1,
      timestamp: NOW_MS,
    })
    const envelope = decode(header)
    expect(envelope.request).toEqual({
      method: 'newt_createTask',
      bodyHash: keccak256(stringToBytes(BODY)),
      signer: key(1).address,
      timestamp: NOW_MS,
      sessionHash: zeroHash,
    })
    // biome-ignore lint/suspicious/noExplicitAny: typed data built for the test
    expect(hashTypedData(requestTypedData(envelope.request, 1) as any)).toBe(
      '0x96f89bee2f94a81251a4c08c74a8d2fa0596e83634b4ad6eaf90dee41329f38f',
    )
    expect(envelope.signature).toBe(
      '0xb048e5707f8c865b05ee4fca4c73017d53d55a99bfe83673a798bc5bccf190335eb852442f3d1b7e2c027a7c78fd8cf66768d021bf9ed8f0cad660f057e9bea61b',
    )
    expect(envelope.session).toBeUndefined()
    expect(header).not.toMatch(/[=+/]/)
  })

  it('matches the gateway_auth chainless testnet vector', async () => {
    const body = '{"jsonrpc":"2.0","id":1,"method":"newt_getPrivacyPublicKey","params":{}}'
    const signer = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80')
    const header = await signNewtonRequest(signer, {
      method: 'newt_getPrivacyPublicKey',
      body,
      chainId: 11155111,
      timestamp: 1_795_100_000_000,
    })
    const envelope = decode(header)
    // biome-ignore lint/suspicious/noExplicitAny: typed data built for the test
    expect(hashTypedData(requestTypedData(envelope.request, 11155111) as any)).toBe(
      '0x2c8f84f81dd001a17e6c3da6f5b7c4505079ff3ec6eac4342de62882c461f6b0',
    )
    expect(envelope.signature).toBe(
      '0x0975727e4d8dba7cc8b0571741af0fdbb97e3860fd9fc92f44249f0fe1380f114ba6f0efa6d8b233fb1f7fd17ae88d1166f55665f82321d2f366673f1183134c1c',
    )
  })

  it('refuses a session request not signed by the session key', async () => {
    const grant = await signSessionGrant(key(1), { sessionKey: key(2).address, expiresAt: NOW_S + 3600 })
    await expect(
      signNewtonRequest(key(3), { method: 'GET /v1/events', body: '', chainId: 84532, session: grant }),
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

  it('signs the route path as sent, without the base URL path or the query', async () => {
    const fetchMock = vi.fn<typeof fetch>(async input =>
      String(input).includes('?') ? ok({ intents: [], next_cursor: null }) : ok(view),
    )
    // a path prefix that a proxy in front of the delegator strips
    const client = createDelegatorClient({
      url: 'http://x/delegator',
      auth: { signer: key(1), chainId: 84532 },
      fetch: fetchMock,
    })
    await client.getIntent('a b/c')
    await client.listIntents({ states: ['denied'] })
    const sent = fetchMock.mock.calls.map(([input, init]) => [
      String(input),
      decode((init?.headers as Record<string, string>)['X-Newton-Auth'] as string).request.method,
    ])
    expect(sent).toEqual([
      ['http://x/delegator/v1/intents/a%20b%2Fc', 'GET /v1/intents/a%20b%2Fc'],
      ['http://x/delegator/v1/intents?state=denied', 'GET /v1/intents'],
    ])
  })

  it('signs a submission over its exact body', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => ok(view, 202))
    const client = createDelegatorClient({
      url: 'https://d.example.com',
      auth: { signer: key(1), chainId: 84532 },
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
