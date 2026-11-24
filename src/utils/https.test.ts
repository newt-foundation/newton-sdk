import { GatewayError, SDKError } from '@core/sdk-exceptions'
import { keccak256, stringToBytes } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AvsHttpService } from './https'

const GATEWAY = 'https://gateway.example.com/rpc'

const respond = (status: number, body: string, headers: Record<string, string> = {}) =>
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async () => new Response(body, { status, headers })),
  )

const postError = async () => {
  try {
    await new AvsHttpService(11155111, GATEWAY).Post('newt_createTask', {}, 'gw_key')
  } catch (error) {
    if (error instanceof GatewayError) return error
    throw error
  }
  throw new Error('expected Post to throw')
}

describe('AvsHttpService', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('resolves gateway URL from chain ID', () => {
    const service = new AvsHttpService(11155111) // sepolia
    expect(service.baseUrl).toBe('https://gateway.testnet.newton.xyz/rpc')
  })

  it('resolves mainnet gateway URL', () => {
    const service = new AvsHttpService(1) // mainnet
    expect(service.baseUrl).toBe('https://gateway.newton.xyz/rpc')
  })

  it('uses URL override when provided', () => {
    const override = 'https://custom-gateway.example.com/rpc'
    const service = new AvsHttpService(11155111, override)
    expect(service.baseUrl).toBe(override)
  })

  it('returns undefined for unsupported chain ID without override', () => {
    const service = new AvsHttpService(999999)
    expect(service.baseUrl).toBeUndefined()
  })

  it('sends the API key as a bearer token and returns the JSON-RPC body', async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify({ jsonrpc: '2.0', result: { ok: true }, error: null, id: 1 })),
    )
    vi.stubGlobal('fetch', fetchMock)

    const payload = await new AvsHttpService(11155111, GATEWAY).Post('newt_simulateTask', { a: 1 }, 'gw_key')

    expect(payload.result).toEqual({ ok: true })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(GATEWAY)
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer gw_key')
    expect(JSON.parse(init.body as string)).toMatchObject({ method: 'newt_simulateTask', params: { a: 1 } })
  })

  it.each([
    [{}, 84532, 11155111],
    [{}, 8453, 1],
    [{}, 31338, 31337],
    [{ chain_id: 84532 }, 1, 84532],
    [[{ intent: { chainId: '0x2105' } }], 11155111, 8453],
  ])('signs the exact body of %j from chain %i under chain %i', async (params, chainId, signedChain) => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ jsonrpc: '2.0', result: 1 })))
    vi.stubGlobal('fetch', fetchMock)
    const signer = privateKeyToAccount(`0x${'01'.repeat(32)}`)
    const signTypedData = vi.spyOn(signer, 'signTypedData')

    await new AvsHttpService(chainId, GATEWAY).Post('newt_getPrivacyPublicKey', params, { apiKey: 'gw_key', signer })

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer gw_key')
    expect(headers['X-Newton-Auth']).toBeTruthy()
    expect(signTypedData.mock.calls[0]?.[0]).toMatchObject({
      domain: { chainId: signedChain },
      message: { method: 'newt_getPrivacyPublicKey', bodyHash: keccak256(stringToBytes(init.body as string)) },
    })
  })

  it('refuses a call with neither a signer nor an API key', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)
    await expect(new AvsHttpService(11155111, GATEWAY).Post('newt_createTask', {}, {})).rejects.toBeInstanceOf(SDKError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('passes a null result through', async () => {
    respond(200, JSON.stringify({ jsonrpc: '2.0', result: null, id: 1 }))
    const payload = await new AvsHttpService(11155111, GATEWAY).Post('newt_getIdentityEncrypted', {}, 'gw_key')
    expect(payload.result).toBeNull()
  })

  it('throws the variant and its payload for a one-key error object', async () => {
    const reason = 'proof_cid is unsupported; zkTLS proof verification is unavailable'
    respond(400, JSON.stringify({ jsonrpc: '2.0', result: null, error: { InvalidRequest: reason }, id: null }))

    const error = await postError()

    expect(error).toMatchObject({ method: 'newt_createTask', status: 400, code: 'InvalidRequest', data: reason })
    expect(error.message).toBe(`Newton SDK: gateway newt_createTask returned 400 [InvalidRequest] ${reason}`)
  })

  it('throws a unit variant by name', async () => {
    respond(429, JSON.stringify({ jsonrpc: '2.0', result: null, error: 'RateLimitExceeded', id: null }))
    expect(await postError()).toMatchObject({ status: 429, code: 'RateLimitExceeded', retryAfter: undefined })
  })

  it('reads Retry-After in seconds', async () => {
    respond(503, JSON.stringify({ jsonrpc: '2.0', result: null, error: { ServiceOverloaded: 'busy' }, id: null }), {
      'retry-after': '2',
    })
    expect(await postError()).toMatchObject({ status: 503, code: 'ServiceOverloaded', retryAfter: 2 })
  })

  it('throws http_error for a status-only rejection', async () => {
    respond(401, '')
    expect(await postError()).toMatchObject({ status: 401, code: 'http_error', rawMessage: 'empty body' })
  })

  it('throws malformed_response for a 2xx body without a result', async () => {
    respond(200, '<html>proxy</html>')
    expect(await postError()).toMatchObject({ status: 200, code: 'malformed_response', data: '<html>proxy</html>' })
  })
})
