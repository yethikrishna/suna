// selectPreResumeTargets must stop re-selecting a permanently-dead stopped
// sandbox for speculative pre-resume. Before this fix it ordered candidates
// by lastUsedAt DESC with no regard for prior wake failures, so a dead box
// sorted first forever and got re-kicked every ~30s on every replica
// (measured in prod: two dead boxes accounted for 367 of 435 pre-resume wake
// attempts in a single hour). This file mocks every module shared.ts imports
// at the top level — several (config, platform/providers, ...) touch real
// env/process state at import time — so only the pure selection logic under
// test actually runs. See the same pattern in ../sandbox-reaper.test.ts.
import { describe, expect, mock, test } from 'bun:test';
import { sessionSandboxes } from '@kortix/db';

let candidates: any[] = [];

mock.module('../../config', () => ({ config: {} }));
mock.module('../../billing/services/compute-metering', () => ({
  reopenComputeForSandbox: async () => {},
}));
mock.module('../../openapi', () => ({ auth: () => {}, json: () => {} }));
mock.module('../../platform/providers', () => ({ getProvider: () => ({}) }));
mock.module('../git', () => ({ resolveBranchTip: async () => null }));
mock.module('../../llm-gateway/enablement', () => ({ projectLlmGatewayEnabled: () => false }));
mock.module('../lib/git', () => ({ withProjectGitAuth: async () => ({}) }));
mock.module('../lib/serializers', () => ({ serializeSessionSandboxConfig: (c: unknown) => c }));
mock.module('../lib/session-runtime-allocator', () => ({ allocateSessionRuntime: () => {} }));
mock.module('../lib/sessions', () => ({
  buildSessionSandboxEnvVars: () => ({}),
  sandboxCallbackUnreachableReason: () => null,
}));
mock.module('../opencode-mapping', () => ({ ensureOpencodeSessionPin: async () => ({}) }));
mock.module('../runtime-identity', () => ({
  claimInPlaceRuntimeRecovery: async () => null,
  finalizeRecoveredRuntimeIfRunning: async () => null,
  markInPlaceRuntimeRecoveryAccepted: async () => null,
  preserveEstablishedRuntime: async () => null,
  retireUnmaterializedRuntime: async () => {},
  RUNTIME_IDENTITY_UNAVAILABLE: 'runtime_identity_unavailable',
}));
mock.module('../session-lifecycle/readiness-clocks', () => ({
  hasRuntimeReadinessClock: () => false,
  RUNTIME_READINESS_CLOCK_KEYS: [],
  staleOpencodeReadyReason: () => null,
}));

mock.module('../../shared/db', () => ({
  db: {
    select: () => ({
      from: (table: unknown) => ({
        innerJoin: () => ({
          where: () => ({
            orderBy: () => ({
              limit: async () => (table === sessionSandboxes ? candidates : []),
            }),
          }),
        }),
      }),
    }),
  },
}));

const { selectPreResumeTargets, isPreResumeEligible } = await import('./shared');

function candidate(over: Record<string, unknown> = {}) {
  return {
    sandboxId: 'sandbox-1',
    sessionId: 'session-1',
    accountId: 'account-1',
    provider: 'daytona',
    externalId: 'ext-1',
    metadata: {},
    ...over,
  };
}

describe('selectPreResumeTargets', () => {
  test('a healthy stopped box with no wake history is still selected', async () => {
    candidates = [candidate()];

    const targets = await selectPreResumeTargets('project-1', 'user-1', 5);

    expect(targets).toHaveLength(1);
    expect(targets[0].sandboxId).toBe('sandbox-1');
  });

  test('a box with a recent runtimeWakeError is not selected', async () => {
    candidates = [
      candidate({
        metadata: {
          runtimeWakeError: 'start_failed',
          runtimeWakeFailedAt: new Date().toISOString(),
          runtimeWakeFailureCount: 1,
        },
      }),
    ];

    const targets = await selectPreResumeTargets('project-1', 'user-1', 5);

    expect(targets).toHaveLength(0);
  });

  test('a box past the failure threshold is not selected even long after its last failure', async () => {
    candidates = [
      candidate({
        metadata: {
          runtimeWakeError: 'missing',
          runtimeWakeFailedAt: new Date(Date.now() - 60 * 60_000).toISOString(),
          runtimeWakeFailureCount: 3,
        },
      }),
    ];

    const targets = await selectPreResumeTargets('project-1', 'user-1', 5);

    expect(targets).toHaveLength(0);
  });

  test('backoff expiry allows a retry: an old failure below the threshold is selected again', async () => {
    candidates = [
      candidate({
        metadata: {
          runtimeWakeError: 'start_failed',
          runtimeWakeFailedAt: new Date(Date.now() - 60 * 60_000).toISOString(),
          runtimeWakeFailureCount: 1,
        },
      }),
    ];

    const targets = await selectPreResumeTargets('project-1', 'user-1', 5);

    expect(targets).toHaveLength(1);
  });

  test('a dead box past its limit still lets a healthy older box through via overfetch', async () => {
    candidates = [
      candidate({
        sandboxId: 'dead-box',
        metadata: {
          runtimeWakeError: 'missing',
          runtimeWakeFailedAt: new Date().toISOString(),
          runtimeWakeFailureCount: 3,
        },
      }),
      candidate({ sandboxId: 'healthy-box', metadata: {} }),
    ];

    const targets = await selectPreResumeTargets('project-1', 'user-1', 1);

    expect(targets).toHaveLength(1);
    expect(targets[0].sandboxId).toBe('healthy-box');
  });
});

describe('isPreResumeEligible', () => {
  test('still within backoff after a single failure is not eligible', () => {
    const nowMs = Date.now();
    const eligible = isPreResumeEligible(
      {
        runtimeWakeError: 'start_failed',
        runtimeWakeFailedAt: new Date(nowMs - 30_000).toISOString(),
        runtimeWakeFailureCount: 1,
      },
      nowMs,
    );

    expect(eligible).toBe(false);
  });

  test('past backoff after a single failure is eligible again', () => {
    const nowMs = Date.now();
    const eligible = isPreResumeEligible(
      {
        runtimeWakeError: 'start_failed',
        runtimeWakeFailedAt: new Date(nowMs - 10 * 60_000).toISOString(),
        runtimeWakeFailureCount: 1,
      },
      nowMs,
    );

    expect(eligible).toBe(true);
  });

  test('at the failure cap is never eligible regardless of backoff', () => {
    const nowMs = Date.now();
    const eligible = isPreResumeEligible(
      {
        runtimeWakeError: 'missing',
        runtimeWakeFailedAt: new Date(nowMs - 24 * 60 * 60_000).toISOString(),
        runtimeWakeFailureCount: 3,
      },
      nowMs,
    );

    expect(eligible).toBe(false);
  });
});
