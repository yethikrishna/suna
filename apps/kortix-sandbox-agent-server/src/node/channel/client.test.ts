import { createHmac } from 'node:crypto'
import { describe, expect, test } from 'bun:test'
import { KortixNodeChannel } from './client'

class FakeSocket extends EventTarget {
  static readonly OPEN = 1
  readyState = 1
  sent: string[] = []
  send(value: string) { this.sent.push(value) }
  close() {}
  receive(value: unknown) { this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(value) })) }
}

function signed(value: Record<string, unknown>, key: string, nonce: number) {
  return { ...value, _nonce: nonce, _sig: createHmac('sha256', key).update(`${nonce}:${JSON.stringify(value)}`).digest('hex') }
}

describe('kortixd outbound node channel', () => {
  test('sends a User-Agent required by deployed WebSocket edges', async () => {
    let server: ReturnType<typeof Bun.serve>
    server = Bun.serve<{ authenticated?: boolean }>({
      port: 0,
      fetch(request, bunServer) {
        if (request.headers.get('user-agent') !== 'kortixd') return new Response('missing user-agent', { status: 403 })
        return bunServer.upgrade(request, { data: {} }) ? undefined : new Response('upgrade failed', { status: 500 })
      },
      websocket: {
        message(socket, raw) {
          const frame = JSON.parse(String(raw))
          if (frame.type === 'node.auth') socket.send(JSON.stringify({ type: 'node.auth.ok', signing_key: 'edge-key' }))
        },
      },
    })
    try {
      const channel = new KortixNodeChannel({ apiUrl: `http://127.0.0.1:${server.port}/v1`, nodeId: 'node-1', token: 'secret', ports: new Set() })
      channel.connect()
      for (let attempt = 0; attempt < 40 && !channel.status().connected; attempt++) await Bun.sleep(25)
      expect(channel.status()).toEqual({ connected: true, lastError: null })
      channel.disconnect()
    } finally {
      server.stop(true)
    }
  })

  test('authenticates without putting the credential in the URL', () => {
    const socket = new FakeSocket()
    const channel = new KortixNodeChannel({ apiUrl: 'https://api.test/v1', nodeId: 'node-1', token: 'secret', ports: new Set([8000]), socketFactory: (url) => {
      expect(url).toBe('wss://api.test/v1/nodes/ws')
      return socket as unknown as WebSocket
    } })
    channel.connect()
    socket.dispatchEvent(new Event('open'))
    expect(JSON.parse(socket.sent[0]!)).toMatchObject({ type: 'node.auth', node_id: 'node-1', token: 'secret' })
  })

  test('accepts signed frames and rejects nonce replay', async () => {
    const socket = new FakeSocket()
    const channel = new KortixNodeChannel({ apiUrl: 'http://127.0.0.1:8008/v1', nodeId: 'node-1', token: 'secret', ports: new Set([8000]), socketFactory: () => socket as unknown as WebSocket })
    channel.connect()
    socket.dispatchEvent(new Event('open'))
    socket.receive({ type: 'node.auth.ok', signing_key: 'session-key' })
    await Bun.sleep(0)
    expect(JSON.parse(socket.sent[1]!).type).toBe('node.heartbeat')
    const open = { v: 1, type: 'stream.open', stream_id: crypto.randomUUID(), seq: 0, port: 22, method: 'GET', path: '/', headers: [], window: 1024 }
    socket.receive(signed(open, 'session-key', 1))
    await Bun.sleep(0)
    expect(JSON.parse(socket.sent[2]!).type).toBe('stream.cancel')
    socket.receive(signed(open, 'session-key', 1))
    await Bun.sleep(0)
    expect(channel.status().lastError).toContain('nonce')
  })

  test('accepts text frames delivered as Node WebSocket buffers', async () => {
    const socket = new FakeSocket()
    const channel = new KortixNodeChannel({
      apiUrl: 'https://api.test/v1',
      nodeId: 'node-1',
      token: 'secret',
      ports: new Set([8000]),
      socketFactory: () => socket as unknown as WebSocket,
    })
    channel.connect()
    socket.dispatchEvent(new Event('open'))
    socket.dispatchEvent(new MessageEvent('message', {
      data: Buffer.from(JSON.stringify({ type: 'node.auth.ok', signing_key: 'session-key' })),
    }))
    await Bun.sleep(0)
    expect(channel.status()).toEqual({ connected: true, lastError: null })
    expect(JSON.parse(socket.sent[1]!).type).toBe('node.heartbeat')
  })
})
