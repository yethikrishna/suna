import { describe, expect, test } from 'bun:test'
import { createRelayAuthorization, RelayReplayGuard } from './relay-auth'
import { handleRelayHttpRequest, parseRelayHttpTarget } from './relay-server'

describe('compute-node relay HTTP server', () => {
  test('parses the node, port, path, and query without accepting malformed ports', () => {
    expect(parseRelayHttpTarget(new URL('https://api.test/v1/internal/node-relay/http/node%2Fa/8000/events?q=1'))).toEqual({ nodeId: 'node/a', port: 8000, path: '/events?q=1' })
    expect(parseRelayHttpTarget(new URL('https://api.test/v1/internal/node-relay/http/node/0/'))).toBeNull()
    expect(parseRelayHttpTarget(new URL('https://api.test/v1/internal/node-relay/http/node/8000'))).toBeNull()
  })

  test('verifies the caller and streams through the locally owned node socket', async () => {
    const target = '/v1/internal/node-relay/http/node-1/8000/events?q=1'
    const key = 'relay-key'
    let captured: Request | null = null
    const hub = { fetch: async (nodeId: string, port: number, request: Request) => {
      expect(nodeId).toBe('node-1')
      expect(port).toBe(8000)
      captured = request
      expect(await request.text()).toBe('payload')
      return new Response('streamed', { status: 206, headers: { 'x-upstream': 'yes' } })
    } } as any
    const headers = createRelayAuthorization({ key, method: 'POST', target, nonce: 'request-1' })
    headers.set('x-client', 'kept')
    const response = await handleRelayHttpRequest({ request: new Request(`https://api.test${target}`, { method: 'POST', headers, body: 'payload' }), hub, key, guard: new RelayReplayGuard() })
    expect(response?.status).toBe(206)
    expect(response?.headers.get('x-upstream')).toBe('yes')
    expect(await response?.text()).toBe('streamed')
    expect(captured!.headers.get('x-client')).toBe('kept')
    expect(captured!.headers.get('x-kortix-relay-signature')).toBeNull()
  })

  test('rejects an unsigned internal relay request before touching the node hub', async () => {
    let called = false
    const response = await handleRelayHttpRequest({ request: new Request('https://api.test/v1/internal/node-relay/http/node/8000/'), hub: { fetch: () => { called = true } } as any, key: 'key', guard: new RelayReplayGuard() })
    expect(response?.status).toBe(401)
    expect(called).toBe(false)
  })
})
