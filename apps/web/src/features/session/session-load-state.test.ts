import { describe, expect, test } from 'bun:test';

import {
  canMountSessionChat,
  canShowSessionChat,
  findInitialSessionPin,
  resolveChatSessionId,
  resolveSessionChatContentState,
} from './session-load-state';

describe('session load state', () => {
  test('uses the authorized project-session list as an initial transcript pin', () => {
    expect(
      findInitialSessionPin(
        [
          { session_id: 'session-a', opencode_session_id: 'ses_a' },
          { session_id: 'session-b', opencode_session_id: 'ses_b' },
        ],
        'session-b',
      ),
    ).toBe('ses_b');
    expect(findInitialSessionPin(undefined, 'session-b')).toBeNull();
  });

  test('mounts cached transcript content before the runtime switch completes', () => {
    expect(
      canMountSessionChat({
        switched: false,
        opencodeSessionId: 'opencode-cached',
      }),
    ).toBe(true);
  });

  test('keeps a session without a known transcript pin on the boot surface', () => {
    expect(
      canMountSessionChat({
        switched: false,
        opencodeSessionId: null,
      }),
    ).toBe(false);
  });

  test('shows the chat as soon as a transcript pin is available', () => {
    expect(
      canShowSessionChat({
        chatSessionId: 'opencode-cached',
        runtimeError: null,
        runtimeBootError: null,
      }),
    ).toBe(true);
  });

  test('takes the runtime mount id from the SDK instead of re-deriving it', () => {
    expect(
      resolveChatSessionId({
        selectedSessionId: null,
        pinnedMountId: null,
        runtimeMountId: 'kortix-session-1',
      }),
    ).toBe('kortix-session-1');
  });

  test('a legacy ?oc deep-link selection still outranks the runtime mount id', () => {
    expect(
      resolveChatSessionId({
        selectedSessionId: 'ses_deep_link',
        pinnedMountId: 'ses_pinned',
        runtimeMountId: 'ses_pinned',
      }),
    ).toBe('ses_deep_link');
  });

  test('keeps the first resolved pin when the live OpenCode id blips to null', () => {
    expect(
      resolveChatSessionId({
        selectedSessionId: null,
        pinnedMountId: 'ses_pinned',
        runtimeMountId: null,
      }),
    ).toBe('ses_pinned');
  });

  test('a ready session with no OpenCode pin and no error still shows its chat', () => {
    // Regression guard: a managed-ACP session is ready with
    // `opencode_session_id === null` forever. The host used to compute the mount
    // id from that pin alone, so `canShowSessionChat` was false and the route
    // rendered an empty shell — the chat only appeared when `runtimeError` was
    // truthy, i.e. only when the session was BROKEN.
    const chatSessionId = resolveChatSessionId({
      selectedSessionId: null,
      pinnedMountId: null,
      runtimeMountId: 'kortix-session-1',
    });
    expect(
      canShowSessionChat({
        chatSessionId,
        runtimeError: null,
        runtimeBootError: null,
      }),
    ).toBe(true);
  });

  test('a session with no runtime identity at all stays on the boot surface', () => {
    expect(
      canShowSessionChat({
        chatSessionId: resolveChatSessionId({
          selectedSessionId: null,
          pinnedMountId: null,
          runtimeMountId: null,
        }),
        runtimeError: null,
        runtimeBootError: null,
      }),
    ).toBe(false);
  });
});

describe('resolveSessionChatContentState', () => {
  const rest = { chatSessionId: 'ses_pin', opencodeSessionId: 'ses_pin', ready: true };
  const acp = { chatSessionId: 'kortix-session-1', opencodeSessionId: null, ready: true };
  const base = {
    runtimeSessionResolved: false,
    runtimeSessionFetched: false,
    runtimeReady: false,
    hasMessages: false,
    hasOptimisticPrompt: false,
  };

  test('OpenCode REST: a resolved session object shows the chat', () => {
    expect(
      resolveSessionChatContentState({ ...base, sdk: rest, runtimeSessionResolved: true }),
    ).toEqual({ loading: false, notFound: false });
  });

  test('OpenCode REST: an empty lookup against a ready runtime is terminal not-found', () => {
    expect(
      resolveSessionChatContentState({
        ...base,
        sdk: rest,
        runtimeReady: true,
        runtimeSessionFetched: true,
      }),
    ).toEqual({ loading: false, notFound: true });
  });

  test('OpenCode REST: an unresolved lookup is still loading, never not-found', () => {
    expect(resolveSessionChatContentState({ ...base, sdk: rest })).toEqual({
      loading: true,
      notFound: false,
    });
  });

  test('OpenCode REST: cached messages beat an unresolved lookup', () => {
    expect(resolveSessionChatContentState({ ...base, sdk: rest, hasMessages: true })).toEqual({
      loading: false,
      notFound: false,
    });
  });

  test('no SDK state behaves exactly like the OpenCode REST path', () => {
    expect(resolveSessionChatContentState({ ...base, sdk: null })).toEqual({
      loading: true,
      notFound: false,
    });
    expect(
      resolveSessionChatContentState({
        ...base,
        sdk: null,
        runtimeReady: true,
        runtimeSessionFetched: true,
      }),
    ).toEqual({ loading: false, notFound: true });
  });

  test('managed ACP: a ready runtime shows the chat even though OpenCode REST answers nothing', () => {
    // The regression this guards: an ACP session's box runs no OpenCode REST
    // server, so `GET /session` 503s forever. Gating the chat shell on that
    // lookup held the composer behind a permanent "Connecting" card.
    expect(
      resolveSessionChatContentState({
        ...base,
        sdk: acp,
        runtimeReady: true,
        runtimeSessionFetched: true,
      }),
    ).toEqual({ loading: false, notFound: false });
  });

  test('managed ACP: a failed OpenCode lookup is NEVER read as a missing session', () => {
    expect(
      resolveSessionChatContentState({
        ...base,
        sdk: { ...acp, ready: false },
        runtimeReady: true,
        runtimeSessionFetched: true,
      }),
    ).toEqual({ loading: true, notFound: false });
  });
});
