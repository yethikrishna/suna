import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./use-session.ts', import.meta.url), 'utf8');

describe('useSession runtime ownership gate', () => {
  test('does not connect OpenCode transports before /start switches the sandbox', () => {
    expect(source).toContain('enabled: switched && runtimePolicy.streamOpenCodeEvents');
    expect(source).toContain('networkEnabled: switched');
  });
});

describe('useSession chat mount identity', () => {
  test('resolves the host mount id from the transport-agnostic predicate', () => {
    expect(source).toContain("from './session-runtime-identity'");
    expect(source).toContain('resolveSessionMountId({');
  });

  test('returns the mount id so a host never re-derives it from the OpenCode pin', () => {
    expect(source).toContain('chatSessionId,');
  });
});

describe('useSession ACP identity freshness', () => {
  test('corrects the cached /start identity instead of letting a second mint happen', () => {
    expect(source).toContain('onAcpIdentitySettled: applyAcpIdentity');
    expect(source).toContain('queryClient.setQueryData<SessionStartResult | null>(key,');
    expect(source).toContain('void queryClient.invalidateQueries({ queryKey: key });');
  });
});
