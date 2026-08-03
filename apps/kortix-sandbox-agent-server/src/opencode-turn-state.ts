import { readFileSync } from 'node:fs'

import { logger } from './logger'

/**
 * Is opencode mid-turn, and did a turn get orphaned?
 *
 * Both questions have the same answer source — the root's last message — and two
 * callers that must not drift: the post-respawn cleanup (which aborts a turn
 * whose process died) and the reload gate (which refuses to restart opencode out
 * from under a turn that is still running).
 *
 * "In flight" is `last message is an assistant message with no completion time`.
 * That is the same test boot has always used to decide whether an adopted root
 * needs its turn finalized; it is true both for a turn that is genuinely running
 * and for one whose writer died. Distinguishing them is the caller's job:
 * post-respawn, the writer is by definition gone.
 */
export const OPENCODE_SESSION_PIN_PATH = '/var/run/kortix/opencode-session-id'

/** The canonical opencode root, or null when nothing is pinned yet. */
export function readPinnedSessionId(): string | null {
  try {
    const id = readFileSync(OPENCODE_SESSION_PIN_PATH, 'utf8').trim()
    return id.length > 0 ? id : null
  } catch {
    return null
  }
}

export interface RootInspection {
  /** The root has messages — a prompt was delivered. */
  hasMessages: boolean
  /** Its last message is an assistant turn with no completion time. */
  lastTurnIncomplete: boolean
}

export async function inspectOpencodeRoot(
  baseUrl: string,
  workspace: string,
  sessionId: string,
): Promise<RootInspection> {
  const empty = { hasMessages: false, lastTurnIncomplete: false }
  try {
    const res = await fetch(
      `${baseUrl}/session/${encodeURIComponent(sessionId)}/message?directory=${encodeURIComponent(workspace)}`,
      { signal: AbortSignal.timeout(5_000) },
    )
    if (!res.ok) return empty
    const msgs = (await res.json()) as Array<{
      info?: { role?: string; time?: { completed?: number } }
    }>
    if (!Array.isArray(msgs) || msgs.length === 0) return empty
    const last = msgs[msgs.length - 1]
    return {
      hasMessages: true,
      lastTurnIncomplete: Boolean(last?.info?.role === 'assistant' && !last?.info?.time?.completed),
    }
  } catch {
    return empty
  }
}

/**
 * Best-effort "a turn is running right now", for the reload gate.
 *
 * Unknown reads as NOT in flight. The alternative — refusing every reload
 * whenever opencode is briefly unreachable — would break the feature in exactly
 * the situations people reach for it, and the caller offers `force` for the case
 * where the turn is what they are trying to escape.
 */
export async function opencodeTurnInFlight(baseUrl: string, workspace: string): Promise<boolean> {
  const sessionId = readPinnedSessionId()
  if (!sessionId) return false
  try {
    return (await inspectOpencodeRoot(baseUrl, workspace, sessionId)).lastTurnIncomplete
  } catch (err) {
    logger.warn('[turn-state] could not read turn state', { err: (err as Error).message })
    return false
  }
}
