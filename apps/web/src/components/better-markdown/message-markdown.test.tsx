import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { MessageMarkdown } from './message-markdown';

const TABLE_MD = ['| Priority | Name |', '| --- | --- |', '| High | G1 |', ''].join('\n');

function cellClasses(html: string, tag: 'th' | 'td'): string[] {
  const matches = [...html.matchAll(new RegExp(`<${tag} class="([^"]*)"`, 'g'))];
  return matches.map((m) => m[1]);
}

describe('MessageMarkdown table cells', () => {
  test('th carries whitespace-nowrap and break-normal', () => {
    const html = renderToStaticMarkup(<MessageMarkdown content={TABLE_MD} />);
    const classes = cellClasses(html, 'th');

    expect(classes.length).toBeGreaterThan(0);
    for (const cls of classes) {
      expect(cls).toContain('whitespace-nowrap');
      expect(cls).toContain('break-normal');
    }
  });

  test('td carries break-normal', () => {
    const html = renderToStaticMarkup(<MessageMarkdown content={TABLE_MD} />);
    const classes = cellClasses(html, 'td');

    expect(classes.length).toBeGreaterThan(0);
    for (const cls of classes) {
      expect(cls).toContain('break-normal');
    }
  });
});
