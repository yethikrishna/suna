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
  /** Provider said REMOVED; identity preserved, NOT resumable. Spec Path D2.
   *  ONLY for a provider-sourced removal signal — a reaper status poll, a
   *  provider webhook, or a /start status check that came back `removed`.
   *  Never for "we tried to bring the box back and could not": those have
   *  their own reasons below, because a failed wake is the population this
   *  whole measurement exists to size and folding it in here would report it
   *  as a provider removal that never happened. */
  'provider_removed',
  /** A wake of a parked box never produced a running runtime — /start burned
   *  the wake budget, or the provider rejected the start as missing. The row
   *  keeps its identity; the box simply never came back. */
  'runtime_wake_failed',
  /** The box IS provider-running, but OpenCode never became reachable inside
   *  the readiness budget. Distinct from a wake failure: the infrastructure
   *  came up and the agent runtime did not. */
  'runtime_boot_failed',
  /** An explicit session restart could not re-establish the runtime. Separate
   *  from a wake because a restart is user-initiated and stops the box first,
   *  so its failures are not measuring the same thing. */
  'restart_failed',
  /** Provisioning stalled — the row sat in `pending`/`provisioning`/`retrying`
   *  past its staleness bound and was never usable. */
  'provisioning_stalled',
  /** The sandbox row reached a state /start cannot use while the session row
   *  still claimed to be live. A control-plane desync, not a provider event. */
  'unusable_runtime_state',
  /** A human stopped or deleted it. */
  'manual',
  /** An ops sweep parked a wedged box outside the normal reaper. Not a user
   *  action — misattributing it to `manual` would hide the backlog it clears. */
  'wedged_backlog_remediation',
] as const;

export type StopReason = (typeof STOP_REASONS)[number];

export function isStopReason(value: unknown): value is StopReason {
  return typeof value === 'string' && (STOP_REASONS as readonly string[]).includes(value);
}
