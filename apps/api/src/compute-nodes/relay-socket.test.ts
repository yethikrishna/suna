import { describe, expect, test } from 'bun:test'
import { RelayReplayGuard, verifyRelayAuthorization } from './relay-auth'
import { computeNodeRelaySocketTarget, connectComputeNodeSocketThroughRelay, prepareRelaySocketUpgrade } from './relay-socket'

class FakeSocket {
  readyState = 1
  binaryType = ''
  sent: unknown[] = []
  closed: unknown[] = []
  listeners = new Map<string, Array<(event: any) => void>>()
  send(data: unknown) { this.sent.push(data) }
  close(code?: number, reason?: string) { this.closed.push({ code, reason }) }
  addEventListener(type: string, listener: (event: any) => void) { const list = this.listeners.get(type) ?? []; list.push(listener); this.listeners.set(type, list) }
  emit(type: string, event: any = {}) { for (const listener of this.listeners.get(type) ?? []) listener(event) }
}

describe('compute-node relay WebSocket transport', () => {
  test('authenticates and parses a relay-owned socket upgrade', () => {
    const key = 'relay-key'
    const target = computeNodeRelaySocketTarget('https://api.test/v1', 'node/a', 8000, '/pty/1?q=2')
    const socket = connectComputeNodeSocketThroughRelay({
      relayUrl: 'https://api.test/v1', key, nodeId: 'node/a', port: 8000, path: '/pty/1?q=2', headers: { authorization: 'Bearer scoped' }, handlers: { open() {}, message() {}, close() {} },
      socketFactory: (url, headers) => {
        expect(url).toBe(target.toString())
        expect(verifyRelayAuthorization({ key, method: 'GET', target: target.pathname + target.search, headers, guard: new RelayReplayGuard() })).toEqual({ ok: true })
        const request = new Request(url, { headers })
        const prepared = prepareRelaySocketUpgrade({ request, key, guard: new RelayReplayGuard() })
        expect(prepared).toMatchObject({ ok: true, data: { nodeId: 'node/a', port: 8000, path: '/pty/1?q=2', headers: { authorization: 'Bearer scoped' } } })
        return new FakeSocket()
      },
    })
    socket.close(1000, 'done')
  })

  test('relays text, binary, send, and close events without changing message type', () => {
    const fake = new FakeSocket()
    const events: unknown[] = []
    const socket = connectComputeNodeSocketThroughRelay({ relayUrl: 'http://127.0.0.1:8008', key: 'key', nodeId: 'node', port: 8000, path: '/', headers: {}, handlers: {
      open: () => events.push('open'), message: (data, binary) => events.push({ data: Buffer.from(data).toString(), binary }), close: (code, reason) => events.push({ code, reason }),
    }, socketFactory: () => fake })
    fake.emit('open')
    fake.emit('message', { data: 'text' })
    fake.emit('message', { data: new TextEncoder().encode('bytes').buffer })
    fake.emit('close', { code: 1000, reason: 'done' })
    socket.send('client')
    socket.close(1001, 'away')
    expect(events).toEqual(['open', { data: 'text', binary: false }, { data: 'bytes', binary: true }, { code: 1000, reason: 'done' }])
    expect(fake.sent).toEqual(['client'])
    expect(fake.closed).toEqual([{ code: 1001, reason: 'away' }])
  })

  test('rejects unsigned and replayed upgrades', () => {
    const request = new Request('https://api.test/v1/internal/node-relay/socket/node/8000/', { headers: { 'x-kortix-relay-upstream-headers': 'W10' } })
    expect(prepareRelaySocketUpgrade({ request, key: 'key', guard: new RelayReplayGuard() })).toMatchObject({ ok: false, status: 401 })
  })
})
