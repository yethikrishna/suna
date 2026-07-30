import { expect, test } from 'bun:test';

import { getKortixPtyWebSocketUrl } from './pty';

test('resolves a PTY websocket url outside a browser, with no window to read', async () => {
  const url = await getKortixPtyWebSocketUrl('pty_1', 'https://host.test/v1/p/sbx_1/8000');
  expect(url.startsWith('wss://host.test/v1/p/sbx_1/8000/kortix/pty/pty_1/connect')).toBe(true);
});

test('downgrades to ws for a local http runtime base', async () => {
  const url = await getKortixPtyWebSocketUrl('pty_1', 'http://localhost:14108/v1/p/sbx_1/8000');
  expect(url.startsWith('ws://localhost:14108/v1/p/sbx_1/8000/kortix/pty/pty_1/connect')).toBe(
    true,
  );
});
