import type { ToolPart } from '@/ui';
import { describe, expect, test } from 'bun:test';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ContextItem } from '../shared/derive-panels';
import { ContextCard } from './context-card';
import type { Detail } from './detail-view';

const web: ContextItem[] = [
  { callID: 'w1', label: 'Kortix docs', kind: 'web', url: 'https://kortix.com/docs' },
];
const files: ContextItem[] = [
  { callID: 'f1', label: 'report.md', kind: 'file', path: 'report.md' },
];
const tools: ContextItem[] = [
  {
    callID: 't1',
    label: 'Terminal',
    kind: 'tool',
    parts: [
      { type: 'tool', tool: 'bash', callID: 't1', state: { status: 'completed' } },
    ] as unknown as ToolPart[],
  },
];

/** One tool row whose calls are a mix of success and failure — the W7 case:
 *  `deriveContext` only DROPS a fully-errored call, so a tool that succeeded
 *  nine times and failed once still reaches this row with `state.status ===
 *  'error'` sitting among its `parts`. */
const toolsWithAFailedCall: ContextItem[] = [
  {
    callID: 't1',
    label: 'Terminal',
    kind: 'tool',
    parts: [
      { type: 'tool', tool: 'bash', callID: 't1a', state: { status: 'completed' } },
      { type: 'tool', tool: 'bash', callID: 't1b', state: { status: 'error' } },
    ] as unknown as ToolPart[],
  },
];

/**
 * The card's body, straight out of the element tree.
 *
 * A whole-card render shows the header and an empty box: the rows sit inside a
 * `PanelCard` that starts collapsed, and a collapsed `DisclosureContent`
 * renders none of its children. Reaching for `PanelCard`'s `children` gets the
 * same elements with the same classes, minus the disclosure that swallows them.
 *
 * This calls `ContextCard` directly as a plain function rather than mounting
 * it — safe only because `ContextCard` holds no hooks of its own. If it ever
 * gains one (local state, an effect), this harness stops being valid and has
 * to switch to real rendering (e.g. `@testing-library/react`) instead.
 */
function cardBody(
  onOpenDetail: (detail: Detail) => void = () => {},
  onOpenFile: (path: string, allPaths: string[]) => void = () => {},
  items: { files: ContextItem[]; web: ContextItem[]; tools: ContextItem[] } = { files, web, tools },
): ReactNode {
  const card = ContextCard({ ...items, sessionId: 's1', onOpenDetail, onOpenFile });
  return (card as ReactElement<{ children?: ReactNode }>).props.children;
}

/** The opening tag of every `<button>` in the rendered body, in document order. */
function buttonTags(html: string): string[] {
  return [...html.matchAll(/<button[^>]*>/g)].map((m) => m[0]);
}

/**
 * A group row's markup, minus its count `Badge`.
 *
 * The count badge is a legitimate `rounded-full` control (see `badge.tsx`'s
 * `badgeVariants`), so a check for "no pill in this row" has to look past it —
 * otherwise the only way to pass is to literally never render a badge. Every
 * row DOES currently have one, so scanning the row's own opening tag alone
 * (as this test used to) happened to dodge the badge without ever proving the
 * row overall was pill-free: a `rounded-full` reintroduced anywhere else in
 * the row — a wrapping `<li>`, an icon tile, the label span — would pass
 * silently as long as it never touched the `<button>` tag's own class.
 */
function withoutBadgeMarkup(html: string): string {
  return html.replace(/<span data-slot="badge"[^>]*>.*?<\/span>/g, '');
}

/**
 * Every host `<button>` element in an unrendered React tree, in document order.
 *
 * A row's click contract can't be reached through static markup — it has no
 * handlers, and this runner has no DOM to dispatch into. Calling the row
 * element's own `onClick` exercises the exact prop the real button carries,
 * which is all a tap ever reaches.
 */
function buttonsIn(node: ReactNode, found: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(node)) {
    for (const child of node) buttonsIn(child, found);
    return found;
  }
  if (!isValidElement(node)) return found;
  const element = node as ReactElement<{ children?: ReactNode }>;
  if (element.type === 'button') found.push(element);
  buttonsIn(element.props.children, found);
  return found;
}

describe('ContextCard groups are rows, not pills (W1)', () => {
  test('every group control is a full-width row button, never a pill', () => {
    const html = renderToStaticMarkup(<>{cardBody()}</>);
    const tags = buttonTags(html);
    expect(tags).toHaveLength(3); // one per group
    for (const tag of tags) {
      expect(tag).toContain('w-full');
    }
    // Over the FULL rendered markup of the group list (R8 #1) — not just each
    // button's own opening tag, which a stray pill elsewhere in the row could
    // dodge entirely. See `withoutBadgeMarkup` for why the count badge is
    // excluded first.
    expect(withoutBadgeMarkup(html)).not.toContain('rounded-full');
  });

  test('a tool row with one failed call among successes shows the error glyph (W7, R8 #2)', () => {
    const html = renderToStaticMarkup(
      <>{cardBody(undefined, undefined, { files: [], web: [], tools: toolsWithAFailedCall })}</>,
    );
    // `StepIcon` (step-icon.tsx) marks `status: 'error'` with `text-kortix-red`
    // and everything else with `text-muted-foreground` — the only glyph in
    // this render is the Terminal row's, so this pins the aggregation in
    // `context-card.tsx` (one failed call among several still reads as failed)
    // rather than the per-call status of whichever call happens to be first.
    expect(html).toContain('text-kortix-red');
  });

  test('the rows keep a stable order: web, then files, then tools', () => {
    const html = renderToStaticMarkup(<>{cardBody()}</>);
    expect(html).toContain('Web sources');
    expect(html.indexOf('Web sources')).toBeLessThan(html.indexOf('Files read'));
    expect(html.indexOf('Files read')).toBeLessThan(html.indexOf('Terminal'));
  });

  test('a row opens that group in the detail layer', () => {
    const opened: Detail[] = [];
    const rows = buttonsIn(cardBody((detail) => opened.push(detail)));
    expect(rows).toHaveLength(3);

    for (const row of rows) {
      (row.props as { onClick?: () => void }).onClick?.();
    }

    expect(opened.map((d) => d.key)).toEqual(['web', 'files', 't1']);
    expect(opened.map((d) => d.title)).toEqual(['Web sources', 'Files read', 'Terminal']);
  });
});

describe('"Files read" rows open the file viewer (Task 3)', () => {
  // A pathless item ('notes.txt') sits between two real files — real, per
  // `deriveContext`'s `label: getToolPrimaryArg(part) || path`, whenever a
  // `read` call's path is unresolvable; it must stay inert while the others
  // open, and it must not appear in the ordered path list either.
  const filesWithAGap: ContextItem[] = [
    { callID: 'f1', label: 'report.md', kind: 'file', path: 'report.md' },
    { callID: 'f2', label: 'notes.txt', kind: 'file' },
    { callID: 'f3', label: 'summary.pdf', kind: 'file', path: 'docs/summary.pdf' },
  ];

  test('a file row calls onOpenFile with its own path and the ordered path list; a pathless row stays inert', () => {
    const calls: Array<{ path: string; allPaths: string[] }> = [];
    const opened: Detail[] = [];
    const onOpenFile = (path: string, allPaths: string[]) => calls.push({ path, allPaths });

    const rows = buttonsIn(
      cardBody(
        (detail) => opened.push(detail),
        onOpenFile,
        { files: filesWithAGap, web: [], tools: [] },
      ),
    );
    expect(rows).toHaveLength(1); // one group row: "Files read"
    (rows[0].props as { onClick?: () => void }).onClick?.();

    const filesDetail = opened.find((d) => d.key === 'files');
    expect(filesDetail).toBeDefined();

    // `FileList`'s body is an unrendered `<FileList items={...} onOpenFile={...}
    // />` element — invoking its own `type` with its own `props` calls the
    // component the exact same way `cardBody` calls `ContextCard`: directly,
    // as a plain function. Same harness limitation applies (see `cardBody`).
    const bodyEl = filesDetail!.body as ReactElement<{
      items: ContextItem[];
      onOpenFile: (path: string, allPaths: string[]) => void;
    }>;
    const list = (bodyEl.type as (p: typeof bodyEl.props) => ReactNode)(bodyEl.props);

    const fileRowButtons = buttonsIn(list);
    // Only the two rows with a real path get button semantics — the
    // pathless 'notes.txt' row is skipped entirely.
    expect(fileRowButtons).toHaveLength(2);

    for (const btn of fileRowButtons) {
      (btn.props as { onClick?: () => void }).onClick?.();
    }

    expect(calls).toEqual([
      { path: 'report.md', allPaths: ['report.md', 'docs/summary.pdf'] },
      { path: 'docs/summary.pdf', allPaths: ['report.md', 'docs/summary.pdf'] },
    ]);

    // The pathless item still renders — just never as a button.
    const html = renderToStaticMarkup(<>{list}</>);
    expect(html).toContain('notes.txt');
    expect(buttonTags(html)).toHaveLength(2);
  });
});
