import { SDKError } from '@core/sdk-exceptions'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getTaskEventsUrl, getTaskEventsWebSocket } from './task-events'

class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  sent: string[] = []
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  onclose: (() => void) | null = null
  constructor(
    public url: string,
    public protocols: string[],
  ) {
    FakeWebSocket.instances.push(this)
  }
  send(data: string) {
    this.sent.push(data)
  }
}

describe('getTaskEventsUrl', () => {
  it.each([
    ['https://gateway.testnet.newton.xyz/rpc', 'wss://gateway.testnet.newton.xyz/ws'],
    ['https://gateway.newton.xyz/', 'wss://gateway.newton.xyz/ws'],
    ['https://gateway.example.com', 'wss://gateway.example.com/ws'],
    ['https://example.com/prefix/rpc', 'wss://example.com/prefix/ws'],
    ['https://example.com/prefix', 'wss://example.com/prefix/ws'],
    ['https://example.com/jsonrpc', 'wss://example.com/jsonrpc/ws'],
    ['http://localhost:8080/rpc?x=1#y', 'ws://localhost:8080/ws'],
  ])('%s -> %s', (gatewayApiUrl, wsUrl) => {
    expect(getTaskEventsUrl(gatewayApiUrl)).toBe(wsUrl)
  })
})

describe('getTaskEventsWebSocket', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    FakeWebSocket.instances = []
  })

  it('offers the API key as a subprotocol, keeps it out of the URL and subscribes on open', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const key = `gw_${'ab'.repeat(32)}`

    getTaskEventsWebSocket('wss://gateway.example.com/ws', 'deadbeef', key)

    const [ws] = FakeWebSocket.instances
    expect(ws.url).toBe('wss://gateway.example.com/ws')
    expect(ws.protocols).toEqual(['newton.v1', `newton.bearer.${key}`])
    ws.onopen?.()
    expect(JSON.parse(ws.sent[0])).toEqual({ type: 'subscribe', id: 'sub-1', method: 'deadbeef', params: null })
  })

  it('rejects a key a subprotocol cannot carry without echoing the key', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const key = 'secret key/with=chars'

    let thrown: unknown
    try {
      getTaskEventsWebSocket('wss://gateway.example.com/ws', 'deadbeef', key)
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(SDKError)
    expect((thrown as Error).message).toContain('deadbeef')
    expect((thrown as Error).message).not.toContain(key)
    expect(FakeWebSocket.instances).toHaveLength(0)
  })

  it('says so when the key is empty', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)

    expect(() => getTaskEventsWebSocket('wss://gateway.example.com/ws', 'deadbeef', '')).toThrow('the API key is empty')
  })
})
