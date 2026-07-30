import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import type { ManifestUpgradeState } from './manifest-version';
import { UpgradesViewContent } from './upgrade-view';

const OFFERED_V2: ManifestUpgradeState = {
  version: 1,
  migrationOffered: true,
  targetVersion: 2,
  isGovernanceFirst: false,
  manifestFilename: 'kortix.toml',
};

const UP_TO_DATE_V3: ManifestUpgradeState = {
  version: 3,
  migrationOffered: false,
  targetVersion: null,
  isGovernanceFirst: true,
  manifestFilename: 'kortix.yaml',
};

const UNKNOWN: ManifestUpgradeState = {
  version: null,
  migrationOffered: false,
  targetVersion: null,
  isGovernanceFirst: false,
  manifestFilename: null,
};

describe('UpgradesViewContent — per-state rendering', () => {
  test('an offered migration lists the manifest upgrade with a Run action, plus the one-off runner', () => {
    const html = renderToStaticMarkup(
      <UpgradesViewContent upgrade={OFFERED_V2} onRun={() => {}} pending={false} canWrite />,
    );
    expect(html).toContain('Upgrades');
    expect(html).toContain('Migrate manifest to v2');
    expect(html).toContain('Run');
    // Applicable upgrades are surfaced as a highlighted, recommended action.
    expect(html).toContain('Recommended');
    expect(html).toContain('One-off upgrade');
    expect(html).not.toContain('up to date');
  });

  test('a v3 project shows the up-to-date empty state but keeps the one-off runner available', () => {
    const html = renderToStaticMarkup(
      <UpgradesViewContent upgrade={UP_TO_DATE_V3} onRun={() => {}} pending={false} canWrite />,
    );
    expect(html).toContain('up to date');
    expect(html).not.toContain('Migrate manifest to v2');
    // No applicable upgrade ⇒ no recommended-action highlight.
    expect(html).not.toContain('Recommended');
    expect(html).toContain('One-off upgrade');
  });

  test('unresolved manifest read renders placeholders — no upgrade rows, no premature up-to-date claim', () => {
    const html = renderToStaticMarkup(
      <UpgradesViewContent upgrade={null} onRun={() => {}} pending={false} canWrite />,
    );
    expect(html).not.toContain('Migrate manifest to v2');
    expect(html).not.toContain('up to date');
  });

  test('an unknown manifest claims nothing — no upgrade row AND no up-to-date claim', () => {
    const html = renderToStaticMarkup(
      <UpgradesViewContent upgrade={UNKNOWN} onRun={() => {}} pending={false} canWrite />,
    );
    expect(html).not.toContain('Migrate manifest to v2');
    expect(html).not.toContain('up to date');
  });

  test('run buttons disable while a session is being created', () => {
    const html = renderToStaticMarkup(
      <UpgradesViewContent upgrade={OFFERED_V2} onRun={() => {}} pending canWrite />,
    );
    expect(html).toContain('disabled');
  });

  test('read-only (no write) hides the Run action and the one-off runner but keeps the explanation', () => {
    const html = renderToStaticMarkup(
      <UpgradesViewContent
        upgrade={OFFERED_V2}
        onRun={() => {}}
        pending={false}
        canWrite={false}
      />,
    );
    // Section + upgrade row still render (data stays visible)…
    expect(html).toContain('Upgrades');
    expect(html).toContain('Migrate manifest to v2');
    expect(html).toContain('One-off upgrade');
    // …but the mutating "Run upgrade" control is gone.
    expect(html).not.toContain('Run upgrade');
  });
});
