import { eq } from 'drizzle-orm'
import { sessionSandboxes } from '@kortix/db'
import { validateSecretKey } from '../repositories/api-keys'
import { db } from '../shared/db'
import { ComputeNodeChannelHub } from './channel'

export const computeNodeChannel = new ComputeNodeChannelHub(
  async (nodeId, token) => {
    const credential = await validateSecretKey(token)
    if (!credential.isValid || credential.type !== 'sandbox' || credential.sandboxId !== nodeId) return null
    const [row] = await db
      .select({ externalId: sessionSandboxes.externalId, status: sessionSandboxes.status })
      .from(sessionSandboxes)
      .where(eq(sessionSandboxes.sandboxId, nodeId))
      .limit(1)
    if (!row || row.status === 'archived' || row.status === 'error') return null
    return { nodeId, externalId: row.externalId ?? undefined }
  },
  async (externalId) => {
    const [row] = await db
      .select({ nodeId: sessionSandboxes.sandboxId })
      .from(sessionSandboxes)
      .where(eq(sessionSandboxes.externalId, externalId))
      .limit(1)
    return row?.nodeId ?? null
  },
)

export const computeNodeWsHandlers = {
  open(ws: { send(value: string): void; close(code?: number, reason?: string): void }) {
    computeNodeChannel.open(ws)
  },
  message(ws: { send(value: string): void; close(code?: number, reason?: string): void }, message: string | Buffer) {
    void computeNodeChannel.message(ws, message)
  },
  close(ws: { send(value: string): void; close(code?: number, reason?: string): void }) {
    computeNodeChannel.close(ws)
  },
}

/** Send one HTTP request through the sole outbound kortixd channel. */
export function fetchComputeNode(
  externalId: string,
  port: number,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = `http://127.0.0.1:${port}${path.startsWith('/') ? path : `/${path}`}`
  return computeNodeChannel.fetchByExternalId(externalId, port, new Request(url, init))
}

export function fetchComputeNodeById(
  nodeId: string,
  port: number,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = `http://127.0.0.1:${port}${path.startsWith('/') ? path : `/${path}`}`
  return computeNodeChannel.fetch(nodeId, port, new Request(url, init))
}

/** Open one loopback WebSocket through the sole outbound kortixd channel. */
export function connectComputeNodeWebSocket(
  externalId: string,
  port: number,
  path: string,
  headers: Record<string, string>,
  handlers: { open(): void; message(data: Uint8Array, binary: boolean): void; close(code: number, reason: string): void },
) {
  return computeNodeChannel.connectWebSocketByExternalId(externalId, port, path, headers, handlers)
}

export function rpcComputeNode(
  nodeId: string,
  method: string,
  params: Record<string, unknown>,
  timeoutMs?: number,
) {
  return computeNodeChannel.rpc(nodeId, method, params, timeoutMs)
}
