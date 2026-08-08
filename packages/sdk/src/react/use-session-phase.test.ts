// The reopen-panic rule. A health 503 that races a live /start is NOT a failure —
// it is the ordinary shape of waking a parked box.
import { describe, expect, test } from 'bun:test';
import { derivePhase } from './use-session-phase';

const RUNTIME_503 = { status: 503, body: { error: 'sandbox not ready (status: stopped)' } };
const base = { terminal: false, startError: null, runtimeError: null, startSettled: false, switched: false };

describe('derivePhase', () => {
  test('a runtime 503 while /start is still working reads as starting, not error', () => {
    expect(derivePhase({ ...base, runtimeError: RUNTIME_503 })).toBe('starting');
  });

  test('the same 503 after /start has settled is a real error', () => {
    expect(derivePhase({ ...base, runtimeError: RUNTIME_503, startSettled: true })).toBe('error');
  });

  test('a /start error is terminal immediately — nothing else is coming', () => {
    expect(derivePhase({ ...base, startError: new Error('nope') })).toBe('error');
  });

  test('a terminal stage is an error regardless of /start', () => {
    expect(derivePhase({ ...base, terminal: true })).toBe('error');
  });

  test('switched with no error is ready', () => {
    expect(derivePhase({ ...base, switched: true })).toBe('ready');
  });

  test('a removed runtime stays an error — it can never wake, so never show waking', () => {
    expect(derivePhase({ ...base, terminal: true, runtimeError: RUNTIME_503 })).toBe('error');
  });
});
