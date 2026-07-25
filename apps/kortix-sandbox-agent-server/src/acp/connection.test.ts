import { describe, expect, test } from 'bun:test'
import { PassThrough } from 'node:stream'

import {
  AcpConnection,
  AcpProtocolError,
  buildOpenCodeLaunch,
  parseJsonRpcEnvelope,
  redactAcpDiagnostic,
  resolveOpenCodeTransport,
} from './connection'

type Harness = ReturnType<typeof createHarness>

function createHarness(options: { requestTimeoutMs?: number; maxReplayEvents?: number } = {}) {
  const input = new PassThrough()
  const output = new PassThrough()
  const diagnostics: string[] = []
  const connection = new AcpConnection({
    input,
    output,
    requestTimeoutMs: options.requestTimeoutMs,
    maxReplayEvents: options.maxReplayEvents,
    onDiagnostic: (line) => diagnostics.push(line),
  })
  const writes: Record<string, unknown>[] = []
  let pending = ''
  input.on('data', (chunk) => {
    pending += chunk.toString()
    const lines = pending.split('\n')
    pending = lines.pop() ?? ''
    for (const line of lines) {
      if (line.trim()) writes.push(JSON.parse(line))
    }
  })
  return { connection, input, output, diagnostics, writes }
}

function respond(harness: Harness, envelope: Record<string, unknown>) {
  harness.output.write(`${JSON.stringify({ jsonrpc: '2.0', ...envelope })}\n`)
}

async function nextTick() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe('OpenCode ACP launch', () => {
  test('defaults to native ACP and keeps REST as an explicit rollback', () => {
    expect(resolveOpenCodeTransport({})).toBe('acp')
    expect(resolveOpenCodeTransport({ KORTIX_OPENCODE_TRANSPORT: 'acp' })).toBe('acp')
    expect(resolveOpenCodeTransport({ KORTIX_OPENCODE_TRANSPORT: 'rest' })).toBe('rest')
    expect(() =>
      resolveOpenCodeTransport({ KORTIX_OPENCODE_TRANSPORT: 'claude' }),
    ).toThrow("KORTIX_OPENCODE_TRANSPORT must be 'acp' or 'rest'")
  })

  test('starts one OpenCode ACP process with the existing internal HTTP port', () => {
    expect(buildOpenCodeLaunch('acp', 4096, '/workspace')).toEqual({
      args: [
        'acp',
        '--port',
        '4096',
        '--hostname',
        '127.0.0.1',
        '--cwd',
        '/workspace',
      ],
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    expect(buildOpenCodeLaunch('rest', 4096, '/workspace')).toEqual({
      args: ['serve', '--port', '4096', '--hostname', '127.0.0.1'],
      stdio: ['ignore', 'inherit', 'inherit'],
    })
  })
})

describe('ACP NDJSON connection', () => {
  test('validates JSON-RPC envelopes', () => {
    expect(parseJsonRpcEnvelope({ jsonrpc: '2.0', method: 'session/new' })).toEqual({
      jsonrpc: '2.0',
      method: 'session/new',
    })
    expect(() => parseJsonRpcEnvelope({ method: 'session/new' })).toThrow(
      'JSON-RPC 2.0',
    )
    expect(() => parseJsonRpcEnvelope({ jsonrpc: '2.0' })).toThrow(
      'request, notification, or response',
    )
  })

  test('initializes ACP v1 before the connection reports ready', async () => {
    const harness = createHarness()
    expect(harness.connection.ready).toBe(false)

    const initializing = harness.connection.initialize({
      clientInfo: { name: 'kortix', version: '1' },
    })
    await nextTick()

    expect(harness.writes).toEqual([
      {
        jsonrpc: '2.0',
        id: 'kortix:initialize',
        method: 'initialize',
        params: {
          protocolVersion: 1,
          clientCapabilities: {
            fs: { readTextFile: true, writeTextFile: true },
            terminal: true,
          },
          clientInfo: { name: 'kortix', version: '1' },
        },
      },
    ])

    respond(harness, {
      id: 'kortix:initialize',
      result: { protocolVersion: 1, agentInfo: { name: 'OpenCode' } },
    })
    await expect(initializing).resolves.toMatchObject({
      protocolVersion: 1,
      agentInfo: { name: 'OpenCode' },
    })
    expect(harness.connection.ready).toBe(true)
  })

  test('correlates concurrent responses by JSON-RPC id', async () => {
    const harness = createHarness()
    const first = harness.connection.request('session/load', { sessionId: 'a' }, 'a')
    const second = harness.connection.request('session/load', { sessionId: 'b' }, 'b')
    await nextTick()

    respond(harness, { id: 'b', result: { loaded: 'b' } })
    respond(harness, { id: 'a', result: { loaded: 'a' } })

    await expect(first).resolves.toEqual({ loaded: 'a' })
    await expect(second).resolves.toEqual({ loaded: 'b' })
  })

  test('replays only the bounded notification window', async () => {
    const harness = createHarness({ maxReplayEvents: 2 })
    respond(harness, { method: 'session/update', params: { index: 1 } })
    respond(harness, { method: 'session/update', params: { index: 2 } })
    respond(harness, { method: 'session/update', params: { index: 3 } })
    await nextTick()

    const replayed: number[] = []
    harness.connection.subscribe(0, (event) => replayed.push(event.id))
    expect(replayed).toEqual([2, 3])
  })

  test('rejects a request after the configured timeout', async () => {
    const harness = createHarness({ requestTimeoutMs: 10 })
    await expect(
      harness.connection.request('session/load', { sessionId: 'missing' }, 'timeout'),
    ).rejects.toBeInstanceOf(AcpProtocolError)
  })

  test('rejects pending requests and closes subscribers when the stream ends', async () => {
    const harness = createHarness()
    let closed = 0
    harness.connection.subscribe(0, () => {}, () => closed++)
    const pending = harness.connection.request(
      'session/load',
      { sessionId: 'a' },
      'close',
    )
    harness.output.end()

    await expect(pending).rejects.toThrow('ACP output closed')
    expect(closed).toBe(1)
  })

  test('does not emit response envelopes as stream notifications', async () => {
    const harness = createHarness()
    const events: unknown[] = []
    harness.connection.subscribe(0, (event) => events.push(event))
    const request = harness.connection.request('session/load', {}, 'response')
    respond(harness, { id: 'response', result: {} })
    await request
    expect(events).toEqual([])
  })

  test('preserves JSON-RPC errors across the HTTP bridge', async () => {
    const harness = createHarness()
    const posted = harness.connection.post({
      jsonrpc: '2.0',
      id: 'error',
      method: 'session/load',
      params: { sessionId: 'missing' },
    })
    respond(harness, {
      id: 'error',
      error: { code: -32000, message: 'session not found' },
    })

    await expect(posted).resolves.toEqual({
      jsonrpc: '2.0',
      id: 'error',
      error: { code: -32000, message: 'session not found' },
    })
  })

  test('redacts credential values from diagnostics', () => {
    expect(
      redactAcpDiagnostic('failed token-secret-123', {
        KORTIX_TOKEN: 'token-secret-123',
        HOME: '/workspace',
      }),
    ).toBe('failed [REDACTED]')
  })
})
