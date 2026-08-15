import type { ToolPart } from '@/ui';
import { describe, expect, test } from 'bun:test';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryTool, memoryToolTitle } from './memory-tool';

/**
 * The contract this file pins (spec W8).
 *
 * The memory row used to say "Memory" and nothing else: the subtitle was
 * commented out, so `onSubtitleClick` — the way into the memory file — was
 * wired to an element that never rendered, and one fixed title covered six
 * commands. A reader could not tell a write from a read, and could not see
 * WHICH memory file either one touched.
 *
 * Now the title reports what happened and the subtitle names the target.
 *
 * The harness renders to static markup (this app has no DOM in tests), so the
 * assertions are anchored to the trigger's own elements: the title is the
 * trigger's leading span, the subtitle is the span carrying the same text in a
 * native `title` attribute. A bare `toContain('Memory updated')` would pass on
 * a row whose title had moved into the body.
 *
 * Rows are rendered COLLAPSED, so nothing from the tool body can satisfy a
 * trigger assertion by accident.
 */

function withProviders(node: ReactNode) {
  return (
    <NextIntlClientProvider locale="en" messages={{ hardcodedUi: {} }} onError={() => {}}>
      {node}
    </NextIntlClientProvider>
  );
}

function memoryPart(input: Record<string, unknown>, output = ''): ToolPart {
  return {
    id: 'p1',
    type: 'tool',
    tool: 'memory',
    callID: 'call-1',
    state: { status: 'completed', input, output, metadata: {}, time: { start: 1, end: 2 } },
  } as unknown as ToolPart;
}

const render = (part: ToolPart) => renderToStaticMarkup(withProviders(<MemoryTool part={part} />));

describe('memoryToolTitle', () => {
  test('every command that CHANGES memory reads as an update', () => {
    for (const command of ['create', 'insert', 'str_replace', 'rename', 'delete']) {
      expect(memoryToolTitle(command)).toBe('Memory updated');
    }
  });

  test('view is the one read', () => {
    expect(memoryToolTitle('view')).toBe('Memory read');
  });

  test('an unknown or not-yet-streamed command falls back to the bare noun', () => {
    // A half-streamed call has no `command` yet. Guessing a verb here would
    // announce a write that may turn out to be a read.
    expect(memoryToolTitle('')).toBe('Memory');
    expect(memoryToolTitle('some_future_command')).toBe('Memory');
  });
});

describe('MemoryTool — the trigger says what happened, and to what', () => {
  test('a write titles itself an update and names the file it wrote', () => {
    const markup = render(
      memoryPart({ command: 'str_replace', path: '.kortix/memory/notes/deploy.md' }),
    );

    expect(markup).toContain('>Memory updated</span>');
    // The subtitle element, not the string anywhere: it carries the same text
    // as its native tooltip because the row truncates.
    expect(markup).toContain('title="notes/deploy.md">notes/deploy.md</span>');
  });

  test('a read titles itself a read', () => {
    const markup = render(memoryPart({ command: 'view', path: '.kortix/memory/notes/deploy.md' }));

    expect(markup).toContain('>Memory read</span>');
    expect(markup).not.toContain('>Memory updated</span>');
    expect(markup).toContain('title="notes/deploy.md">notes/deploy.md</span>');
  });

  test('a rename is named by its DESTINATION, not by the name that is gone', () => {
    const markup = render(
      memoryPart({
        command: 'rename',
        old_path: '.kortix/memory/draft.md',
        new_path: '.kortix/memory/notes/final.md',
      }),
    );

    expect(markup).toContain('>Memory updated</span>');
    expect(markup).toContain('title="notes/final.md">notes/final.md</span>');
    expect(markup).not.toContain('title="draft.md"');
  });

  test('a rename whose destination has not streamed in yet shows the source', () => {
    // `new_path` arrives separately. An empty subtitle would drop the one thing
    // the row can still truthfully say.
    const markup = render(memoryPart({ command: 'rename', old_path: '.kortix/memory/draft.md' }));

    expect(markup).toContain('title="draft.md">draft.md</span>');
  });

  test('viewing the memory root shows no subtitle — it would only repeat the title', () => {
    // `memoryRelPath` answers 'memory' for the root itself, which as a subtitle
    // reads "Memory read · memory".
    const markup = render(
      memoryPart(
        { command: 'view', path: '.kortix/memory' },
        'files and directories in .kortix/memory:\n120\t.kortix/memory/notes.md',
      ),
    );

    expect(markup).toContain('>Memory read</span>');
    expect(markup).not.toContain('>memory</span>');
  });

  test('a call with no command and no path is still a titled row, never blank', () => {
    const markup = render(memoryPart({}));

    expect(markup).toContain('>Memory</span>');
  });

  test('the row is collapsed — none of the above came from the body', () => {
    const markup = render(
      memoryPart({ command: 'create', path: '.kortix/memory/notes.md', file_text: 'remember me' }),
    );

    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain('remember me');
  });
});
