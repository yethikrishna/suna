import type { ComputeNodeChannelHub, ComputeNodeSocket, ComputeNodeSocketHandlers } from './channel'
import { createRelayAuthorization, RelayReplayGuard, verifyRelayAuthorization } from './relay-auth'

const PREFIX = '/v1/internal/node-relay/socket/'
const UPSTREAM_HEADERS = 'x-kortix-relay-upstream-headers'

export function computeNodeRelaySocketTarget(baseUrl: string, nodeId: string, port: number, path: string): URL {
  const base = new URL(baseUrl)
  base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:'
  const prefix = base.pathname.replace(/\/+$/, '').replace(/\/v1$/, '')
  const normalized = path.startsWith('/') ? path : `/${path}`
  const queryAt = normalized.indexOf('?')
  base.pathname = `${prefix}${PREFIX}${encodeURIComponent(nodeId)}/${port}${queryAt === -1 ? normalized : normalized.slice(0, queryAt)}`
  base.search = queryAt === -1 ? '' : normalized.slice(queryAt)
  base.hash = ''
  base.username = ''
  base.password = ''
  return base
}

function encodeHeaders(headers: Record<string, string>): string {
  const entries = Object.entries(headers)
  if (entries.length > 128 || entries.some(([name, value]) => !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name) || /[\r\n]/.test(value))) throw new Error('Invalid compute-node WebSocket headers')
  const encoded = Buffer.from(JSON.stringify(entries)).toString('base64url')
  if (encoded.length > 16_384) throw new Error('Compute-node WebSocket headers exceed relay limit')
  return encoded
}

function decodeHeaders(value: string | null): Record<string, string> | null {
  if (!value || value.length > 16_384 || !/^[A-Za-z0-9_-]+$/.test(value)) return null
  try {
    const entries = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown
    if (!Array.isArray(entries) || entries.length > 128 || !entries.every((entry) => Array.isArray(entry) && entry.length === 2 && typeof entry[0] === 'string' && /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(entry[0]) && typeof entry[1] === 'string' && !/[\r\n]/.test(entry[1]))) return null
    return Object.fromEntries(entries)
  } catch { return null }
}

export function parseRelaySocketTarget(url: URL): { nodeId: string; port: number; path: string } | null {
  if (!url.pathname.startsWith(PREFIX)) return null
  const remainder = url.pathname.slice(PREFIX.length)
  const first = remainder.indexOf('/')
  const second = first < 0 ? -1 : remainder.indexOf('/', first + 1)
  if (first <= 0 || second < 0) return null
  let nodeId: string
  try { nodeId = decodeURIComponent(remainder.slice(0, first)) } catch { return null }
  const portText = remainder.slice(first + 1, second)
  if (!/^[0-9]{1,5}$/.test(portText)) return null
  const port = Number(portText)
  if (!nodeId || nodeId.length > 255 || port < 1 || port > 65_535) return null
  return { nodeId, port, path: remainder.slice(second) + url.search }
}

export function prepareRelaySocketUpgrade(input: { request: Request; key: string; guard: RelayReplayGuard }): { ok: true; data: RelaySocketServerState } | { ok: false; status: number; message: string } {
  const url = new URL(input.request.url)
  const target = parseRelaySocketTarget(url)
  if (!target) return { ok: false, status: 400, message: 'Malformed compute-node relay socket target' }
  const auth = verifyRelayAuthorization({ key: input.key, method: 'GET', target: url.pathname + url.search, headers: input.request.headers, guard: input.guard })
  if (!auth.ok) return { ok: false, status: 401, message: 'Invalid compute-node relay authorization' }
  const headers = decodeHeaders(input.request.headers.get(UPSTREAM_HEADERS))
  if (!headers) return { ok: false, status: 400, message: 'Invalid compute-node upstream headers' }
  return { ok: true, data: { type: 'compute-node-relay-socket', ...target, headers, ready: false, queue: [] } }
}

interface ClientWebSocket {
  readyState: number
  binaryType: string
  send(data: string | Buffer | ArrayBuffer | Uint8Array): void
  close(code?: number, reason?: string): void
  addEventListener(type: string, listener: (event: any) => void): void
}

export function connectComputeNodeSocketThroughRelay(input: { relayUrl: string; key: string; nodeId: string; port: number; path: string; headers: Record<string, string>; handlers: ComputeNodeSocketHandlers; socketFactory?: (url: string, headers: Headers) => ClientWebSocket }): ComputeNodeSocket {
  const target = computeNodeRelaySocketTarget(input.relayUrl, input.nodeId, input.port, input.path)
  const headers = createRelayAuthorization({ key: input.key, method: 'GET', target: target.pathname + target.search })
  // Bun's WebSocket client sends no User-Agent by default. Cloudflare rejects
  // that handshake before it reaches the relay server, while localhost accepts
  // it. Keep this edge-compatible just like the node channel client.
  headers.set('user-agent', 'kortix-api/node-relay')
  headers.set(UPSTREAM_HEADERS, encodeHeaders(input.headers))
  const socket = (input.socketFactory ?? ((url, requestHeaders) => new WebSocket(url, { headers: Object.fromEntries(requestHeaders) } as any) as unknown as ClientWebSocket))(target.toString(), headers)
  socket.binaryType = 'arraybuffer'
  socket.addEventListener('open', () => input.handlers.open())
  socket.addEventListener('message', (event) => {
    if (typeof event.data === 'string') input.handlers.message(Buffer.from(event.data), false)
    else if (event.data instanceof ArrayBuffer) input.handlers.message(new Uint8Array(event.data), true)
    else if (ArrayBuffer.isView(event.data)) input.handlers.message(new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength), true)
  })
  socket.addEventListener('close', (event) => input.handlers.close(typeof event.code === 'number' ? event.code : 1011, typeof event.reason === 'string' ? event.reason : 'relay socket closed'))
  socket.addEventListener('error', () => { if (socket.readyState !== WebSocket.OPEN) input.handlers.close(1011, 'relay socket failed') })
  return { send: (data) => socket.send(data), close: (code, reason) => socket.close(code, reason) }
}

export interface RelaySocketServerState {
  type: 'compute-node-relay-socket'
  nodeId: string
  port: number
  path: string
  headers: Record<string, string>
  ready: boolean
  queue: Array<string | Buffer>
  upstream?: ComputeNodeSocket
}

interface RelayServerSocket { data: RelaySocketServerState; send(data: string | Buffer | Uint8Array): void; close(code?: number, reason?: string): void }

export function relaySocketHandlers(hub: ComputeNodeChannelHub) {
  return {
    open(ws: RelayServerSocket) {
      void hub.connectWebSocket(ws.data.nodeId, ws.data.port, ws.data.path, ws.data.headers, {
        open: () => {
          ws.data.ready = true
          for (const message of ws.data.queue.splice(0)) ws.data.upstream?.send(message)
        },
        message: (data, binary) => { try { ws.send(binary ? data : Buffer.from(data).toString('utf8')) } catch {} },
        close: (code, reason) => { try { ws.close(code, reason) } catch {} },
      }).then((upstream) => { ws.data.upstream = upstream }).catch(() => { try { ws.close(1011, 'compute node socket failed') } catch {} })
    },
    message(ws: RelayServerSocket, message: string | Buffer) {
      if (ws.data.ready && ws.data.upstream) ws.data.upstream.send(message)
      else ws.data.queue.push(message)
    },
    close(ws: RelayServerSocket, code = 1000, reason: string | Buffer = '') { try { ws.data.upstream?.close(code, typeof reason === 'string' ? reason : reason.toString('utf8')) } catch {} },
  }
}
