// The stop vocabulary is CLOSED. The classification query in JAY-424 groups on
// it, and a free-text reason makes that query silently incomplete rather than
// loudly wrong.
import { describe, expect, test } from 'bun:test';
import { STOP_REASONS, isStopReason } from './stop-reason';

describe('STOP_REASONS', () => {
  test('covers every park path the reaper and request path can take', () => {
    // Cast to string[]: `toEqual`'s overload pins the expected side to the
    // exact literal union, so a plain string-literal array on the right does
    // not unify with it without this — the values checked are unchanged.
    expect(([...STOP_REASONS] as string[]).sort()).toEqual(
      [
        'boot_floor_expired',
        'deadline_expired',
        'idle_grace',
        'manual',
        'provider_reconcile',
        'provider_removed',
        'provisioning_stalled',
        'restart_failed',
        'run_cap',
        'runtime_boot_failed',
        'runtime_wake_failed',
        'unusable_runtime_state',
        'wedged_backlog_remediation',
      ].sort(),
    );
  });

  test('rejects anything outside the union', () => {
    expect(isStopReason('deadline_expired')).toBe(true);
    expect(isStopReason('whatever')).toBe(false);
  });
});
