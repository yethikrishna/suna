/**
 * Syncing OUR rows to the provider's real state, keyed by external id.
 *
 * These are the deterministic billing-close paths shared by the provider
 * webhook ingress (the fast path, closing billing the instant a provider says a
 * box stopped) and the reaper sweep (the backstop that runs even when an event
 * is dropped). Idempotent by construction: a row already stopped/archived is a
 * no-op, so the two paths can race freely.
 */

import { eq, sql } from 'drizzle-orm';
import { projectSessions, sessionSandboxes } from '@kortix/db';
import { db } from '../../shared/db';
import { invalidateProviderCache } from '../../sandbox-proxy';
import { pauseComputeSession } from '../../billing/services/compute-metering';
import { revokeSessionExecutorTokens } from '../../repositories/account-tokens';
import { preserveEstablishedRuntime } from '../runtime-identity';
import { buildIdleStopMetadata } from './policy';

/** Merge keys into a jsonb metadata column without clobbering siblings. */
export function mergeMetadata(patch: Record<string, unknown>) {
  return sql`coalesce(${sessionSandboxes.metadata}, '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb`;
}

export async function reconcileRowToStopped(
  row: { sandboxId: string; sessionId: string; externalId: string },
  now: Date,
  quiesce: boolean,
): Promise<void> {
  // Close billing FIRST (computes the wall-clock delta against the still-active
  // metering row), then flip status, so the final window is billed correctly.
  await pauseComputeSession(row.sandboxId).catch((err) =>
    console.warn(`[reaper] pauseComputeSession failed for ${row.sandboxId}:`, err instanceof Error ? err.message : err),
  );
  const meta = buildIdleStopMetadata({ quiesce, nowIso: now.toISOString() });
  await db
    .update(sessionSandboxes)
    .set({
      status: 'stopped',
      updatedAt: now,
      ...(Object.keys(meta).length ? { metadata: mergeMetadata(meta) } : {}),
    })
    .where(eq(sessionSandboxes.sandboxId, row.sandboxId));
  await db
    .update(projectSessions)
    .set({ status: 'stopped', updatedAt: now })
    .where(eq(projectSessions.sessionId, row.sessionId));
  invalidateProviderCache(row.externalId);
}

/**
 * Close billing + reconcile a sandbox the PROVIDER reports stopped/archived,
 * keyed by external id. Returns true if it transitioned a live row.
 */
export async function reconcileSandboxStoppedByExternalId(externalId: string, now = new Date()): Promise<boolean> {
  const [row] = await db
    .select({ sandboxId: sessionSandboxes.sandboxId, sessionId: sessionSandboxes.sessionId, status: sessionSandboxes.status })
    .from(sessionSandboxes)
    .where(eq(sessionSandboxes.externalId, externalId))
    .limit(1);
  if (!row) return false;
  if (row.status === 'stopped' || row.status === 'archived') return false;
  await pauseComputeSession(row.sandboxId).catch((err) =>
    console.warn(`[reaper] pauseComputeSession failed for ${row.sandboxId}:`, err instanceof Error ? err.message : err),
  );
  // Quiesce: a provider-confirmed stop must stay stopped — passive /v1/p traffic
  // (markSandboxUsed heal / wakeSandbox) must not resurrect it. Cleared on an
  // explicit open / real turn.
  await db
    .update(sessionSandboxes)
    .set({ status: 'stopped', updatedAt: now, metadata: mergeMetadata(buildIdleStopMetadata({ quiesce: true, nowIso: now.toISOString() })) })
    .where(eq(sessionSandboxes.sandboxId, row.sandboxId));
  await db.update(projectSessions).set({ status: 'stopped', updatedAt: now }).where(eq(projectSessions.sessionId, row.sessionId));
  invalidateProviderCache(externalId);
  return true;
}

/**
 * The provider reports the box destroyed/deleted/lost — finalize billing and
 * preserve the original mapping. Keyed by external id; idempotent. Shared by
 * webhook ingress + reaper.
 */
export async function reconcileSandboxRemovedByExternalId(externalId: string, now = new Date()): Promise<boolean> {
  const [row] = await db
    .select({
      sandboxId: sessionSandboxes.sandboxId,
      sessionId: sessionSandboxes.sessionId,
      accountId: sessionSandboxes.accountId,
      externalId: sessionSandboxes.externalId,
      metadata: sessionSandboxes.metadata,
      status: sessionSandboxes.status,
    })
    .from(sessionSandboxes)
    .where(eq(sessionSandboxes.externalId, externalId))
    .limit(1);
  if (!row) return false;
  if (!row.externalId) return false;
  await preserveEstablishedRuntime(row, 'provider_webhook_removed', now);
  // The box is GONE at the provider — unlike an idle stop, nothing can wake it,
  // so its executor token is now a bearer credential with no owner. Nothing
  // else ever expires these (no expiresAt, exempt from PAT idle-revoke).
  await revokeSessionExecutorTokens(row.sessionId, row.accountId).catch((err) =>
    console.error(
      `[reaper] FAILED to revoke executor tokens for removed sandbox ${externalId} (session ${row.sessionId}):`,
      err,
    ),
  );
  invalidateProviderCache(externalId);
  return true;
}
