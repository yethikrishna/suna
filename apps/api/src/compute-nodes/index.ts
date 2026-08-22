import { and, eq } from 'drizzle-orm'
import { computeNodeAssignments, computeNodes, sessionSandboxes } from '@kortix/db'
import { validateNodeCredential } from '../repositories/compute-node-credentials'
import { db } from '../shared/db'
import { ComputeNodeChannelHub } from './channel'
import { assignComputeNodeAcrossCluster, disconnectComputeNodeAcrossCluster, relayOwnerPatch, rpcComputeNodeAcrossCluster, stopComputeNodeAssignmentAcrossCluster } from './cluster-forwarder'
import { config } from '../config'
import { fetchComputeNodeThroughRelay } from './relay-client'
import { connectComputeNodeSocketThroughRelay } from './relay-socket'

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
      ...relayOwnerPatch(),
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
        ...relayOwnerPatch(),
        updatedAt: new Date(),
      })
      .where(eq(computeNodes.nodeId, nodeId))
  },
  async (nodeId, assignmentId, state, detail) => {
    const status = state === 'ready' ? 'ready' : state === 'rejected' ? 'failed' : state === 'stopped' ? 'released' : 'assigned'
    await db.update(computeNodeAssignments).set({
      status,
      updatedAt: new Date(),
      ...(detail ? { metadata: { detail } } : {}),
    }).where(and(eq(computeNodeAssignments.assignmentId, assignmentId), eq(computeNodeAssignments.nodeId, nodeId)))
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
    if (nodeId && !computeNodeChannel.isConnected(nodeId)) void db.update(computeNodes).set({ status: 'offline', relayOwnerId: null, relayOwnerInstance: null, relayOwnerStartedAt: null, relayOwnerHeartbeatAt: null, updatedAt: new Date() }).where(and(eq(computeNodes.nodeId, nodeId), eq(computeNodes.relayOwnerId, (relayOwnerPatch().relayOwnerId))))
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
  const request = new Request(url, init)
  return resolveComputeNodeId(externalId).then((nodeId) => {
    if (!nodeId) throw new Error(`Compute node for ${externalId} is not registered`)
    return fetchComputeNodeRequest(nodeId, port, request)
  })
}

export function fetchComputeNodeById(
  nodeId: string,
  port: number,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = `http://127.0.0.1:${port}${path.startsWith('/') ? path : `/${path}`}`
  return fetchComputeNodeRequest(nodeId, port, new Request(url, init))
}

async function resolveComputeNodeId(externalId: string): Promise<string | null> {
  const [row] = await db.select({ nodeId: sessionSandboxes.sandboxId }).from(sessionSandboxes).where(eq(sessionSandboxes.externalId, externalId)).limit(1)
  return row?.nodeId ?? null
}

function fetchComputeNodeRequest(nodeId: string, port: number, request: Request): Promise<Response> {
  if (computeNodeChannel.isConnected(nodeId)) return computeNodeChannel.fetch(nodeId, port, request)
  if (!config.KORTIX_NODE_RELAY_URL) return Promise.reject(new Error(`Compute node ${nodeId} is not connected and KORTIX_NODE_RELAY_URL is not configured`))
  return fetchComputeNodeThroughRelay({ relayUrl: config.KORTIX_NODE_RELAY_URL, key: config.INTERNAL_SERVICE_KEY, nodeId, port, request })
}

/** Open one loopback WebSocket through the sole outbound kortixd channel. */
export function connectComputeNodeWebSocket(
  externalId: string,
  port: number,
  path: string,
  headers: Record<string, string>,
  handlers: { open(): void; message(data: Uint8Array, binary: boolean): void; close(code: number, reason: string): void },
) {
  return resolveComputeNodeId(externalId).then((nodeId) => {
    if (!nodeId) throw new Error(`Compute node for ${externalId} is not registered`)
    if (computeNodeChannel.isConnected(nodeId)) return computeNodeChannel.connectWebSocket(nodeId, port, path, headers, handlers)
    if (!config.KORTIX_NODE_RELAY_URL) throw new Error(`Compute node ${nodeId} is not connected and KORTIX_NODE_RELAY_URL is not configured`)
    return connectComputeNodeSocketThroughRelay({ relayUrl: config.KORTIX_NODE_RELAY_URL, key: config.INTERNAL_SERVICE_KEY, nodeId, port, path, headers, handlers })
  })
}

export function rpcComputeNode(
  nodeId: string,
  method: string,
  params: Record<string, unknown>,
  timeoutMs?: number,
) {
  return rpcComputeNodeAcrossCluster(computeNodeChannel, nodeId, method, params, timeoutMs)
}

export function assignComputeNode(nodeId: string, assignment: import('@kortix/api-contract/node-channel').NodeAssignmentSpec, timeoutMs?: number) {
  return assignComputeNodeAcrossCluster(computeNodeChannel, nodeId, assignment, timeoutMs)
}

export function stopComputeNodeAssignment(nodeId: string, assignmentId: string, reason: 'stop' | 'restart' | 'release' | 'drain') {
  return stopComputeNodeAssignmentAcrossCluster(computeNodeChannel, nodeId, assignmentId, reason)
}

export function disconnectComputeNode(nodeId: string, code: number, reason: string) {
  return disconnectComputeNodeAcrossCluster(computeNodeChannel, nodeId, code, reason)
}
