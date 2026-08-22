import { describe, expect, test } from 'bun:test';
import { chatPlanAnchorId, planAnchorMessageId, planBelongsToChat } from './plan-anchor';
import type { PlanSurfaceState } from './plan-anchor';

type Msg = Parameters<typeof planAnchorMessageId>[0][number];

function user(id: string): Msg {
  return { info: { id, role: 'user' }, parts: [] } as unknown as Msg;
}

function assistant(id: string, tools: string[] = []): Msg {
  return {
    info: { id, role: 'assistant' },
    parts: tools.map((tool, i) => ({
      id: `${id}_p${i}`,
      type: 'tool',
      tool,
      callID: `call_${id}_${i}`,
      state: { status: 'completed' },
    })),
  } as unknown as Msg;
}

describe('planAnchorMessageId', () => {
  test('anchors the plan to the user message whose turn wrote the todos', () => {
    const messages = [
      user('u1'),
      assistant('a1', ['todowrite', 'bash']),
      user('u2'),
      assistant('a2', ['read']),
    ];

    // The reported bug: this returned 'u2' (the newest turn), so the plan card
    // migrated onto a message that never touched the plan.
    expect(planAnchorMessageId(messages)).toBe('u1');
  });

  test('a later turn that never writes todos does not steal the plan', () => {
    const messages = [
      user('u1'),
      assistant('a1', ['todowrite']),
      user('u2'),
      assistant('a2', ['bash']),
      user('u3'),
      assistant('a3', ['read', 'grep']),
    ];

    expect(planAnchorMessageId(messages)).toBe('u1');
  });

  test('a re-plan moves the anchor to the turn that re-planned', () => {
    const messages = [
      user('u1'),
      assistant('a1', ['todowrite']),
      user('u2'),
      assistant('a2', ['bash']),
      user('u3'),
      assistant('a3', ['todowrite']),
    ];

    expect(planAnchorMessageId(messages)).toBe('u3');
  });

  test('accepts both tool spellings', () => {
    expect(planAnchorMessageId([user('u1'), assistant('a1', ['todo_write'])])).toBe('u1');
    expect(planAnchorMessageId([user('u1'), assistant('a1', ['todowrite'])])).toBe('u1');
  });

  test('todos written while the turn is still streaming anchor to that turn', () => {
    const messages = [user('u1'), assistant('a1', ['bash']), user('u2'), assistant('a2', ['todowrite'])];

    expect(planAnchorMessageId(messages)).toBe('u2');
  });

  test('falls back to the last user message when no turn wrote todos', () => {
    // The session can hold todos with no `todowrite` part in the loaded
    // history — compaction drops old parts, and the todo list comes from the
    // runtime, not from the transcript. Keep the card reachable rather than
    // dropping it entirely.
    const messages = [user('u1'), assistant('a1', ['bash']), user('u2'), assistant('a2', ['read'])];

    expect(planAnchorMessageId(messages)).toBe('u2');
  });

  test('returns null when there is no user message at all', () => {
    expect(planAnchorMessageId([])).toBeNull();
    expect(planAnchorMessageId([assistant('a1', ['todowrite'])])).toBeNull();
  });

  test('ignores todo parts that precede any user message', () => {
    const messages = [assistant('a0', ['todowrite']), user('u1'), assistant('a1', ['bash'])];

    // No user message owned that write, so the fallback (last user) applies.
    expect(planAnchorMessageId(messages)).toBe('u1');
  });
});

/**
 * "Exactly one plan surface" — the rule `PlanPanelCard` and the transcript
 * card both obey, through `usePlanInChat`.
 *
 * The three desktop cases below are the regression this predicate exists for.
 * The first version asked `isMobile` alone, which answers "does a panel COLUMN
 * exist", not "is that column drawing anything". In each state here the panel
 * had no plan on screen AND the chat had stood down, so the session showed no
 * plan at all — reachable by one keypress (Cmd/Ctrl+I) or by opening any file.
 */
describe('planBelongsToChat', () => {
  /** The panel is drawing the plan: desktop, Easy, expanded, nothing over it. */
  const panelDraws: PlanSurfaceState = {
    isMobile: false,
    panelOpen: true,
    detailOpen: false,
    panelMode: 'easy',
  };

  test('the panel owns the plan when its column is actually on screen', () => {
    expect(planBelongsToChat(panelDraws)).toBe(false);
  });

  test('mobile keeps the plan in the transcript', () => {
    // No panel column under 768px — the cards are a drawer, shut by default.
    expect(planBelongsToChat({ ...panelDraws, isMobile: true })).toBe(true);
  });

  test('REGRESSION: a collapsed column hands the plan back to the chat', () => {
    // Cmd/Ctrl+I or the chevron animates the column to `width: 0` and marks it
    // `inert`. The card stays mounted and is invisible to pointer AND screen
    // reader, so "still rendered" is not "still available".
    expect(planBelongsToChat({ ...panelDraws, panelOpen: false })).toBe(true);
  });

  test('REGRESSION: a detail panel over the column hands the plan back', () => {
    // Terminal, browser, files, or a file preview — the column takes `hidden`
    // and steps aside entirely. Opening a zip from Outputs is exactly this.
    expect(planBelongsToChat({ ...panelDraws, detailOpen: true })).toBe(true);
  });

  test('REGRESSION: Advanced mode has no Plan card, so the chat draws it', () => {
    // Advanced is a tool-call stepper and renders no cards. It is commented out
    // today; this is what stops re-enabling it from losing the plan silently.
    expect(planBelongsToChat({ ...panelDraws, panelMode: 'advanced' })).toBe(true);
  });

  test('any single hidden-panel condition is enough on its own', () => {
    // OR, not AND — a new way to hide the column must default to KEEPING the
    // plan, never to dropping it.
    for (const state of [
      { ...panelDraws, panelOpen: false },
      { ...panelDraws, detailOpen: true },
      { ...panelDraws, panelMode: 'advanced' as const },
      { ...panelDraws, isMobile: true },
    ]) {
      expect(planBelongsToChat(state)).toBe(true);
    }
  });

  test('the panel draws the plan in exactly one state, never more', () => {
    // Exhaustive over the 2x2x2x2 space: precisely one combination may return
    // false, or two surfaces can mount the same live checklist.
    const bools = [false, true];
    const drawnByPanel: PlanSurfaceState[] = [];
    for (const isMobile of bools)
      for (const panelOpen of bools)
        for (const detailOpen of bools)
          for (const panelMode of ['easy', 'advanced'] as const) {
            const state = { isMobile, panelOpen, detailOpen, panelMode };
            if (!planBelongsToChat(state)) drawnByPanel.push(state);
          }
    expect(drawnByPanel).toEqual([panelDraws]);
  });
});

/**
 * The transcript half. `chatPlanAnchorId` only asks WHICH turn once
 * `planBelongsToChat` has said the chat is drawing it at all.
 */
describe('chatPlanAnchorId', () => {
  const messages = [user('u1'), assistant('a1', ['todowrite']), user('u2')];

  test('the panel owns the plan: no turn claims it', () => {
    // Null matches no message id, so every `ownsPlan` downstream is false and
    // the user bubble's column cap relaxes back to `max-w-[80%]` with it.
    expect(chatPlanAnchorId(messages, false)).toBeNull();
  });

  test('the chat owns the plan: the same anchor as before the panel existed', () => {
    expect(chatPlanAnchorId(messages, true)).toBe('u1');
    expect(chatPlanAnchorId(messages, true)).toBe(planAnchorMessageId(messages));
  });

  test('no transcript yet is null either way', () => {
    expect(chatPlanAnchorId(null, true)).toBeNull();
    expect(chatPlanAnchorId(undefined, true)).toBeNull();
    expect(chatPlanAnchorId([], true)).toBeNull();
  });

  test('the scan is skipped entirely when the panel owns the plan', () => {
    // The gate wraps the walk rather than sitting beside it: on a long session
    // `planAnchorMessageId` inspects every part of every message, and that is
    // work with no consumer while the panel is drawing.
    const huge = Array.from({ length: 500 }, (_, i) => user(`u${i}`));
    expect(chatPlanAnchorId(huge, false)).toBeNull();
  });
});
