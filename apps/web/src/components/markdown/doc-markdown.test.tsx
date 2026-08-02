import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, test } from 'bun:test';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { DocMarkdown } from './doc-markdown';

function withIntl(node: ReactNode) {
  return (
    <NextIntlClientProvider locale="en" messages={{}} onError={() => {}}>
      {node}
    </NextIntlClientProvider>
  );
}

const TABLE_MD = ['| Priority | Name |', '| --- | --- |', '| High | G1 |', ''].join('\n');

function cellClasses(html: string, tag: 'th' | 'td'): string[] {
  const matches = [...html.matchAll(new RegExp(`<${tag} class="([^"]*)"`, 'g'))];
  return matches.map((m) => m[1]);
}

describe('DocMarkdown table cells', () => {
  test('th carries whitespace-nowrap and break-normal', () => {
    const html = renderToStaticMarkup(withIntl(<DocMarkdown content={TABLE_MD} />));
    const classes = cellClasses(html, 'th');

    expect(classes.length).toBeGreaterThan(0);
    for (const cls of classes) {
      expect(cls).toContain('whitespace-nowrap');
      expect(cls).toContain('break-normal');
    }
  });

  test('td carries break-normal', () => {
    const html = renderToStaticMarkup(withIntl(<DocMarkdown content={TABLE_MD} />));
    const classes = cellClasses(html, 'td');

    expect(classes.length).toBeGreaterThan(0);
    for (const cls of classes) {
      expect(cls).toContain('break-normal');
    }
  });
});
