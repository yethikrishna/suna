import { createRelayAuthorization, RELAY_NONCE_HEADER, RELAY_SIGNATURE_HEADER, RELAY_TIMESTAMP_HEADER } from './relay-auth'

const HOP_HEADERS = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade', 'host', 'content-length'])
const INTERNAL_HEADERS = new Set([RELAY_NONCE_HEADER, RELAY_SIGNATURE_HEADER, RELAY_TIMESTAMP_HEADER])

export function computeNodeRelayTarget(baseUrl: string, nodeId: string, port: number, upstreamPath: string): URL {
  const base = new URL(baseUrl)
  const prefix = base.pathname.replace(/\/+$/, '').replace(/\/v1$/, '')
  const path = upstreamPath.startsWith('/') ? upstreamPath : `/${upstreamPath}`
  const queryAt = path.indexOf('?')
  const pathname = queryAt === -1 ? path : path.slice(0, queryAt)
  const search = queryAt === -1 ? '' : path.slice(queryAt)
  base.pathname = `${prefix}/v1/internal/node-relay/http/${encodeURIComponent(nodeId)}/${port}${pathname}`
  base.search = search
  base.hash = ''
  base.username = ''
  base.password = ''
  return base
}

function forwardedHeaders(source: Headers): Headers {
  const headers = new Headers()
  for (const [name, value] of source) if (!HOP_HEADERS.has(name.toLowerCase()) && !INTERNAL_HEADERS.has(name.toLowerCase())) headers.append(name, value)
  return headers
}

export async function fetchComputeNodeThroughRelay(input: {
  relayUrl: string
  key: string
  nodeId: string
  port: number
  request: Request
  fetchImpl?: typeof fetch
}): Promise<Response> {
  const upstream = new URL(input.request.url)
  const target = computeNodeRelayTarget(input.relayUrl, input.nodeId, input.port, upstream.pathname + upstream.search)
  const headers = forwardedHeaders(input.request.headers)
  const authorization = createRelayAuthorization({ key: input.key, method: input.request.method, target: target.pathname + target.search })
  for (const [name, value] of authorization) headers.set(name, value)
  const hasBody = input.request.method !== 'GET' && input.request.method !== 'HEAD'
  return (input.fetchImpl ?? fetch)(target, {
    method: input.request.method,
    headers,
    body: hasBody ? input.request.body : undefined,
    duplex: hasBody ? 'half' : undefined,
    signal: input.request.signal,
  } as RequestInit)
}
