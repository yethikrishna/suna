/**
 * THE bounded rule for how long a sandbox lives.
 *
 * A sandbox carries `deadline_at`. The reaper stops any active box whose
 * deadline has passed. This module is the ONLY TypeScript that names that
 * column, and it offers exactly two operations:
 *
 *   extendSandboxDeadline  — a CONTROL-PLANE-OBSERVED turn start. Monotone and
 *                            capped: LEAST(active_since + CAP, GREATEST(...)).
 *   shortenSandboxDeadline — a SANDBOX-REPORTED turn end. LEAST only, so it is
 *                            structurally incapable of extending, which is why
 *                            the payload's provenance does not matter and it
 *                            can be best-effort and duplicated freely.
 *
 * THE INVARIANT: a sandbox-reported signal may only SHORTEN a sandbox's life.
 * Only a control-plane-observed event may EXTEND it, and only up to a bounded
 * ceiling.
 *
 * `active_since` is never assigned here, or anywhere else in TypeScript — a
 * BEFORE trigger owns it and makes it immutable while status='active'. That is
 * what makes the cap real rather than advisory: a CHECK on a difference whose
 * left operand a caller can slide forward is a suggestion, not a bound.
 *
 * All arithmetic is evaluated in Postgres against SQL `now()`, with grants
 * passed as INTERVALS rather than as computed instants. Two consequences:
 * API-pod clock skew leaves the money path entirely, and every write is one
 * monotone statement instead of a read-modify-write that concurrent callers
 * could lose.
 */

import { sql } from 'drizzle-orm';
import { config } from '../config';
import { db } from '../shared/db';
import { positiveEnvInt } from './reaper-constants';

/**
 * Absolute cap on ONE continuous running stretch, no matter how many turns it
 * contains and no matter what application bug exists. MIRRORS THE DB CHECK
 * (`session_sandboxes_deadline_within_cap`) — if you change this, change the
 * constraint in the same migration batch. At the cap the box stops; the next
 * prompt wakes it into a fresh, freshly-anchored stretch.
 */
export const ABSOLUTE_RUN_CAP_MS = 24 * 3_600_000;

/**
 * Granted on every OBSERVED turn start. THIS IS THE ONE NUMBER TO TIGHTEN.
 *
 * 4 hours is deliberately generous — a "ship the generous ceiling first" bet,
 * and the reason this change needs no shadow-mode observation harness:
 *   - it is well above the p99 turn, so a turn-start path we failed to
 *     instrument is very unlikely to kill work that is actually running;
 *   - it is 66x below the observed 264h worst case, so 11-day zombies become
 *     4-hour ones on day one;
 *   - it binds ONLY when `turn_end` never arrives — i.e. when opencode is
 *     wedged or its watcher died, which is precisely the population being
 *     targeted.
 *
 * KNOWN LIMIT, measured on 30 days of prod usage_events: the turn-length tail
 * is longer than this grant. Sessionised at a 5-minute LLM-silence gap, p99 is
 * ~78 min but the MAX is ~8.4h, and roughly 7-18 turns per 30 days exceed 4h.
 * A turn gets exactly ONE grant — nothing re-extends mid-turn, because extend
 * fires only on a turn-START POST — so a genuinely long turn CAN be stopped
 * under it. That tail is small and the alternative was 187 immortal boxes, but
 * it is a real false-kill risk, not zero. BEFORE TIGHTENING toward 60 min,
 * add a mid-turn extension driven by a signal the box cannot forge (usage_events
 * is the obvious one: it is written by the gateway, not the sandbox, so it
 * satisfies the invariant) — otherwise tightening makes this strictly worse.
 *
 * KILL SWITCH: set KORTIX_SANDBOX_TURN_GRANT_MINUTES=100000 and every extend
 * out-runs the cap, so the LEAST clamps at active_since + 24h and the feature
 * is effectively neutralised without a rollback.
 */
export function turnGrantMs(): number {
  return positiveEnvInt('KORTIX_SANDBOX_TURN_GRANT_MINUTES', 240) * 60_000;
}

/**
 * Granted on a sandbox-REPORTED turn end: "die after 15 minutes of inactivity".
 * Reuses KORTIX_SANDBOX_AUTOSTOP_MINUTES, which is ALREADY 15 in kortix-prod-env,
 * so production needs no config change to get this behaviour.
 */
export function idleGraceMs(): number {
  return Math.max(1, config.KORTIX_SANDBOX_AUTOSTOP_MINUTES || 15) * 60_000;
}

export type DeadlineTarget = { sandboxId: string } | { sessionId: string } | { externalId: string };

function targetPredicate(t: DeadlineTarget) {
  if ('sandboxId' in t) return sql`s.sandbox_id = ${t.sandboxId}::uuid`;
  if ('sessionId' in t) return sql`s.session_id = ${t.sessionId}`;
  return sql`s.external_id = ${t.externalId}`;
}

const secs = (ms: number) => Math.round(ms / 1000);

/**
 * CONTROL-PLANE-OBSERVED extension. Monotone (concurrent writers cannot lose an
 * extension) and clamped (the CHECK stays unreachable in normal operation,
 * which is the point: it exists to catch a FUTURE writer, so this must not
 * silently clamp below it either).
 *
 * Callers MUST gate this on the request not being sandbox-authored — the box
 * holds a credential that produces a perfectly valid principal for requests it
 * writes itself, and letting those through would rebuild the exact self-renewal
 * this design deletes. One line at each call site:
 *   if (c.get('apiKeyType') !== 'sandbox') void extendSandboxDeadline(...)
 */
export async function extendSandboxDeadline(
  target: DeadlineTarget,
  grantMs: number = turnGrantMs(),
): Promise<void> {
  await db.execute(sql`
    UPDATE kortix.session_sandboxes s
       SET deadline_at = LEAST(
             s.active_since + make_interval(secs => ${secs(ABSOLUTE_RUN_CAP_MS)}),
             GREATEST(s.deadline_at, now() + make_interval(secs => ${secs(grantMs)}))),
           updated_at = now()
     WHERE ${targetPredicate(target)} AND s.status IN ('active', 'provisioning')`);
}

/**
 * SANDBOX-REPORTED contraction. No GREATEST, no active_since, no cap: it cannot
 * extend anything, so it does not matter that the sandbox is the one saying it.
 */
export async function shortenSandboxDeadline(
  sessionId: string,
  graceMs: number = idleGraceMs(),
): Promise<void> {
  await db.execute(sql`
    UPDATE kortix.session_sandboxes s
       SET deadline_at = LEAST(s.deadline_at, now() + make_interval(secs => ${secs(graceMs)})),
           updated_at = now()
     WHERE s.session_id = ${sessionId} AND s.status = 'active'`);
}

/**
 * Did the SANDBOX ITSELF author this request? Such a request may never extend
 * the box's deadline — that is the self-renewal this design deletes.
 *
 * Two credentials reach the control plane from inside a box, and BOTH must be
 * caught:
 *   - `kortix_sb_…`, the sandbox token, which sets apiKeyType 'sandbox';
 *   - a SESSION-SCOPED PAT (`kortix_pat_…`, injected as KORTIX_CLI_TOKEN /
 *     KORTIX_EXECUTOR_TOKEN and used by the in-box `kortix` CLI), whose auth
 *     branch never sets apiKeyType at all.
 * Testing apiKeyType alone therefore lets the box renew itself forever with its
 * own CLI token. A non-null session binding is the reliable signal: every
 * non-session-bound auth branch resolves sessionId to null.
 *
 * Single definition on purpose — the path-based and subdomain proxy edges once
 * carried divergent copies, and the weaker one failed open.
 */
export function isSandboxAuthored(
  apiKeyType: string | undefined | null,
  sessionId: string | undefined | null,
): boolean {
  return apiKeyType === 'sandbox' || (sessionId ?? null) !== null;
}

/** opencode's own port, and the in-box agent that reverse-proxies to it. */
const OPENCODE_PORT = 4096;
const AGENT_PORT = 8000;

/**
 * `/command` and `/summarize` are here because both start a real, billable turn
 * — a classifier admitting only prompt_async/message would kill a box mid
 * command. Do NOT reuse `isLongTurnCompletionRequest` from
 * sandbox-proxy/preview-retry-budget.ts: it matches only `/message` (every real
 * client uses prompt_async), and widening it would change that module's proxy
 * attempt-timeout behaviour.
 */
const TURN_START = /^\/session\/[^/]+\/(?:prompt_async|message|command|summarize)(?:$|[/?#])/;
const ACP = /^\/kortix\/acp(?:$|[/?#])/;

/** Does this proxied request START a turn? Used by the proxy to observe a run
 *  beginning without trusting anything the sandbox says about itself. */
export function isTurnStartRequest(port: number, method: string, path: string): boolean {
  if (method.toUpperCase() !== 'POST') return false;
  if (port !== AGENT_PORT && port !== OPENCODE_PORT) return false;
  const p = path.replace(/^\/proxy\/\d+(?=\/)/, ''); // in-box dynamic-port nesting
  return TURN_START.test(p) || ACP.test(p);
}
