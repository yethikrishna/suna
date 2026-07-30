import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { SidebarProvider } from '@/components/ui/sidebar';
import { ProjectManifestUpgradeAlertView } from './project-manifest-upgrade-alert';

function render(props: {
  migrationOffered: boolean;
  targetVersion: number | null;
  currentVersion?: number | null;
  manifestFilename?: string | null;
  pending?: boolean;
  onMigrate?: () => void;
  defaultOpen?: boolean;
}) {
  return renderToStaticMarkup(
    <SidebarProvider defaultOpen>
      <ProjectManifestUpgradeAlertView
        currentVersion={props.currentVersion ?? 1}
        manifestFilename={props.manifestFilename ?? 'kortix.toml'}
        pending={props.pending ?? false}
        onMigrate={props.onMigrate ?? (() => {})}
        migrationOffered={props.migrationOffered}
        targetVersion={props.targetVersion}
        defaultOpen={props.defaultOpen}
      />
    </SidebarProvider>,
  );
}

describe('ProjectManifestUpgradeAlertView — renders only when the server offers a migration', () => {
  test('renders nothing when the server offers no migration', () => {
    const html = render({ migrationOffered: false, targetVersion: null, currentVersion: 3 });
    expect(html).not.toContain('Upgrade to v');
    expect(html).not.toContain('sidebar-menu-item');
  });

  test('renders nothing when the server offers a migration but names no target version', () => {
    const html = render({ migrationOffered: true, targetVersion: null });
    expect(html).not.toContain('Upgrade to v');
    expect(html).not.toContain('sidebar-menu-item');
  });

  test('renders the trigger when the server offers a migration with a target version', () => {
    const html = render({ migrationOffered: true, targetVersion: 2 });
    expect(html).toContain('Upgrade to v2');
  });
});

describe('ProjectManifestUpgradeAlertView — copy follows the server target version', () => {
  test('a v3 target never renders a v2 string', () => {
    const html = render({
      migrationOffered: true,
      targetVersion: 3,
      currentVersion: 2,
      manifestFilename: 'kortix.yaml',
      defaultOpen: true,
    });
    expect(html).toContain('Upgrade to v3');
    expect(html).toContain('Migrate to v3');
    expect(html).not.toContain('Upgrade to v2');
    expect(html).not.toContain('Migrate to v2');
    expect(html).toContain('governance-first v3');
  });

  test('a v2 target renders v2 and names the current version and the file it read', () => {
    const html = render({
      migrationOffered: true,
      targetVersion: 2,
      currentVersion: 1,
      manifestFilename: 'kortix.toml',
      defaultOpen: true,
    });
    expect(html).toContain('Upgrade to v2');
    expect(html).toContain('Migrate to v2');
    expect(html).toContain('kortix.toml');
    expect(html).toContain('runs the v1 manifest');
    expect(html).not.toContain('Migrate to v3');
    expect(html).not.toContain('governance-first v3');
  });
});

describe('ProjectManifestUpgradeAlertView — pending state', () => {
  test('disables the migrate action while the session is being created', () => {
    const html = render({
      migrationOffered: true,
      targetVersion: 2,
      pending: true,
      defaultOpen: true,
    });
    expect(html).toContain('disabled=""');
  });

  test('the migrate button is wired to the handler passed in', () => {
    let calls = 0;
    const onMigrate = () => {
      calls += 1;
    };
    const html = render({
      migrationOffered: true,
      targetVersion: 2,
      onMigrate,
      defaultOpen: true,
    });
    expect(html).toContain('Migrate to v2');
    onMigrate();
    expect(calls).toBe(1);
  });
});
