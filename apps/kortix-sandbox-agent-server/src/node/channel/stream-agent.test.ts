import { describe, expect, test } from 'bun:test'
import { NodeStreamAgent } from './stream-agent'

describe('kortixd node stream agent', () => {
  test('relays request bytes to an authorized loopback port and streams response bytes', async () => {
    const sent: any[] = []
    const agent = new NodeStreamAgent((frame) => sent.push(frame), async (request) => {
      expect(request.url).toBe('http://127.0.0.1:8000/events?x=1')
      expect(await request.text()).toBe('hello')
      return new Response('world', { status: 201, headers: { 'content-type': 'text/plain' } })
    }, new Set([8000]))
    const id = crypto.randomUUID()

    await agent.handle({ v: 1, type: 'stream.open', stream_id: id, seq: 0, port: 8000, method: 'POST', path: '/events?x=1', headers: [], window: 1024 })
    await agent.handle({ v: 1, type: 'stream.request', stream_id: id, seq: 1, data: Buffer.from('hello').toString('base64') })
    await agent.handle({ v: 1, type: 'stream.request.end', stream_id: id, seq: 2 })
    await agent.idle()

    expect(sent.map((frame) => frame.type)).toEqual(['stream.window', 'stream.response', 'stream.response.data', 'stream.response.end'])
    expect(Buffer.from(sent[2].data, 'base64').toString()).toBe('world')
  })

  test('rejects a port outside the sandbox allowlist without calling fetch', async () => {
    const sent: any[] = []
    let called = false
    const agent = new NodeStreamAgent((frame) => sent.push(frame), async () => {
      called = true
      return new Response()
    }, new Set([8000]))

    await agent.handle({ v: 1, type: 'stream.open', stream_id: crypto.randomUUID(), seq: 0, port: 22, method: 'GET', path: '/', headers: [], window: 1024 })
    expect(called).toBe(false)
    expect(sent[0].type).toBe('stream.cancel')
  })

  test('rejects non-contiguous per-stream sequence numbers', async () => {
    const agent = new NodeStreamAgent(() => {}, fetch, new Set([8000]))
    const id = crypto.randomUUID()
    await agent.handle({ v: 1, type: 'stream.open', stream_id: id, seq: 0, port: 8000, method: 'POST', path: '/', headers: [], window: 1024 })
    await expect(agent.handle({ v: 1, type: 'stream.request.end', stream_id: id, seq: 2 })).rejects.toThrow('sequence')
    agent.disconnect()
  })
})
