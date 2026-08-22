import { eq } from 'drizzle-orm'
import { sessionSandboxes } from '@kortix/db'
import { validateSecretKey } from '../repositories/api-keys'
import { db } from '../shared/db'
import { ComputeNodeChannelHub } from './channel'

export const computeNodeChannel = new ComputeNodeChannelHub(async (nodeId, token) => {
  const credential = await validateSecretKey(token)
  if (!credential.isValid || credential.type !== 'sandbox' || credential.sandboxId !== nodeId) return null
  const [row] = await db
    .select({ externalId: sessionSandboxes.externalId, status: sessionSandboxes.status })
    .from(sessionSandboxes)
    .where(eq(sessionSandboxes.sandboxId, nodeId))
    .limit(1)
  if (!row?.externalId || row.status === 'archived' || row.status === 'error') return null
  return { nodeId, externalId: row.externalId }
})

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
