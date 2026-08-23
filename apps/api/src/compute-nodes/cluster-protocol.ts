import type { NodeAssignmentSpec } from '@kortix/api-contract/node-channel'
import type { ComputeNodeChannelHub } from './channel'

const LIVE_WINDOW_MS = 60_000

export function nodeRelayIsLive(row: { status: string; relayOwnerId?: string | null; relayOwnerHeartbeatAt?: Date | string | null }): boolean {
  if (row.status !== 'online' || !row.relayOwnerId || !row.relayOwnerHeartbeatAt) return false
  const time = row.relayOwnerHeartbeatAt instanceof Date ? row.relayOwnerHeartbeatAt.getTime() : Date.parse(row.relayOwnerHeartbeatAt)
  return Number.isFinite(time) && Date.now() - time <= LIVE_WINDOW_MS
}

export async function dispatchForwardedComputeNodeCall(
  hub: Pick<ComputeNodeChannelHub, 'rpc' | 'assign' | 'stopAssignment' | 'disconnectNode'>,
  row: { nodeId: string; method: string; params: Record<string, unknown>; expiresAt: Date },
): Promise<unknown> {
  const remaining = Math.max(1_000, row.expiresAt.getTime() - Date.now())
  if (row.method === '$assignment.apply') return hub.assign(row.nodeId, row.params.assignment as NodeAssignmentSpec, remaining)
  if (row.method === '$assignment.stop') {
    const id = row.params.assignment_id
    const reason = row.params.reason
    if (typeof id !== 'string' || !['stop', 'restart', 'release', 'drain'].includes(String(reason))) throw new Error('Invalid forwarded assignment stop')
    hub.stopAssignment(row.nodeId, id, reason as 'stop' | 'restart' | 'release' | 'drain')
    return { accepted: true }
  }
  if (row.method === '$node.disconnect') {
    const code = row.params.code
    const reason = row.params.reason
    if (!Number.isSafeInteger(code) || (code as number) < 1000 || (code as number) > 4999 || [1004, 1005, 1006, 1015].includes(code as number) || typeof reason !== 'string' || reason.length > 123 || /[\r\n]/.test(reason)) throw new Error('Invalid forwarded node disconnect')
    hub.disconnectNode(row.nodeId, code as number, reason)
    return { accepted: true }
  }
  return hub.rpc(row.nodeId, row.method, row.params, remaining)
}
