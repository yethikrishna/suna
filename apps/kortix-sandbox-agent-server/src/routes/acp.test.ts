import { describe, expect, test } from 'bun:test'
import { createHmac } from 'node:crypto'

import type { AcpConnection, AcpStreamEvent, JsonRpcEnvelope } from '../acp/connection'
import type { Config } from '../config'
import { KORTIX_USER_CONTEXT_HEADER } from '../kortix-user-context'
import { createAcpRouter } from './acp'

const TOKEN = 'test-kortix-token-32-chars-1234567890'

function config(sandboxToken: string | null = TOKEN): Config {
  return {
    servicePort: 8000,
    opencodeInternalPort: 4096,
    staticPort: 3211,
    workspace: '/workspace',
    projectTarget: '/workspace',
    defaultBranch: 'main',
    branchFetchAttempts: 60,
    branchFetchDelaySec: 0.25,
    defaultOpencodeConfigDir: '/ephemeral/opencode',
    autoClone: false,
    projectId: 'project',
    apiUrl: undefined,
    repoUrl: undefined,
    branchName: undefined,
    sessionFresh: false,
    baseSha: undefined,
    sandboxToken: sandboxToken ?? undefined,
    gitUserName: 'Kortix Agent',
    gitUserEmail: 'agent@kortix.ai',
    cloneFilter: '',
  }
}

function base64url(value: Buffer): string {
  return value
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function signedContext(secret = TOKEN): string {
  const now = Math.floor(Date.now() / 1000)
  const payload = base64url(
    Buffer.from(
      JSON.stringify({
        userId: 'user',
        sandboxId: 'sandbox',
        sandboxRole: 'owner',
        scopes: [],
        iat: now,
        exp: now + 60,
      }),
    ),
  )
  const signature = base64url(
    createHmac('sha256', secret).update(payload).digest(),
  )
  return `${payload}.${signature}`
}

function connection(overrides: {
  ready?: boolean
  post?: (envelope: JsonRpcEnvelope) => Promise<JsonRpcEnvelope | null>
  subscribe?: (
    after: number,
    event: (value: AcpStreamEvent) => void,
    close?: () => void,
  ) => () => void
} = {}): AcpConnection {
  return {
    ready: overrides.ready ?? true,
    post:
      overrides.post ??
      (async (envelope) => ({
        jsonrpc: '2.0',
        id: envelope.id,
        result: { ok: true },
      })),
    subscribe:
      overrides.subscribe ??
      ((_after, _event, _close) => {
        return () => {}
      }),
  } as unknown as AcpConnection
}

function request(
  app: ReturnType<typeof createAcpRouter>,
  path: string,
  init: RequestInit = {},
) {
  const headers = new Headers(init.headers)
  headers.set(KORTIX_USER_CONTEXT_HEADER, signedContext())
  return app.request(`http://localhost${path}`, { ...init, headers })
}

describe('authenticated OpenCode ACP bridge', () => {
  test('rejects missing and invalid sandbox user context', async () => {
    const app = createAcpRouter(config(), () => connection())

    const missing = await app.request('http://localhost/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' }),
    })
    expect(missing.status).toBe(401)

    const invalid = await app.request('http://localhost/session', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [KORTIX_USER_CONTEXT_HEADER]: 'invalid',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' }),
    })
    expect(invalid.status).toBe(401)
  })

  test('fails closed when the sandbox token is missing', async () => {
    const app = createAcpRouter(config(null), () => connection())
    const response = await app.request('http://localhost/session')
    expect(response.status).toBe(503)
  })

  test('returns 503 until the initialized ACP connection is ready', async () => {
    const app = createAcpRouter(config(), () => connection({ ready: false }))
    const response = await request(app, '/session')
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'OpenCode ACP not ready' })
  })

  test('posts one JSON-RPC request and returns its response', async () => {
    const seen: JsonRpcEnvelope[] = []
    const app = createAcpRouter(
      config(),
      () =>
        connection({
          post: async (envelope) => {
            seen.push(envelope)
            return {
              jsonrpc: '2.0',
              id: envelope.id,
              result: { sessionId: 'open-code-session' },
            }
          },
        }),
    )

    const response = await request(app, '/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'session/load',
        params: { sessionId: 'open-code-session' },
      }),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: { sessionId: 'open-code-session' },
    })
    expect(seen).toHaveLength(1)
  })

  test('returns 202 for JSON-RPC notifications and responses', async () => {
    const app = createAcpRouter(
      config(),
      () => connection({ post: async () => null }),
    )
    const response = await request(app, '/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'session/cancel',
        params: { sessionId: 'session' },
      }),
    })
    expect(response.status).toBe(202)
  })

  test('rejects unsupported media types and malformed JSON-RPC', async () => {
    const app = createAcpRouter(config(), () => connection())
    const media = await request(app, '/session', {
      method: 'POST',
      body: '{}',
    })
    expect(media.status).toBe(415)

    const malformed = await request(app, '/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ method: 'session/load' }),
    })
    expect(malformed.status).toBe(400)
  })

  test('replays SSE from Last-Event-ID and sends an immediate header frame', async () => {
    let after = -1
    const app = createAcpRouter(
      config(),
      () =>
        connection({
          subscribe: (lastEventId, event, close = () => {}) => {
            after = lastEventId
            event({
              id: 8,
              envelope: {
                jsonrpc: '2.0',
                method: 'session/update',
                params: { value: 'replayed' },
              },
            })
            queueMicrotask(close)
            return () => {}
          },
        }),
    )

    const response = await request(app, '/session', {
      headers: {
        accept: 'text/event-stream',
        'last-event-id': '7',
      },
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/event-stream')
    expect(await response.text()).toContain(
      'id: 8\ndata: {"jsonrpc":"2.0","method":"session/update","params":{"value":"replayed"}}',
    )
    expect(after).toBe(7)
  })

  test('rejects an invalid Last-Event-ID', async () => {
    const app = createAcpRouter(config(), () => connection())
    const response = await request(app, '/session', {
      headers: {
        accept: 'text/event-stream',
        'last-event-id': '-1',
      },
    })
    expect(response.status).toBe(400)
  })
})
