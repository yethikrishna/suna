import { expect, test } from 'bun:test';

import {
  hasSessionRuntimeIdentity,
  isSessionRuntimeActionReady,
  resolveSessionMountId,
} from './session-runtime-identity';

test('managed ACP does not require an OpenCode session id', () => {
  expect(hasSessionRuntimeIdentity({ usesAcp: true, opencodeSessionId: null })).toBe(true);
});

test('REST requires an OpenCode session id', () => {
  expect(hasSessionRuntimeIdentity({ usesAcp: false, opencodeSessionId: null })).toBe(false);
  expect(hasSessionRuntimeIdentity({ usesAcp: false, opencodeSessionId: 'ses_1' })).toBe(true);
});

test('managed ACP mounts the chat on the durable Kortix session id', () => {
  expect(
    resolveSessionMountId({
      usesAcp: true,
      sessionId: 'kortix-session-1',
      opencodeSessionId: null,
    }),
  ).toBe('kortix-session-1');
});

test('OpenCode REST mounts the chat on its own server-owned session pin', () => {
  expect(
    resolveSessionMountId({
      usesAcp: false,
      sessionId: 'kortix-session-1',
      opencodeSessionId: 'ses_pinned',
    }),
  ).toBe('ses_pinned');
});

test('OpenCode REST has no mount id until its session pin resolves', () => {
  expect(
    resolveSessionMountId({
      usesAcp: false,
      sessionId: 'kortix-session-1',
      opencodeSessionId: null,
    }),
  ).toBeNull();
});

test('a preassigned OpenCode id cannot authorize runtime actions before the sandbox switch', () => {
  expect(
    isSessionRuntimeActionReady({
      switched: false,
      usesAcp: false,
      opencodeSessionId: 'ses_cached',
    }),
  ).toBe(false);
  expect(
    isSessionRuntimeActionReady({
      switched: true,
      usesAcp: false,
      opencodeSessionId: 'ses_authoritative',
    }),
  ).toBe(true);
});
