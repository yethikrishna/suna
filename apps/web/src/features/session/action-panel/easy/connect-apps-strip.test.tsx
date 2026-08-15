import { beforeEach, describe, expect, test } from 'bun:test';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { Button } from '@/components/ui/button';
import { useConnectorGateStore } from '@/stores/connector-gate-store';
import { ConnectAppsStrip, DEFAULT_CONNECTORS } from './connect-apps-strip';

/**
 * `ConnectAppsStrip` holds no hooks of its own (see its header comment on
 * why the gate action is read via `getState()` rather than the
 * `useConnectorGateStore(selector)` hook), so — same as `ContextCard`'s
 * `cardBody` in `context-card.test.tsx` — it can be called directly as a
 * plain function and its returned element tree walked without a DOM.
 */
function strip(projectId: string | undefined): ReactNode {
  return ConnectAppsStrip({ projectId });
}

/**
 * Every `<Button>` element in an unrendered React tree, in document order.
 *
 * Unlike `context-card.test.tsx`'s `buttonsIn` (which matches raw host
 * `<button>` elements), every clickable control here is the `Button` UI
 * component, so `element.type` is that function, never the string
 * `'button'` — matched by identity against the same import this test uses.
 */
function buttonsIn(node: ReactNode, found: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(node)) {
    for (const child of node) buttonsIn(child, found);
    return found;
  }
  if (!isValidElement(node)) return found;
  const element = node as ReactElement<{ children?: ReactNode }>;
  if (element.type === Button) found.push(element);
  buttonsIn(element.props.children, found);
  return found;
}

beforeEach(() => {
  useConnectorGateStore.setState({
    isOpen: false,
    projectId: null,
    connectorConnections: [],
    retry: null,
  });
});

describe('ConnectAppsStrip', () => {
  test('renders nothing without a projectId', () => {
    expect(strip(undefined)).toBeNull();
  });

  test('renders one row per default connector, plus the View all control', () => {
    const html = renderToStaticMarkup(<>{strip('proj-1')}</>);
    for (const connector of DEFAULT_CONNECTORS) {
      expect(html).toContain(connector.name);
      expect(html).toContain(connector.value);
    }
    // One real host <button> per "Connect" row. "View all" is `Button
    // asChild` over a `<Link>` — it renders straight through to the link's
    // own `<a>`, so it contributes zero host `<button>` tags here.
    expect(html.match(/<button[^>]*>/g)).toHaveLength(DEFAULT_CONNECTORS.length);
  });

  test('Connect opens the gate for exactly that one connector, project-owned, with a no-op retry', () => {
    const tree = strip('proj-1');
    // Every `<Button>` in the tree, filtered to the ones that carry an
    // `onClick` — "Connect" rows, never the `asChild` "View all" control,
    // which has none (its click is the plain `<Link>` navigation).
    const connectButtons = buttonsIn(tree).filter(
      (b) => typeof (b.props as { onClick?: unknown }).onClick === 'function',
    );
    expect(connectButtons).toHaveLength(DEFAULT_CONNECTORS.length);

    const gmailIndex = DEFAULT_CONNECTORS.findIndex((c) => c.slug === 'gmail');
    (connectButtons[gmailIndex].props as { onClick?: () => void }).onClick?.();

    const state = useConnectorGateStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.projectId).toBe('proj-1');
    // Exactly one connector — the clicked row's, not the whole default
    // list — is what makes this "in place, no navigation" (task brief).
    expect(state.connectorConnections).toEqual([
      { id: 'gmail', slug: 'gmail', name: 'Gmail', authorization_strategy: 'project' },
    ]);
    expect(state.retry).not.toBeNull();
    expect(() => state.retry?.()).not.toThrow();
  });

  test('View all links to the canonical connectors route, never a ?section= deep link', () => {
    const html = renderToStaticMarkup(<>{strip('proj-42')}</>);
    expect(html).toContain('href="/projects/proj-42/connectors"');
    expect(html).not.toContain('section=');
  });
});
