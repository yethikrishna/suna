/**
 * Every DB read/write the box reaper's decision loop needs, in one place.
 *
 * Split out from box-reaper.ts so the loop reads as a decision (deadline
 * expired → stop) rather than as a pile of query builders.
 *
 * This file used to also load `usage_events` (a fallback activity clock),
 * `accounts` (the orphan-account bypass) and `project_sessions` (the warm-pool
 * exemption) on every pass. All three existed to reconstruct "is this box still
 * wanted?" from side evidence, because the direct answer lived nowhere. It now
 * lives in `session_sandboxes.deadline_at`, so the candidate query is a single
 * table again.
 */

import { sessionSandboxes } from '@kortix/db';
import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import type { ProviderName } from '../../platform/providers';
import { db } from '../../shared/db';
import { reapBatchSize } from '../reaper-constants';
import { mergeMetadata } from './sandbox-state-sync';

export interface ReapCandidate {
  sandboxId: string;
  sessionId: string;
  accountId: string;
  provider: ProviderName;
  externalId: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

/** Rows the sweep is allowed to examine: our own `active` rows with a box behind them. */
export function reapCandidatePredicate() {
  return and(eq(sessionSandboxes.status, 'active'), isNotNull(sessionSandboxes.externalId));
}

/**
 * One batch of candidates, least-recently-visited first.
 *
 * ROTATION, NOT STARVATION: the candidate set is capped at REAP_BATCH_SIZE so a
 * pass can't stampede the provider, but before 2026-07-29 the query had no
 * ORDER BY — Postgres returned an arbitrary 100 of 279 matching prod rows, so
 * ~179 rows were structurally unreachable by the reaper FOREVER while
 * `tickRunningComputeCharges` kept settling their full wall-clock delta. The
 * ORDER BY below makes the cap a rotation instead.
 */
export async function selectReapCandidates(
  predicate: ReturnType<typeof reapCandidatePredicate>,
): Promise<ReapCandidate[]> {
  return (await db
    .select({
      sandboxId: sessionSandboxes.sandboxId,
      sessionId: sessionSandboxes.sessionId,
      accountId: sessionSandboxes.accountId,
      provider: sessionSandboxes.provider,
      externalId: sessionSandboxes.externalId,
      metadata: sessionSandboxes.metadata,
      createdAt: sessionSandboxes.createdAt,
    })
    .from(sessionSandboxes)
    .where(predicate)
    // Least-recently-visited first, so the sweep rotates rather than starving.
    // `reaperVisitedAt` is always written by `toISOString()`, so lexicographic
    // text order IS chronological order — no cast, so a hand-edited value can
    // never make the whole sweep throw.
    .orderBy(sql`${sessionSandboxes.metadata}->>'reaperVisitedAt' asc nulls first`)
    .limit(reapBatchSize())) as ReapCandidate[];
}

/**
 * Total rows matching the candidate predicate, so a saturated batch is visible
 * (`deferred`) instead of silent. Degrades to the batch size on failure —
 * observability must never be able to break the sweep itself.
 */
export async function countReapCandidates(
  predicate: ReturnType<typeof reapCandidatePredicate>,
  fallback: number,
): Promise<number> {
  try {
    const [row] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(sessionSandboxes)
      .where(predicate);
    const total = Number(row?.total);
    return Number.isFinite(total) ? total : fallback;
  } catch (err) {
    console.warn('[reaper] candidate count failed:', err instanceof Error ? err.message : err);
    return fallback;
  }
}

/**
 * Stamp the rotation cursor for a whole batch in one statement. Stamped for
 * EVERY row the pass examined — a row it deliberately left alone (deadline not
 * yet reached, provider-unknown) must still go to the back of the queue,
 * otherwise it re-wins the batch every pass and the rows behind it never get
 * looked at. That silent re-selection IS the starvation bug; one batched UPDATE
 * per pass is what makes coverage a property of the query instead of luck.
 */
export async function markReaperVisited(sandboxIds: string[], now: Date): Promise<void> {
  if (sandboxIds.length === 0) return;
  await db
    .update(sessionSandboxes)
    .set({ metadata: mergeMetadata({ reaperVisitedAt: now.toISOString() }) })
    .where(inArray(sessionSandboxes.sandboxId, sandboxIds))
    .catch((err) =>
      console.warn('[reaper] visit stamp failed:', err instanceof Error ? err.message : err),
    );
}
