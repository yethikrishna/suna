import type { ComputeNodeChannelHub } from './channel'
import { RelayReplayGuard, RELAY_NONCE_HEADER, RELAY_SIGNATURE_HEADER, RELAY_TIMESTAMP_HEADER, verifyRelayAuthorization } from './relay-auth'

const PREFIX = '/v1/internal/node-relay/http/'
const HOP_HEADERS = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade', 'host', 'content-length'])
const INTERNAL_HEADERS = new Set([RELAY_NONCE_HEADER, RELAY_SIGNATURE_HEADER, RELAY_TIMESTAMP_HEADER])

export interface RelayHttpTarget { nodeId: string; port: number; path: string }

export function parseRelayHttpTarget(url: URL): RelayHttpTarget | null {
  if (!url.pathname.startsWith(PREFIX)) return null
  const remainder = url.pathname.slice(PREFIX.length)
  const first = remainder.indexOf('/')
  if (first <= 0) return null
  const second = remainder.indexOf('/', first + 1)
  if (second < 0) return null
  let nodeId: string
  try { nodeId = decodeURIComponent(remainder.slice(0, first)) } catch { return null }
  const portText = remainder.slice(first + 1, second)
  if (!/^[0-9]{1,5}$/.test(portText)) return null
  const port = Number(portText)
  if (port < 1 || port > 65_535 || !nodeId || nodeId.length > 255 || /[\r\n]/.test(nodeId)) return null
  return { nodeId, port, path: remainder.slice(second) + url.search }
}

function upstreamHeaders(source: Headers): Headers {
  const headers = new Headers()
  for (const [name, value] of source) if (!HOP_HEADERS.has(name.toLowerCase()) && !INTERNAL_HEADERS.has(name.toLowerCase())) headers.append(name, value)
  return headers
}

export async function handleRelayHttpRequest(input: { request: Request; hub: ComputeNodeChannelHub; key: string; guard: RelayReplayGuard }): Promise<Response | null> {
  const url = new URL(input.request.url)
  const target = parseRelayHttpTarget(url)
  if (!target) return null
  const auth = verifyRelayAuthorization({ key: input.key, method: input.request.method, target: url.pathname + url.search, headers: input.request.headers, guard: input.guard })
  if (!auth.ok) return Response.json({ error: 'Invalid compute-node relay authorization', reason: auth.reason }, { status: 401 })
  const hasBody = input.request.method !== 'GET' && input.request.method !== 'HEAD'
  try {
    return await input.hub.fetch(target.nodeId, target.port, new Request(`http://127.0.0.1:${target.port}${target.path}`, {
      method: input.request.method,
      headers: upstreamHeaders(input.request.headers),
      body: hasBody ? input.request.body : undefined,
      duplex: hasBody ? 'half' : undefined,
      signal: input.request.signal,
    } as RequestInit))
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 502 })
  }
}
