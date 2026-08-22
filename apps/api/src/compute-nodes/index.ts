import { eq } from 'drizzle-orm'
import { computeNodes, sessionSandboxes } from '@kortix/db'
import { validateNodeCredential } from '../repositories/compute-node-credentials'
import { db } from '../shared/db'
import { ComputeNodeChannelHub } from './channel'

export const computeNodeChannel = new ComputeNodeChannelHub(
  async (nodeId, token, info) => {
    const credential = await validateNodeCredential(token, nodeId)
    if (!credential) return null
    const [node] = await db
      .select()
      .from(computeNodes)
      .where(eq(computeNodes.nodeId, nodeId))
      .limit(1)
    if (!node || node.accountId !== credential.accountId) return null
    if (node.status === 'disabled' || node.status === 'draining' || node.status === 'deleted') return null
    await db.update(computeNodes).set({
      architecture: info.arch,
      operatingSystem: info.platform,
      daemonVersion: info.version,
      status: 'online',
      capabilities: info.capabilities,
      lastHeartbeatAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(computeNodes.nodeId, nodeId))
    return { nodeId, externalId: node.allocationId ?? undefined }
  },
  async (externalId) => {
    const [row] = await db
      .select({ nodeId: sessionSandboxes.sandboxId })
      .from(sessionSandboxes)
      .where(eq(sessionSandboxes.externalId, externalId))
      .limit(1)
    return row?.nodeId ?? null
  },
  async (nodeId, info) => {
    const [registered] = await db
      .select({ status: computeNodes.status })
      .from(computeNodes)
      .where(eq(computeNodes.nodeId, nodeId))
      .limit(1)
    if (!registered || registered.status === 'disabled' || registered.status === 'draining' || registered.status === 'deleted') return
    await db
      .update(computeNodes)
      .set({
        architecture: info.arch,
        operatingSystem: info.platform,
        daemonVersion: info.version,
        capabilities: info.capabilities,
        status: 'online',
        lastHeartbeatAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(computeNodes.nodeId, nodeId))
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
    const nodeId = computeNodeChannel.nodeIdForSocket(ws)
    computeNodeChannel.close(ws)
    if (nodeId) void db.update(computeNodes).set({ status: 'offline', updatedAt: new Date() }).where(eq(computeNodes.nodeId, nodeId))
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
