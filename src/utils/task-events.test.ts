import { GatewayError, SDKError } from '@core/sdk-exceptions'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getTaskEventsUrl, openTaskEventsWebSocket, subscribeToTask } from './task-events'

class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  static upgrades = true
  sent: string[] = []
  constructor(
    public url: string,
    public protocols: string[],
  ) {
    FakeWebSocket.instances.push(this)
  }
  addEventListener(type: string, listener: () => void) {
    if (type === (FakeWebSocket.upgrades ? 'open' : 'error')) queueMicrotask(listener)
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

describe('openTaskEventsWebSocket', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    FakeWebSocket.instances = []
    FakeWebSocket.upgrades = true
  })

  it('offers the ticket as a subprotocol, keeps it out of the URL and resolves once open', async () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)

    const ws = await openTaskEventsWebSocket('wss://gateway.example.com/ws', 'tkt')

    const [fake] = FakeWebSocket.instances
    expect(ws).toBe(fake)
    expect(fake.url).toBe('wss://gateway.example.com/ws')
    expect(fake.protocols).toEqual(['newton.v1', 'newton.ticket.tkt'])
  })

  it('rejects with GatewayError when the upgrade fails', async () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    FakeWebSocket.upgrades = false

    const error = await openTaskEventsWebSocket('wss://gateway.example.com/ws', 'tkt').catch(e => e)

    expect(error).toBeInstanceOf(GatewayError)
    expect(error).toMatchObject({ code: 'ws_upgrade_failed' })
  })

  it.each(['', 'secret ticket/with=chars'])(
    'rejects the ticket %j a subprotocol cannot carry without echoing it',
    async ticket => {
      vi.stubGlobal('WebSocket', FakeWebSocket)

      const error = await openTaskEventsWebSocket('wss://gateway.example.com/ws', ticket).catch(e => e)

      expect(error).toBeInstanceOf(SDKError)
      if (ticket) expect(error.message).not.toContain(ticket)
      expect(FakeWebSocket.instances).toHaveLength(0)
    },
  )
})

describe('subscribeToTask', () => {
  it('subscribes to the topic', () => {
    const ws = new FakeWebSocket('wss://gateway.example.com/ws', [])

    subscribeToTask(ws as unknown as WebSocket, 'deadbeef')

    expect(JSON.parse(ws.sent[0])).toEqual({ type: 'subscribe', id: 'sub-1', method: 'deadbeef', params: null })
  })
})
