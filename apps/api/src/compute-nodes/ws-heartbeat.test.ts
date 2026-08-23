import { expect, test } from 'bun:test';

import { startWebSocketHeartbeat } from './ws-heartbeat';

test('WebSocket heartbeat sends protocol pings and stops cleanly', () => {
  let tick = () => {};
  let cleared: unknown = null;
  let pings = 0;
  const stop = startWebSocketHeartbeat(
    { ping: () => { pings += 1; } },
    (callback) => {
      tick = callback;
      return 42 as unknown as ReturnType<typeof setInterval>;
    },
    (timer) => { cleared = timer; },
  );

  expect(pings).toBe(0);
  tick();
  expect(pings).toBe(1);
  stop();
  expect(cleared).toBe(42);
});

test('WebSocket heartbeat tolerates a socket closing during a tick', () => {
  let tick = () => {};
  const stop = startWebSocketHeartbeat(
    { ping: () => { throw new Error('closed'); } },
    (callback) => {
      tick = callback;
      return 7 as unknown as ReturnType<typeof setInterval>;
    },
    () => {},
  );

  expect(() => tick()).not.toThrow();
  stop();
});
