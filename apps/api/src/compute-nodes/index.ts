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
