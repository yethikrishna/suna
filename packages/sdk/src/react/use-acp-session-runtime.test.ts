import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import type { AcpSessionControllerOptions } from '../core/acp';
import { configureKortix } from '../core/http/config';
import {
  cancelAcpSession,
  createAcpSessionRuntimeController,
  nextAcpIdentity,
} from './use-acp-session-runtime';

function managedPersistCallback(
  onAcpIdentitySettled?: (acpSessionId: string | null) => void,
): NonNullable<AcpSessionControllerOptions['persistAcpSessionId']> {
  configureKortix({
    backendUrl: 'https://api.kortix.test/v1',
    getToken: async () => 'token',
  });
  let captured: AcpSessionControllerOptions | null = null;
  createAcpSessionRuntimeController(
    {
      projectId: 'project-1',
      runtimeUrl: 'https://api.kortix.test/v1/p/box/8000',
      sessionId: 'project-session-1',
      acpServerId: 'project-session-1',
      acpSessionId: null,
      runtimeHarness: 'codex',
      ...(onAcpIdentitySettled ? { onAcpIdentitySettled } : {}),
    },
    (options) => {
      captured = options;
      return { kind: 'managed' } as never;
    },
  );
  const persist = (captured as AcpSessionControllerOptions | null)?.persistAcpSessionId;
  if (!persist) throw new Error('Expected a managed persistAcpSessionId callback');
  return persist;
}

test('ACP cancellation propagates the controller rejection', async () => {
  const failure = new Error('cancel failed');
  await expect(
    cancelAcpSession({
      cancel: async () => {
        throw failure;
      },
    }),
  ).rejects.toBe(failure);
});

test('legacy ACP sessions keep the canonical OpenCode session as the bridge identity', () => {
  const inputs: unknown[] = [];
  const controller = createAcpSessionRuntimeController(
    {
      projectId: 'project-1',
      runtimeUrl: 'https://api.kortix.test/v1/p/box/8000',
      sessionId: 'project-session-1',
      acpServerId: null,
      acpSessionId: null,
      runtimeHarness: null,
      legacySessionId: 'opencode-root-1',
    },
    (input) => {
      inputs.push(input);
      return { kind: 'legacy' } as never;
    },
  );

  expect((controller as unknown as { kind: string }).kind).toBe('legacy');
  expect(inputs).toEqual([
    {
      runtimeUrl: 'https://api.kortix.test/v1/p/box/8000',
      sessionId: 'opencode-root-1',
    },
  ]);
});

test('managed ACP sessions bind the immutable native agent to the controller', () => {
  configureKortix({
    backendUrl: 'https://api.kortix.test/v1',
    getToken: async () => 'token',
  });
  const inputs: unknown[] = [];
  createAcpSessionRuntimeController(
    {
      projectId: 'project-1',
      runtimeUrl: 'https://api.kortix.test/v1/p/box/8000',
      sessionId: 'project-session-1',
      acpServerId: 'project-session-1',
      acpSessionId: 'codex-native-1',
      runtimeHarness: 'codex',
      nativeAgent: 'reviewer',
    },
    (input) => {
      inputs.push(input);
      return { kind: 'managed' } as never;
    },
  );

  expect(inputs).toEqual([
    expect.objectContaining({
      sessionId: 'project-session-1',
      acpServerId: 'project-session-1',
      acpSessionId: 'codex-native-1',
      runtimeHarness: 'codex',
      nativeAgent: 'reviewer',
      endpoint: 'https://api.kortix.test/v1/projects/project-1/sessions/project-session-1/acp',
      durableTranscript: true,
    }),
  ]);
});

test('the identity claim returns the harness session id the API stored', async () => {
  const persist = managedPersistCallback();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    Response.json({
      acp_server_id: 'project-session-1',
      runtime_harness: 'codex',
      acp_session_id: 'A',
    })) as unknown as typeof fetch;
  try {
    expect(await persist('B')).toBe('A');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("the identity claim propagates the winner's id from a 409 body", async () => {
  const persist = managedPersistCallback();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    Response.json(
      {
        error: 'acp_session_id is immutable after the first successful session/new response',
        code: 'ACP_SESSION_ID_CONFLICT',
        acp_session_id: 'A',
      },
      { status: 409 },
    )) as unknown as typeof fetch;
  try {
    const rejection = await persist('B').then(
      () => null,
      (error: unknown) => error as { status?: number; details?: { acp_session_id?: string } },
    );
    expect(rejection?.status).toBe(409);
    expect(rejection?.details?.acp_session_id).toBe('A');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a stored identity is reported so the next controller loads it instead of minting', async () => {
  const settled: Array<string | null> = [];
  const persist = managedPersistCallback((acpSessionId) => settled.push(acpSessionId));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    Response.json({
      acp_server_id: 'project-session-1',
      runtime_harness: 'codex',
      acp_session_id: 'A',
    })) as unknown as typeof fetch;
  try {
    await persist('A');
  } finally {
    globalThis.fetch = originalFetch;
  }
  expect(settled).toEqual(['A']);
});

test('a lost identity race reports an unknown winner so the caller re-reads it', async () => {
  const settled: Array<string | null> = [];
  const persist = managedPersistCallback((acpSessionId) => settled.push(acpSessionId));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    Response.json(
      {
        error: 'acp_session_id is immutable after the first successful session/new response',
        code: 'ACP_SESSION_ID_CONFLICT',
        acp_session_id: 'A',
      },
      { status: 409 },
    )) as unknown as typeof fetch;
  try {
    await persist('B').catch(() => {});
  } finally {
    globalThis.fetch = originalFetch;
  }
  expect(settled).toEqual([null]);
});

test('a known harness session id survives a cache blip back to null', () => {
  const current = { sessionId: 'project-session-1', acpSessionId: 'A' };
  expect(nextAcpIdentity(current, { sessionId: 'project-session-1', acpSessionId: null })).toBe(
    current,
  );
});

test('learning the harness session id adopts it', () => {
  expect(
    nextAcpIdentity(
      { sessionId: 'project-session-1', acpSessionId: null },
      { sessionId: 'project-session-1', acpSessionId: 'A' },
    ),
  ).toEqual({ sessionId: 'project-session-1', acpSessionId: 'A' });
});

test('an unchanged identity keeps the same object so nothing downstream rebuilds', () => {
  const current = { sessionId: 'project-session-1', acpSessionId: 'A' };
  expect(nextAcpIdentity(current, { sessionId: 'project-session-1', acpSessionId: 'A' })).toBe(
    current,
  );
});

test('a different Kortix session NEVER inherits the previous session harness id', () => {
  expect(
    nextAcpIdentity(
      { sessionId: 'project-session-1', acpSessionId: 'A' },
      { sessionId: 'project-session-2', acpSessionId: null },
    ),
  ).toEqual({ sessionId: 'project-session-2', acpSessionId: null });
});

// Guard the ONE property of the hook that no pure unit can express: learning the
// harness-native session id must not be a reason to rebuild the controller. If
// `acpSessionId` returns to the memo dependency list, the write-back that stops
// the mint loop starts closing live streams instead.
test('the controller memo does not depend on the harness session id', () => {
  const source = readFileSync(new URL('./use-acp-session-runtime.ts', import.meta.url), 'utf8');
  const deps = source.slice(source.indexOf('const controller = useMemo('));
  const depArray = deps.slice(deps.indexOf('    ['), deps.indexOf('],') + 2);
  expect(depArray).toContain('input.sessionId,');
  expect(depArray).not.toContain('acpSessionId');
});
