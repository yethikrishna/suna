/**
 * THE COMPUTE BILLING INVARIANT
 *
 *   `no compute row may stay open unless its sandbox is PROVABLY alive`
 *
 * Closing the meter used to be the responsibility of every individual stop path
 * — the reaper idle-stop, the reaper reconcile, the provider webhook, the
 * explicit user stop, session end/delete, the in-place restart, hibernate, the
 * error/teardown path, account deletion. Every one of them calls
 * `pauseComputeSession(...).catch(warn)` and then flips the sandbox row anyway,
 * so ONE transient failure at pause time strands that billing row forever, and
 * one caller passing the wrong id (session-lifecycle/actions.ts passed a
 * sessionId where a sandboxId was required) strands every row it touches.
 * Nothing ever re-checked. Measured live 2026-07-29: 17 open, still-accruing
 * compute rows whose own `session_sandboxes` row already said `stopped`/`error`
 * — 5,587 sandbox-hours, the worst two at 829h (34.5 days) each.
 *
 * The N-caller design is why this class of bug keeps regressing (2026-06-21,
 * 2026-07-07/#4228, 2026-07-29). So the fast paths stay as an optimisation, but
 * correctness rests on the two mechanisms here and in
 * billing/services/compute-liveness.ts, neither of which asks any caller to
 * remember anything:
 *
 *   1. SETTLEMENT IS EVIDENCE-BOUNDED. A window can never bill past the last
 *      control-plane observation of liveness plus the provider's own auto-stop
 *      ceiling, so a stranded row simply stops accruing on its own.
 *   2. THIS SWEEP re-derives, from scratch every pass, whether each open row
 *      still has a provably-alive sandbox, and closes the ones that do not.
 *
 * Adding a tenth `pauseComputeSession` call site is not how this gets fixed.
 */

import { eq, sql } from 'drizzle-orm';
import { sessionSandboxes } from '@kortix/db';
import { logger } from '../lib/logger';
import { db } from '../shared/db';
import { getProvider, type ProviderName, type SandboxStatus } from '../platform/providers';
import { pauseComputeSession } from '../billing/services/compute-metering';
import {
  billableWindowEnd,
  computeLivenessGraceMs,
  isBeyondLivenessCeiling,
  lastAliveAtOf,
  parseTimestamp,
} from '../billing/services/compute-liveness';
import {
  REAP_BATCH_SIZE,
  REAP_CONCURRENCY,
  computeMaxWindowMs,
  computeUnresolvedCeilingMs,
} from './reaper-constants';

export type ComputeCloseReason =
  | 'sandbox-row-missing'
  | 'sandbox-not-active'
  | 'runtime-start-failed'
  | 'beyond-liveness-ceiling'
  | 'provider-not-running'
  | 'unresolvable-past-ceiling'
  | 'window-past-max';

export interface ComputeCloseDecision {
  reason: ComputeCloseReason | null;
  /** Which of the provider round-trips this decision needed. DB-only rules
   *  resolve to false so the common leak costs zero provider calls. */
  needsProviderStatus: boolean;
}

/**
 * The single authority on whether an open compute window must be closed.
 *
 * Rule order is deliberate: every DB-only rule is evaluated FIRST, so the
 * dominant real-world leak (a sandbox row we already marked stopped) is caught
 * without a provider round-trip — which matters because in live prod 44 of 66
 * open rows answered `unknown` from the provider, i.e. `unknown` is the steady
 * state for a box that has been deleted out from under us, not a transient.
 *
 * `unknown` may justify not KILLING a box (we might fight a wake). It can never
 * justify continuing to CHARGE for one, so an unresolvable box stops billing
 * once it has been continuously unresolvable past the ceiling. And no window may
 * exceed `maxWindowMs` under any circumstances — that is the rule that makes a
 * 829-hour row impossible regardless of what anything else claims.
 *
 * Pure so the money semantics are exhaustively unit-tested.
 */
export function decideComputeClose(input: {
  sandboxStatus: string | null;
  hasProviderTarget: boolean;
  runtimeStartFailed: boolean;
  providerStatus: SandboxStatus | null;
  unresolvedForMs: number | null;
  openForMs: number;
  beyondLivenessCeiling: boolean;
  unresolvedCeilingMs: number;
  maxWindowMs: number;
}): ComputeCloseDecision {
  const db_ = (reason: ComputeCloseReason | null): ComputeCloseDecision => ({
    reason,
    needsProviderStatus: false,
  });
  // ── DB-only rules (no provider call) ──
  if (!input.sandboxStatus || !input.hasProviderTarget) return db_('sandbox-row-missing');
  if (input.sandboxStatus !== 'active' && input.sandboxStatus !== 'provisioning') {
    return db_('sandbox-not-active');
  }
  // The wake/provision never produced a running box: the meter was opened
  // optimistically by startComputeSession and the failure path left it open.
  // Billing a box that demonstrably failed to start is never correct.
  if (input.runtimeStartFailed) return db_('runtime-start-failed');
  // Past the evidence ceiling the window can never bill another second (the
  // clamp in settleComputeWindow already guarantees that), so the row is dead
  // weight — close it rather than re-examining it every pass forever.
  if (input.beyondLivenessCeiling) return db_('beyond-liveness-ceiling');
  if (input.openForMs >= input.maxWindowMs) return db_('window-past-max');

  // ── Provider-informed rules ──
  if (
    input.providerStatus === 'stopped' ||
    input.providerStatus === 'removed' ||
    input.providerStatus === 'terminal'
  ) {
    return { reason: 'provider-not-running', needsProviderStatus: true };
  }
  if (
    input.providerStatus !== 'running' &&
    input.unresolvedForMs !== null &&
    input.unresolvedForMs >= input.unresolvedCeilingMs
  ) {
    return { reason: 'unresolvable-past-ceiling', needsProviderStatus: true };
  }
  return { reason: null, needsProviderStatus: true };
}

/**
 * A wake/start that demonstrably failed. `resumeStoppedSandbox` stamps
 * `runtimeWakeStartedAt` before kicking the provider and `runtimeWakeFailedAt`
 * + `runtimeWakeError` when that start throws; a later successful wake clears
 * both. A failure stamp that is not older than the wake it belongs to means the
 * box never came up — observed in prod with the meter still accruing behind it.
 */
export function hasFailedRuntimeStart(metadata: Record<string, unknown> | null): boolean {
  const failedAt = typeof metadata?.runtimeWakeFailedAt === 'string' ? Date.parse(metadata.runtimeWakeFailedAt) : Number.NaN;
  if (!Number.isFinite(failedAt)) return false;
  const startedAt = typeof metadata?.runtimeWakeStartedAt === 'string' ? Date.parse(metadata.runtimeWakeStartedAt) : Number.NaN;
  return !Number.isFinite(startedAt) || failedAt >= startedAt;
}

/**
 * When the final billed window should END for each close reason — "bill only
 * time we can affirmatively evidence the box was alive" rather than wall-clock
 * up to whenever we happened to notice. `settleComputeWindow` clamps a window
 * end at/behind `last_billed_at` to a zero-cost settle, so an already-debited
 * amount is never re-charged and never auto-refunded (refunds stay a human
 * decision — see scripts/reimburse-compute-leak.ts).
 */
export function computeCloseWindowEnd(input: {
  reason: ComputeCloseReason;
  now: Date;
  startedAt: Date;
  sandboxUpdatedAt: Date | null;
  unresolvedSince: Date | null;
  runtimeWakeFailedAt: Date | null;
  lastAliveAt: Date;
  livenessGraceMs: number;
  maxWindowMs: number;
}): Date {
  const clamp = (d: Date | null): Date => {
    if (!d || Number.isNaN(d.getTime())) return input.now;
    if (d.getTime() < input.startedAt.getTime()) return input.startedAt;
    return d.getTime() > input.now.getTime() ? input.now : d;
  };
  const byReason = (): Date => {
    switch (input.reason) {
      // We recorded the stop when we flipped the sandbox row — bill to then, not
      // to the 34 days later that we noticed.
      case 'sandbox-not-active':
        return clamp(input.sandboxUpdatedAt);
      case 'runtime-start-failed':
        return clamp(input.runtimeWakeFailedAt);
      // The last moment the box was affirmatively resolvable.
      case 'unresolvable-past-ceiling':
        return clamp(input.unresolvedSince);
      case 'window-past-max':
        return clamp(new Date(input.startedAt.getTime() + input.maxWindowMs));
      default:
        return input.now;
    }
  };
  // Whatever the reason argues for, the evidence ceiling always wins: a box
  // cannot outlive its last observed liveness by more than the provider's own
  // auto-stop. This makes the close reason an optimisation rather than a
  // correctness requirement — get the reason wrong and the bill is still capped.
  return clamp(
    billableWindowEnd({
      requestedEnd: byReason(),
      lastAliveAt: input.lastAliveAt,
      graceMs: input.livenessGraceMs,
    }),
  );
}

export interface OrphanComputeResult {
  checked: number;
  closed: number;
  errors: number;
  byReason: Record<ComputeCloseReason, number>;
}

const EMPTY_REASON_COUNTS = (): Record<ComputeCloseReason, number> => ({
  'sandbox-row-missing': 0,
  'sandbox-not-active': 0,
  'runtime-start-failed': 0,
  'beyond-liveness-ceiling': 0,
  'provider-not-running': 0,
  'unresolvable-past-ceiling': 0,
  'window-past-max': 0,
});

function parseDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== 'string') return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms) : null;
}

/**
 * THE BILLING INVARIANT ENFORCER — the single authority that guarantees
 * "no compute row stays open unless its sandbox is provably alive".
 *
 * Every stop path in this codebase closes the meter best-effort
 * (`pauseComputeSession(...).catch(warn)`) and then flips the sandbox row
 * regardless, so any one of them failing — or passing the wrong id — strands a
 * billing row that then accrues wall-clock forever. This pass re-derives the
 * truth every cycle from scratch instead of trusting that N callers all did
 * their job, which is the only structure that has ever held.
 *
 * It runs the DB-only rules first, so the dominant leak costs zero provider
 * round-trips, and it settles each closed window to the last moment we can
 * affirmatively evidence the box was alive rather than to `now` (see
 * `computeCloseWindowEnd`). Oldest-open first, so a saturated batch drains the
 * worst leaks first and can never starve them. Deterministic; idempotent.
 */
export async function reconcileOrphanComputeSessions(now = new Date()): Promise<OrphanComputeResult> {
  const { sandboxComputeSessions } = await import('@kortix/db');
  const unresolvedCeilingMs = computeUnresolvedCeilingMs();
  const maxWindowMs = computeMaxWindowMs();

  // Join the metering row to its sandbox to recover provider + externalId.
  const rows = await db
    .select({
      computeId: sandboxComputeSessions.id,
      sandboxId: sandboxComputeSessions.sandboxId,
      startedAt: sandboxComputeSessions.startedAt,
      computeMetadata: sandboxComputeSessions.metadata,
      sbStatus: sessionSandboxes.status,
      sbUpdatedAt: sessionSandboxes.updatedAt,
      sbMetadata: sessionSandboxes.metadata,
      provider: sessionSandboxes.provider,
      externalId: sessionSandboxes.externalId,
    })
    .from(sandboxComputeSessions)
    .leftJoin(sessionSandboxes, eq(sessionSandboxes.sandboxId, sandboxComputeSessions.sandboxId))
    .where(eq(sandboxComputeSessions.state, 'active'))
    // Oldest-open first: the longest-running leak is the most expensive one, and
    // an unordered LIMIT is how a 34-day-old row stayed invisible for 34 days.
    .orderBy(sql`${sandboxComputeSessions.startedAt} asc`)
    .limit(REAP_BATCH_SIZE);

  const result: OrphanComputeResult = {
    checked: rows.length,
    closed: 0,
    errors: 0,
    byReason: EMPTY_REASON_COUNTS(),
  };
  let cursor = 0;
  const worker = async () => {
    while (cursor < rows.length) {
      const row = rows[cursor++];
      try {
        const startedAt = parseDate(row.startedAt) ?? now;
        const openForMs = Math.max(0, now.getTime() - startedAt.getTime());
        const sbMetadata = (row.sbMetadata ?? null) as Record<string, unknown> | null;
        const computeMetadata = (row.computeMetadata ?? {}) as Record<string, unknown>;
        const unresolvedSince = parseDate(computeMetadata.unresolvedSince);
        const lastAliveAt = lastAliveAtOf({ metadata: computeMetadata, startedAt: row.startedAt });
        const livenessGraceMs = computeLivenessGraceMs();

        const base = {
          sandboxStatus: (row.sbStatus as string | null) ?? null,
          hasProviderTarget: !!row.externalId && !!row.provider,
          runtimeStartFailed: hasFailedRuntimeStart(sbMetadata),
          beyondLivenessCeiling: isBeyondLivenessCeiling({ now, lastAliveAt, graceMs: livenessGraceMs }),
          openForMs,
          unresolvedCeilingMs,
          maxWindowMs,
        };

        // Probe the DB-only rules first: `providerStatus: 'running'` and
        // `unresolvedForMs: null` make every provider-informed rule inert, so a
        // non-null reason here is one we reached without any provider call.
        let decision = decideComputeClose({
          ...base,
          providerStatus: 'running',
          unresolvedForMs: null,
        });

        let providerStatus: SandboxStatus | null = null;
        if (!decision.reason && decision.needsProviderStatus) {
          providerStatus = await getProvider(row.provider as ProviderName)
            .getStatus(row.externalId as string)
            .catch(() => null);
          // 'unknown' is the STEADY state for a box deleted out from under us
          // (44 of 66 open prod rows answered unknown), so track how long it has
          // been continuously unresolvable rather than treating it as transient.
          if (providerStatus === 'running') {
            if (unresolvedSince) {
              await updateComputeSessionMetadata(row.computeId, { ...computeMetadata, unresolvedSince: null });
            }
          } else if (providerStatus !== 'stopped' && providerStatus !== 'removed' && !unresolvedSince) {
            await updateComputeSessionMetadata(row.computeId, {
              ...computeMetadata,
              unresolvedSince: now.toISOString(),
            });
          }
          decision = decideComputeClose({
            ...base,
            providerStatus,
            unresolvedForMs: unresolvedSince ? now.getTime() - unresolvedSince.getTime() : null,
          });
        }

        if (!decision.reason) continue;

        const windowEnd = computeCloseWindowEnd({
          reason: decision.reason,
          now,
          startedAt,
          sandboxUpdatedAt: parseDate(row.sbUpdatedAt),
          unresolvedSince,
          runtimeWakeFailedAt: parseDate(sbMetadata?.runtimeWakeFailedAt),
          lastAliveAt,
          livenessGraceMs,
          maxWindowMs,
        });
        await pauseComputeSession(row.sandboxId, windowEnd);
        result.closed += 1;
        result.byReason[decision.reason] += 1;
        logger.warn('[reaper] closed a compute window whose box was not provably alive', {
          sandbox_id: row.sandboxId,
          reason: decision.reason,
          open_for_hours: Number((openForMs / 3_600_000).toFixed(2)),
          billed_through: windowEnd.toISOString(),
          sandbox_status: row.sbStatus ?? null,
          provider_status: providerStatus,
        });
      } catch (err) {
        result.errors += 1;
        console.warn(`[reaper] orphan-compute reconcile failed for ${row.sandboxId}:`, err instanceof Error ? err.message : err);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(REAP_CONCURRENCY, rows.length) }, worker));
  return result;
}

async function updateComputeSessionMetadata(
  computeId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const { sandboxComputeSessions } = await import('@kortix/db');
  await db
    .update(sandboxComputeSessions)
    .set({ metadata })
    .where(eq(sandboxComputeSessions.id, computeId))
    .catch((err) =>
      console.warn('[reaper] compute metadata update failed:', err instanceof Error ? err.message : err),
    );
}

