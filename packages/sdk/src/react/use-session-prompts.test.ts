import { describe, expect, test } from 'bun:test';
import {
  SESSION_PROMPTS_IDLE_POLL_MS,
  SESSION_PROMPTS_POLL_MS,
  sessionPromptsPollMs,
} from './use-session-prompts';

/**
 * The polling cadence is a CORRECTNESS decision, not a performance one.
 *
 * A prompt can ENTER this list without the tab doing anything: the reaper
 * redelivers one whose turn never ran, and parking a box requeues its in-flight
 * prompt as `held`. Both land on a session whose list is, at that moment, empty
 * — and the `held` design depends on the user seeing the row so they can
 * release it. A cadence of `false` at zero rows means the tab never learns, and
 * only a full page load recovers.
 */
describe('sessionPromptsPollMs', () => {
  test('polls fast while prompts are pending — their state changes on its own', () => {
    expect(sessionPromptsPollMs(1)).toBe(SESSION_PROMPTS_POLL_MS);
    expect(sessionPromptsPollMs(7)).toBe(SESSION_PROMPTS_POLL_MS);
  });

  test('an EMPTY list still polls, slowly — a prompt can come back on its own', () => {
    expect(sessionPromptsPollMs(0)).toBe(SESSION_PROMPTS_IDLE_POLL_MS);
    expect(SESSION_PROMPTS_IDLE_POLL_MS).toBeGreaterThan(SESSION_PROMPTS_POLL_MS);
  });

  test('an explicit cadence overrides the busy one, never the idle one', () => {
    // Hosts tune the busy cadence for their own UI. The idle floor is not
    // theirs to remove: it is what makes a re-entering prompt visible.
    expect(sessionPromptsPollMs(2, 500)).toBe(500);
    expect(sessionPromptsPollMs(0, 500)).toBe(SESSION_PROMPTS_IDLE_POLL_MS);
  });
});
