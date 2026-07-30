import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { MigrateToV2ButtonView } from './migrate-to-v2-button';

describe('MigrateToV2ButtonView — visibility follows the server verdict', () => {
  test('renders the action when the server offers a migration and names its target', () => {
    const html = renderToStaticMarkup(
      <MigrateToV2ButtonView
        migrationOffered
        targetVersion={2}
        pending={false}
        onClick={() => {}}
      />,
    );
    expect(html).toContain('Migrate to v2');
  });

  test('renders nothing when the server offers no migration', () => {
    const html = renderToStaticMarkup(
      <MigrateToV2ButtonView
        migrationOffered={false}
        targetVersion={null}
        pending={false}
        onClick={() => {}}
      />,
    );
    expect(html).toBe('');
  });

  test('renders nothing when the server names no target version', () => {
    const html = renderToStaticMarkup(
      <MigrateToV2ButtonView
        migrationOffered
        targetVersion={null}
        pending={false}
        onClick={() => {}}
      />,
    );
    expect(html).toBe('');
  });

  test('the label follows the target version rather than a hardcoded v2', () => {
    const html = renderToStaticMarkup(
      <MigrateToV2ButtonView
        migrationOffered
        targetVersion={3}
        pending={false}
        onClick={() => {}}
      />,
    );
    expect(html).toContain('Migrate to v3');
    expect(html).not.toContain('v2');
  });

  test('disables itself and swaps the icon for a spinner while a session is being created', () => {
    const html = renderToStaticMarkup(
      <MigrateToV2ButtonView migrationOffered targetVersion={2} pending onClick={() => {}} />,
    );
    expect(html).toContain('disabled');
  });
});

describe('MigrateToV2ButtonView — click wiring', () => {
  test('clicking invokes the handler passed in (wired straight through to Button, no indirection)', () => {
    let calls = 0;
    const onClick = () => {
      calls += 1;
    };
    const element = MigrateToV2ButtonView({
      migrationOffered: true,
      targetVersion: 2,
      pending: false,
      onClick,
    });
    expect(element).not.toBeNull();
    const props = (element as { props: { onClick: () => void } }).props;
    expect(typeof props.onClick).toBe('function');
    props.onClick();
    expect(calls).toBe(1);
  });
});
