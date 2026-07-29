/**
 * Stopping ONE box, isolated from the pass that decides which boxes to stop.
 *
 * This file used to be `running-box.ts` and it used to make the decision too:
 * probe the box's own opencode daemon, treat 'busy' as a veto, arm an idle
 * countdown in metadata, and fall back to an activity clock the box itself
 * stamped. All of that is gone. A wedged daemon answers 'busy' forever, so the
 * veto was unbounded and the countdown never once armed in production. The
 * decision now lives in one comparison in box-reaper.ts (`deadline_at <= now`)
 * and this module only carries it out.
 */

import { getProvider } from '../../platform/providers';
import type { ReapCandidate } from './box-queries';
import { isAlreadyNotRunning, isLifecycleTransitionInProgress } from './policy';
import { applyStoppedState } from './sandbox-state-sync';

export type StopBoxOutcome = 'stopped' | 'skipped' | 'errors';

export async function stopExpiredBox(row: ReapCandidate, now: Date): Promise<StopBoxOutcome> {
  try {
    await getProvider(row.provider).stop(row.externalId);
  } catch (err) {
    if (isLifecycleTransitionInProgress(err)) return 'skipped';
    if (!isAlreadyNotRunning(err)) {
      console.error(
        `[reaper] provider.stop failed for sandbox ${row.sandboxId}: ${(err as Error)?.message ?? err}`,
      );
      return 'errors';
    }
    // Already stopped/gone on the provider side is success — reconcile.
  }
  await applyStoppedState({
    sandboxId: row.sandboxId,
    sessionId: row.sessionId,
    externalId: row.externalId,
    now,
  });
  return 'stopped';
}
