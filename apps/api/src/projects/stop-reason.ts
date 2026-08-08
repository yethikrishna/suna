/**
 * WHY a sandbox parked. Written to `session_sandboxes.metadata.stopReason` by
 * every path that stops a box, and read by the path-classification query.
 *
 * CLOSED on purpose. The classification query groups on this value, so a
 * free-text reason does not produce a wrong answer — it produces a quietly
 * incomplete one, which is worse.
 */
export const STOP_REASONS = [
  /** deadline_at passed with a normal grant behind it. Spec Path A/B. */
  'deadline_expired',
  /** Burned the whole 24h continuous stretch. Spec Path C. */
  'run_cap',
  /** Terminal turn end pulled the deadline to the idle tail, then it passed. */
  'idle_grace',
  /** Only ever held the 20-minute stopped->active boot floor. Spec Path A'. */
  'boot_floor_expired',
  /** Provider said stopped; we synced our row. Spec Path D. */
  'provider_reconcile',
  /** Provider said REMOVED; identity preserved, NOT resumable. Spec Path D2. */
  'provider_removed',
  /** A human stopped or deleted it. */
  'manual',
] as const;

export type StopReason = (typeof STOP_REASONS)[number];

export function isStopReason(value: unknown): value is StopReason {
  return typeof value === 'string' && (STOP_REASONS as readonly string[]).includes(value);
}
