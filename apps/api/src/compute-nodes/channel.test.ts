import { describe, expect, test } from 'bun:test'
import { createHmac } from 'node:crypto'
import { ComputeNodeChannelHub } from './channel'

class FakeSocket {
  sent: string[] = []
  closed: Array<[number | undefined, string | undefined]> = []
  send(value: string) { this.sent.push(value) }
  close(code?: number, reason?: string) { this.closed.push([code, reason]) }
}

function signed(value: Record<string, unknown>, key: string, nonce: number) {
  return JSON.stringify({ ...value, _nonce: nonce, _sig: createHmac('sha256', key).update(`${nonce}:${JSON.stringify(value)}`).digest('hex') })
}

describe('ComputeNodeChannelHub', () => {
  test('authenticates a sandbox node and replaces its prior connection', async () => {
    const hub = new ComputeNodeChannelHub(async (nodeId, token) => token === 'valid' ? { nodeId, externalId: 'ext-1' } : null)
    const first = new FakeSocket()
    const second = new FakeSocket()
    hub.open(first)
    await hub.message(first, JSON.stringify({ type: 'node.auth', node_id: 'node-1', token: 'valid', version: '1' }))
    hub.open(second)
    await hub.message(second, JSON.stringify({ type: 'node.auth', node_id: 'node-1', token: 'valid', version: '1' }))
    expect(hub.isConnected('node-1')).toBe(true)
    expect(first.closed[0]).toEqual([4004, 'replaced by newer kortixd connection'])
    expect(JSON.parse(second.sent[0]!).type).toBe('node.auth.ok')
  })

  test('rejects a bad credential', async () => {
    const hub = new ComputeNodeChannelHub(async () => null)
    const socket = new FakeSocket()
    hub.open(socket)
    await hub.message(socket, JSON.stringify({ type: 'node.auth', node_id: 'node-1', token: 'bad' }))
    expect(socket.closed[0]).toEqual([4001, 'node authentication failed'])
  })

  test('authenticates before provider external id exists and resolves it later', async () => {
    const hub = new ComputeNodeChannelHub(
      async (nodeId) => ({ nodeId }),
      async (externalId) => externalId === 'ext-later' ? 'node-1' : null,
    )
    const socket = new FakeSocket()
    hub.open(socket)
    await hub.message(socket, JSON.stringify({ type: 'node.auth', node_id: 'node-1', token: 'valid' }))
    const response = hub.fetchByExternalId('ext-later', 8000, new Request('http://node.test/health'))
    await Bun.sleep(0)
    expect(JSON.parse(socket.sent[1]!).type).toBe('stream.open')
    void response.catch(() => {})
    hub.close(socket)
  })

  test('streams an HTTP response from the connected node', async () => {
    const hub = new ComputeNodeChannelHub(async (nodeId) => ({ nodeId, externalId: 'ext-1' }))
    const socket = new FakeSocket()
    hub.open(socket)
    await hub.message(socket, JSON.stringify({ type: 'node.auth', node_id: 'node-1', token: 'valid' }))
    const key = JSON.parse(socket.sent[0]!).signing_key as string
    const responsePromise = hub.fetchByExternalId('ext-1', 8000, new Request('http://node.test/events'))
    await Bun.sleep(0)
    const open = JSON.parse(socket.sent[1]!)
    await hub.message(socket, signed({ v: 1, type: 'stream.response', stream_id: open.stream_id, seq: 0, status: 200, headers: [['content-type', 'text/event-stream']], window: 1024 }, key, 1))
    await hub.message(socket, signed({ v: 1, type: 'stream.response.data', stream_id: open.stream_id, seq: 1, data: Buffer.from('data: ok\n\n').toString('base64') }, key, 2))
    const response = await responsePromise
    expect(response.status).toBe(200)
    const reader = response.body!.getReader()
    expect(Buffer.from((await reader.read()).value!).toString()).toBe('data: ok\n\n')
    await hub.message(socket, signed({ v: 1, type: 'stream.response.end', stream_id: open.stream_id, seq: 2 }, key, 3))
    expect((await reader.read()).done).toBe(true)
  })
})
