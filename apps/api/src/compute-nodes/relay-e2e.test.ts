import { afterEach, describe, expect, test } from 'bun:test'
import { fetchComputeNodeThroughRelay } from './relay-client'
import { connectComputeNodeSocketThroughRelay, prepareRelaySocketUpgrade, relaySocketHandlers, type RelaySocketServerState } from './relay-socket'
import { handleRelayHttpRequest } from './relay-server'
import { RelayReplayGuard } from './relay-auth'

const servers: Array<ReturnType<typeof Bun.serve>> = []
afterEach(() => { for (const server of servers.splice(0)) server.stop(true) })

describe('compute-node relay across a real API network boundary', () => {
  test('streams a request body and incremental SSE response through the relay role', async () => {
    const key = 'relay-e2e-key'
    let releaseSecondEvent!: () => void
    const secondEventGate = new Promise<void>((resolve) => { releaseSecondEvent = resolve })
    const hub = { fetch: async (nodeId: string, port: number, request: Request) => {
      expect({ nodeId, port, path: new URL(request.url).pathname }).toEqual({ nodeId: 'node-1', port: 8000, path: '/events' })
      expect(await request.text()).toBe('request-stream')
      return new Response(new ReadableStream({ async start(controller) {
        controller.enqueue(new TextEncoder().encode('data: first\n\n'))
        await secondEventGate
        controller.enqueue(new TextEncoder().encode('data: second\n\n'))
        controller.close()
      } }), { headers: { 'content-type': 'text/event-stream' } })
    } } as any
    const guard = new RelayReplayGuard()
    const server = Bun.serve({ port: 0, fetch: (request) => handleRelayHttpRequest({ request, hub, key, guard }).then((response) => response ?? new Response('missing', { status: 404 })) })
    servers.push(server)
    const response = await fetchComputeNodeThroughRelay({ relayUrl: server.url.toString(), key, nodeId: 'node-1', port: 8000, request: new Request('http://127.0.0.1:8000/events', { method: 'POST', body: 'request-stream' }) })
    expect(response.headers.get('content-type')).toContain('text/event-stream')
    const reader = response.body!.getReader()
    const first = await reader.read()
    expect(first.done).toBe(false)
    expect(new TextDecoder().decode(first.value)).toBe('data: first\n\n')
    releaseSecondEvent()
    const remainder: string[] = []
    for (;;) { const { done, value } = await reader.read(); if (done) break; remainder.push(new TextDecoder().decode(value)) }
    expect(remainder.join('')).toBe('data: second\n\n')
  })

  test('relays bidirectional WebSocket frames through the relay role', async () => {
    const key = 'relay-e2e-key'
    let upstreamClose: { code: number; reason: string } | null = null
    const hub = { connectWebSocket: async (_nodeId: string, _port: number, _path: string, _headers: Record<string, string>, handlers: any) => {
      queueMicrotask(() => handlers.open())
      return { send(data: string | Buffer) { handlers.message(Buffer.from(`echo:${String(data)}`), false) }, close(code = 1000, reason = '') { upstreamClose = { code, reason }; handlers.close(code, reason) } }
    } } as any
    const guard = new RelayReplayGuard()
    const handlers = relaySocketHandlers(hub)
    const server = Bun.serve<RelaySocketServerState>({
      port: 0,
      fetch(request, bunServer) {
        const prepared = prepareRelaySocketUpgrade({ request, key, guard })
        if (!prepared.ok) return Response.json({ error: prepared.message }, { status: prepared.status })
        return bunServer.upgrade(request, { data: prepared.data }) ? undefined : new Response('upgrade failed', { status: 500 })
      },
      websocket: { open: handlers.open as any, message: handlers.message as any, close: handlers.close as any },
    })
    servers.push(server)
    const events: unknown[] = []
    await new Promise<void>((resolve, reject) => {
      const socket = connectComputeNodeSocketThroughRelay({ relayUrl: server.url.toString(), key, nodeId: 'node-1', port: 8000, path: '/pty', headers: { 'x-session': 'one' }, handlers: {
        open() { events.push('open'); socket.send('hello') },
        message(data, binary) { events.push({ value: Buffer.from(data).toString(), binary }); socket.close(1000, 'done') },
        close(code, reason) { events.push({ code, reason }); resolve() },
      } })
      setTimeout(() => reject(new Error(`relay WebSocket timed out: ${JSON.stringify(events)}`)), 3_000).unref?.()
    })
    for (let attempt = 0; attempt < 20 && !upstreamClose; attempt++) await Bun.sleep(5)
    expect(events).toEqual(['open', { value: 'echo:hello', binary: false }, { code: 1000, reason: '' }])
    expect(upstreamClose as unknown).toEqual({ code: 1000, reason: '' })
  })
})
