import { describe, expect, test } from 'bun:test';

import { connectLinkUrl, runConnectLinkFlow } from './use-connect-link';

describe('connectLinkUrl', () => {
  test('uses connectUrl before redirectUrl', () => {
    expect(connectLinkUrl({ connectUrl: 'https://connect.example/a', redirectUrl: 'https://connect.example/b' })).toBe(
      'https://connect.example/a',
    );
  });

  test('falls back to redirectUrl', () => {
    expect(connectLinkUrl({ redirectUrl: 'https://connect.example/redirect' })).toBe(
      'https://connect.example/redirect',
    );
  });
});

describe('runConnectLinkFlow', () => {
  test('opens the connect link and polls finalize until connected', async () => {
    const opened: string[] = [];
    let finalizeCalls = 0;
    const result = await runConnectLinkFlow(
      { connectUrl: 'https://connect.example/link' },
      async () => ({ connected: ++finalizeCalls === 2 }),
      {
        openWindow: (url) => {
          opened.push(url);
          return {
            closed: false,
            focus: () => {
              opened.push('focus');
            },
          } as unknown as Window;
        },
        sleep: async () => {},
        now: () => 0,
      },
    );

    expect(result).toEqual({ connected: true });
    expect(opened).toEqual(['https://connect.example/link', 'focus']);
    expect(finalizeCalls).toBe(2);
  });

  test('returns disconnected when the user closes the popup before finalize connects', async () => {
    let finalizeCalls = 0;
    let closed = false;
    const popup = {
      get closed() {
        return closed;
      },
      focus: () => {},
    } as unknown as Window;
    const result = await runConnectLinkFlow(
      { redirectUrl: 'https://connect.example/link' },
      async () => {
        finalizeCalls += 1;
        closed = true;
        return { connected: false };
      },
      {
        openWindow: () => popup,
        sleep: async () => {},
        now: () => 0,
      },
    );

    expect(result).toEqual({ connected: false });
    expect(finalizeCalls).toBe(1);
  });

  test('requires a Connect Link URL', async () => {
    await expect(
      runConnectLinkFlow({}, async () => ({ connected: true }), {
        openWindow: () => null,
      }),
    ).rejects.toThrow('App connect is not configured');
  });
});
