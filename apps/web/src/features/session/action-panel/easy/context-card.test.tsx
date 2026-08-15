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

/**
 * The card's body, straight out of the element tree.
 *
 * A whole-card render shows the header and an empty box: the rows sit inside a
 * `PanelCard` that starts collapsed, and a collapsed `DisclosureContent`
 * renders none of its children. Reaching for `PanelCard`'s `children` gets the
 * same elements with the same classes, minus the disclosure that swallows them.
 */
function cardBody(onOpenDetail: (detail: Detail) => void = () => {}): ReactNode {
  const card = ContextCard({ files, web, tools, sessionId: 's1', onOpenDetail });
  return (card as ReactElement<{ children?: ReactNode }>).props.children;
}

/** The opening tag of every `<button>` in the rendered body, in document order. */
function buttonTags(html: string): string[] {
  return [...html.matchAll(/<button[^>]*>/g)].map((m) => m[0]);
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
    const tags = buttonTags(renderToStaticMarkup(<>{cardBody()}</>));
    expect(tags).toHaveLength(3); // one per group
    for (const tag of tags) {
      expect(tag).not.toContain('rounded-full');
      expect(tag).toContain('w-full');
    }
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
