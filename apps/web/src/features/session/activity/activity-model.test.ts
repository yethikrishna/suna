import { describe, expect, test } from 'bun:test';

import type { MessageWithParts, Part, ToolPart } from '@/ui';
import {
  buildActivityItems,
  formatActivityDuration,
  isStructuralPart,
  partitionForNarrative,
  summarizeItems,
} from './activity-model';

const message = { info: { id: 'msg-1', role: 'assistant' } } as unknown as MessageWithParts;

let seq = 0;
function tool(name: string, extra: Partial<ToolPart> = {}): Part {
  seq += 1;
  return {
    id: `part-${seq}`,
    type: 'tool',
    tool: name,
    callID: `call-${seq}`,
    state: { status: 'completed', input: {}, time: { start: 0, end: 1000 } },
    ...extra,
  } as unknown as Part;
}

function step(phase: 'start' | 'finish'): Part {
  seq += 1;
  return { id: `step-${seq}`, type: `step-${phase}` } as unknown as Part;
}

function text(value: string): Part {
  seq += 1;
  return { id: `text-${seq}`, type: 'text', text: value } as unknown as Part;
}

function wrap(parts: Part[]) {
  return parts.map((part) => ({ part, message }));
}

describe('isStructuralPart', () => {
  test('step-start/step-finish paint nothing and must be transparent to grouping', () => {
    expect(isStructuralPart({ type: 'step-start' })).toBe(true);
    expect(isStructuralPart({ type: 'step-finish' })).toBe(true);
  });

  test('internal bookkeeping is structural', () => {
    expect(isStructuralPart({ type: 'snapshot' })).toBe(true);
    expect(isStructuralPart({ type: 'patch' })).toBe(true);
    expect(isStructuralPart({ type: 'agent' })).toBe(true);
    expect(isStructuralPart({ type: 'retry' })).toBe(true);
  });

  test('blank text/reasoning fragments are structural; real prose is not', () => {
    expect(isStructuralPart({ type: 'text', text: '  ' })).toBe(true);
    expect(isStructuralPart({ type: 'reasoning', text: '' })).toBe(true);
    expect(isStructuralPart({ type: 'text', text: 'Building the deck' })).toBe(false);
    expect(isStructuralPart({ type: 'tool' })).toBe(false);
  });
});

describe('buildActivityItems — the regression', () => {
  test('step parts between tool calls do NOT split the run', () => {
    // Exactly the wire shape that produced twelve raw `$ …` rows in the UI.
    const parts = wrap([
      step('start'),
      tool('bash'),
      step('finish'),
      step('start'),
      tool('bash'),
      step('finish'),
      step('start'),
      tool('bash'),
      step('finish'),
    ]);

    const items = buildActivityItems(parts);

    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('group');
    if (items[0].type === 'group') {
      expect(items[0].entries).toHaveLength(3);
      expect(items[0].kind).toBe('shell');
      expect(items[0].counts.shell).toBe(3);
    }
  });

  test('snapshot/patch bookkeeping also stays transparent', () => {
    const parts = wrap([
      tool('bash'),
      { id: 's', type: 'snapshot' } as unknown as Part,
      tool('bash'),
    ]);
    const items = buildActivityItems(parts);
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('group');
  });

  test('real prose DOES split a run — narration is a paragraph break', () => {
    const items = buildActivityItems(
      wrap([tool('bash'), tool('bash'), text('Now let me build the deck.'), tool('bash'), tool('bash')]),
    );
    expect(items.map((i) => i.type)).toEqual(['group', 'text', 'group']);
  });
});

describe('buildActivityItems — density', () => {
  const mixed = () => wrap([tool('read'), step('finish'), tool('bash'), tool('write'), tool('bash')]);

  test('detailed groups only like with like', () => {
    const items = buildActivityItems(mixed(), { density: 'detailed' });
    // read | bash | write | bash — all runs of one, so four single rows.
    expect(items.map((i) => i.type)).toEqual(['tool', 'tool', 'tool', 'tool']);
  });

  test('simple folds any adjacent background work into one line', () => {
    const items = buildActivityItems(mixed(), { density: 'simple' });
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('group');
    if (items[0].type === 'group') {
      expect(items[0].entries).toHaveLength(4);
      expect(items[0].kind).toBe('other'); // mixed
      expect(items[0].counts).toMatchObject({ read: 1, shell: 2, write: 1 });
    }
  });

  test('a run of one is never a group', () => {
    const items = buildActivityItems(wrap([tool('bash')]), { density: 'simple' });
    expect(items.map((i) => i.type)).toEqual(['tool']);
  });
});

describe('buildActivityItems — things that must never be folded away', () => {
  test('a show deliverable stands alone and splits the run around it', () => {
    const items = buildActivityItems(
      wrap([tool('bash'), tool('bash'), tool('show'), tool('bash'), tool('bash')]),
      { density: 'simple' },
    );
    expect(items.map((i) => i.type)).toEqual(['group', 'deliverable', 'group']);
  });

  test('a tool awaiting permission is never swallowed by a group', () => {
    const locked = tool('bash') as ToolPart;
    const items = buildActivityItems(
      wrap([tool('bash'), locked as unknown as Part, tool('bash')]),
      { density: 'simple', lockedCallIds: new Set([locked.callID]) },
    );
    expect(items.map((i) => i.type)).toEqual(['tool', 'tool', 'tool']);
  });

  test('todos and questions pass through to the turn body', () => {
    const items = buildActivityItems(wrap([tool('todowrite'), tool('question')]));
    expect(items.map((i) => i.type)).toEqual(['passthrough', 'passthrough']);
  });

  test('hidden parts are dropped without breaking the run', () => {
    const hidden = tool('bash') as ToolPart;
    const items = buildActivityItems(
      wrap([tool('bash'), hidden as unknown as Part, tool('bash')]),
      { density: 'simple', isHidden: (p) => p.id === hidden.id },
    );
    expect(items).toHaveLength(1);
    if (items[0].type === 'group') expect(items[0].entries).toHaveLength(2);
  });
});

describe('summarizeItems', () => {
  test('counts every step across groups, singles and deliverables', () => {
    const items = buildActivityItems(
      wrap([tool('bash'), tool('bash'), tool('show'), tool('read')]),
      { density: 'simple' },
    );
    const summary = summarizeItems(items);
    expect(summary.totalSteps).toBe(4);
    expect(summary.counts.shell).toBe(2);
    expect(summary.counts.read).toBe(1);
  });

  test('duration spans the whole run, not the sum of its parts', () => {
    const a = tool('bash', { state: { status: 'completed', time: { start: 0, end: 5_000 } } } as Partial<ToolPart>);
    const b = tool('bash', { state: { status: 'completed', time: { start: 4_000, end: 9_000 } } } as Partial<ToolPart>);
    const summary = summarizeItems(buildActivityItems(wrap([a, b])));
    expect(summary.durationMs).toBe(9_000);
  });

  test('running when any step is still in flight', () => {
    const live = tool('bash', { state: { status: 'running' } } as Partial<ToolPart>);
    const summary = summarizeItems(buildActivityItems(wrap([tool('bash'), live])));
    expect(summary.running).toBe(true);
  });
});

describe('formatActivityDuration', () => {
  test('sub-second durations are noise and render as nothing', () => {
    expect(formatActivityDuration(0)).toBe('');
    expect(formatActivityDuration(999)).toBe('');
  });

  test('seconds and minutes', () => {
    expect(formatActivityDuration(4_200)).toBe('4s');
    expect(formatActivityDuration(72_000)).toBe('1m 12s');
    expect(formatActivityDuration(120_000)).toBe('2m');
  });
});

describe('partitionForNarrative — what the shipping default hides', () => {
  const reasoning = (text: string): Part =>
    ({ id: `r-${(seq += 1)}`, type: 'reasoning', text }) as unknown as Part;

  test('a plain run of work folds entirely into one work line', () => {
    const items = buildActivityItems(wrap([tool('bash'), tool('bash'), tool('bash')]), {
      density: 'simple',
    });
    const fold = partitionForNarrative(items);
    expect(fold.entries).toHaveLength(3);
    expect(fold.workLineKey).toBe(items[0].key);
    expect(fold.foldedKeys.has(items[0].key)).toBe(true);
  });

  test('the work line takes the FIRST folded slot, so it keeps its place in the prose', () => {
    // text, then work — the line must land after the paragraph, not above it.
    const items = buildActivityItems(wrap([text('Planning the deck.'), tool('bash'), tool('bash')]), {
      density: 'simple',
    });
    const fold = partitionForNarrative(items);
    expect(items[0].type).toBe('text');
    expect(fold.foldedKeys.has(items[0].key)).toBe(false);
    expect(fold.workLineKey).toBe(items[1].key);
  });

  test('a FAILED step is never folded — a reader must see it without expanding', () => {
    const boom = tool('bash', { state: { status: 'error', error: 'boom' } } as Partial<ToolPart>);
    const items = buildActivityItems(wrap([tool('bash'), boom, tool('bash')]), { density: 'simple' });
    const fold = partitionForNarrative(items);
    const foldedIds = fold.entries.map((e) => e.part.id);
    expect(foldedIds).not.toContain((boom as unknown as ToolPart).id);
  });

  test('a permission-locked step is never folded — approval needs to be legible', () => {
    const locked = tool('bash') as unknown as ToolPart;
    const items = buildActivityItems(wrap([tool('bash'), locked as unknown as Part, tool('bash')]), {
      density: 'simple',
      lockedCallIds: new Set([locked.callID]),
    });
    const fold = partitionForNarrative(items, new Set([locked.callID]));
    expect(fold.entries.map((e) => e.part.id)).not.toContain(locked.id);
  });

  test('a group containing an un-foldable member is not folded AT ALL — no double render', () => {
    // The bug this guards: collecting eagerly then bailing left the same call
    // inside the work line AND inside the group that still had to render.
    const boom = tool('bash', { state: { status: 'error', error: 'boom' } } as Partial<ToolPart>);
    const items = buildActivityItems(wrap([tool('bash'), boom]), { density: 'simple' });
    expect(items[0].type).toBe('group'); // the two are adjacent, so they grouped
    const fold = partitionForNarrative(items);
    expect(fold.foldedKeys.size).toBe(0);
    expect(fold.entries).toHaveLength(0);
  });

  test('reasoning folds in rather than vanishing', () => {
    const items = buildActivityItems(wrap([reasoning('Let me plan this out.'), tool('bash')]), {
      density: 'simple',
    });
    const fold = partitionForNarrative(items);
    expect(fold.reasoningParts.map((p) => p.text)).toEqual(['Let me plan this out.']);
  });

  test('deliverables and passthrough are never folded', () => {
    const items = buildActivityItems(wrap([tool('show'), tool('todowrite'), tool('bash')]), {
      density: 'simple',
    });
    const fold = partitionForNarrative(items);
    for (const item of items) {
      if (item.type === 'deliverable' || item.type === 'passthrough') {
        expect(fold.foldedKeys.has(item.key)).toBe(false);
      }
    }
  });

  test('a turn with nothing foldable yields no work line at all', () => {
    const items = buildActivityItems(wrap([text('Just an answer.')]), { density: 'simple' });
    const fold = partitionForNarrative(items);
    expect(fold.workLineKey).toBeNull();
    expect(fold.entries).toHaveLength(0);
  });
});
