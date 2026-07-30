import { describe, expect, test } from 'bun:test';

import type { ProjectManifestVerdict } from '@kortix/sdk';

import { manifestScopeLabel, manifestUpgradeState } from './manifest-version';

function verdict(over: Partial<ProjectManifestVerdict>): ProjectManifestVerdict {
  return {
    version: null,
    latest_version: 3,
    migration_offered: false,
    target_version: null,
    unknown_reason: null,
    path: null,
    ...over,
  };
}

describe('manifestUpgradeState — a v3 project is up to date', () => {
  test('offers no migration and exposes no target version', () => {
    const state = manifestUpgradeState({
      manifest_version: verdict({ version: 3, path: 'kortix.yaml' }),
    });

    expect(state.migrationOffered).toBe(false);
    expect(state.targetVersion).toBeNull();
    expect(state.version).toBe(3);
    expect(state.manifestFilename).toBe('kortix.yaml');
  });
});

describe('manifestUpgradeState — a real v1 kortix.toml is offered a migration', () => {
  test('offers the migration the server named, with the server target version', () => {
    const state = manifestUpgradeState({
      manifest_version: verdict({
        version: 1,
        migration_offered: true,
        target_version: 2,
        path: 'kortix.toml',
      }),
    });

    expect(state.migrationOffered).toBe(true);
    expect(state.targetVersion).toBe(2);
    expect(state.version).toBe(1);
    expect(state.manifestFilename).toBe('kortix.toml');
  });
});

describe('manifestUpgradeState — unknown renders nothing', () => {
  test('every unknown reason offers no migration', () => {
    for (const reason of ['unreadable', 'unparsable', 'undeclared', 'restricted'] as const) {
      const state = manifestUpgradeState({ manifest_version: verdict({ unknown_reason: reason }) });
      expect(state.migrationOffered).toBe(false);
      expect(state.targetVersion).toBeNull();
      expect(state.version).toBeNull();
    }
  });

  test('an absent config or verdict offers no migration', () => {
    expect(manifestUpgradeState(undefined).migrationOffered).toBe(false);
    expect(manifestUpgradeState(null).migrationOffered).toBe(false);
    expect(manifestUpgradeState({}).migrationOffered).toBe(false);
    expect(manifestUpgradeState({}).version).toBeNull();
    expect(manifestUpgradeState({}).manifestFilename).toBeNull();
  });
});

describe('manifestUpgradeState — declarative-config surfaces', () => {
  test('a v2-or-newer manifest is the governance-first shape', () => {
    expect(
      manifestUpgradeState({ manifest_version: verdict({ version: 2 }) }).isGovernanceFirst,
    ).toBe(true);
    expect(
      manifestUpgradeState({ manifest_version: verdict({ version: 3 }) }).isGovernanceFirst,
    ).toBe(true);
  });

  test('a v1 manifest is not, and neither is an unknown one', () => {
    expect(
      manifestUpgradeState({ manifest_version: verdict({ version: 1 }) }).isGovernanceFirst,
    ).toBe(false);
    expect(manifestUpgradeState({}).isGovernanceFirst).toBe(false);
  });
});

describe('manifest-version module no longer infers a version client-side', () => {
  test('the removed detectManifestVersion export cannot drift back', async () => {
    const mod = (await import('./manifest-version')) as Record<string, unknown>;
    expect('detectManifestVersion' in mod).toBe(false);
  });
});

describe('manifestScopeLabel — names the real manifest shape, never a guess', () => {
  test('a v3 manifest is labelled with the file it actually reads and the map shape', () => {
    const state = manifestUpgradeState({
      manifest_version: verdict({ version: 3, path: 'kortix.yaml' }),
    });
    expect(manifestScopeLabel(state)).toBe('kortix.yaml agents:');
  });

  test('a v2 manifest gets the same map shape', () => {
    const state = manifestUpgradeState({
      manifest_version: verdict({ version: 2, path: 'kortix.yaml' }),
    });
    expect(manifestScopeLabel(state)).toBe('kortix.yaml agents:');
  });

  test('a v1 manifest gets the legacy array-of-tables shape', () => {
    const state = manifestUpgradeState({
      manifest_version: verdict({ version: 1, path: 'kortix.toml' }),
    });
    expect(manifestScopeLabel(state)).toBe('kortix.toml [[agents]]');
  });

  test('an unknown manifest is labelled with nothing at all', () => {
    expect(manifestScopeLabel(manifestUpgradeState({}))).toBeNull();
    expect(
      manifestScopeLabel(manifestUpgradeState({ manifest_version: verdict({ version: null }) })),
    ).toBeNull();
  });

  test('a nested manifest path is labelled by its filename only', () => {
    const state = manifestUpgradeState({
      manifest_version: verdict({ version: 3, path: 'config/kortix.yml' }),
    });
    expect(manifestScopeLabel(state)).toBe('kortix.yml agents:');
  });
});
