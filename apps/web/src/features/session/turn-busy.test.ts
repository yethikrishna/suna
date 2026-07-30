import { describe, expect, test } from 'bun:test';

import { resolveTurnBusy } from './turn-busy';

const settled = {
  serverBusy: false,
  sending: false,
  pendingSendInFlight: false,
  compacting: false,
};

describe('resolveTurnBusy', () => {
  test('a settled session is not busy', () => {
    expect(resolveTurnBusy(settled)).toBe(false);
  });

  test('an in-flight send is busy before the runtime reports a status', () => {
    expect(resolveTurnBusy({ ...settled, sending: true })).toBe(true);
  });

  test('a runtime that reports a running turn is busy', () => {
    expect(resolveTurnBusy({ ...settled, serverBusy: true })).toBe(true);
  });

  test('a handed-off prompt from another route is busy', () => {
    expect(resolveTurnBusy({ ...settled, pendingSendInFlight: true })).toBe(true);
  });

  test('a compaction is busy', () => {
    expect(resolveTurnBusy({ ...settled, compacting: true })).toBe(true);
  });
});
