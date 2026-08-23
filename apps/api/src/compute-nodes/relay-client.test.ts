import { describe, expect, test } from 'bun:test'
import { computeNodeRelayTarget, fetchComputeNodeThroughRelay } from './relay-client'
import { RelayReplayGuard, verifyRelayAuthorization } from './relay-auth'

describe('compute-node relay HTTP client', () => {
  test('builds one versioned internal target from API origins and /v1 bases', () => {
    expect(computeNodeRelayTarget('https://api.kortix.test', 'node/a', 8000, '/event?x=1').toString()).toBe('https://api.kortix.test/v1/internal/node-relay/http/node%2Fa/8000/event?x=1')
    expect(computeNodeRelayTarget('https://api.kortix.test/v1', 'node', 3000, '/').pathname).toBe('/v1/internal/node-relay/http/node/3000/')
  })

  test('streams the request and response through an authenticated relay request', async () => {
    const key = 'relay-key'
    const chunks: string[] = []
    const response = await fetchComputeNodeThroughRelay({
      relayUrl: 'https://api.kortix.test/v1', key, nodeId: 'node-1', port: 8000,
      request: new Request('http://127.0.0.1:8000/events?q=1', { method: 'POST', headers: { connection: 'close', 'x-test': 'ok' }, body: 'request-body' }),
      fetchImpl: (async (target, init) => {
        const request = new Request(target, init)
        expect(request.headers.get('connection')).toBeNull()
        expect(request.headers.get('x-test')).toBe('ok')
        expect(verifyRelayAuthorization({ key, method: request.method, target: new URL(request.url).pathname + new URL(request.url).search, headers: request.headers, guard: new RelayReplayGuard() })).toEqual({ ok: true })
        expect(await request.text()).toBe('request-body')
        return new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('a')); controller.enqueue(new TextEncoder().encode('b')); controller.close() } }))
      }) as typeof fetch,
    })
    const reader = response.body!.getReader()
    for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(new TextDecoder().decode(value)) }
    expect(chunks).toEqual(['a', 'b'])
  })
})
