/**
 * The harness-selection contract, driven end to end over the REAL starter
 * templates: template files -> kortix.yaml -> compileRuntimeConfig -> the
 * operator gate that createProjectSession consults before it persists
 * `runtime_harness`.
 *
 * The two properties worth locking:
 *   1. The stable starter can only ever resolve `opencode`. There is no input
 *      to it that yields claude, codex, or pi.
 *   2. The experimental starter DECLARES all four harnesses, and the platform
 *      still refuses three of them until an operator opts in — the manifest is
 *      an input, never an authority.
 */
import { describe, expect, test } from 'bun:test';
import {
  EXPERIMENTAL_STARTER_TEMPLATE_ID,
  STABLE_STARTER_TEMPLATE_ID,
  getStarterFiles,
} from '@kortix/starter';

import { compileRuntimeConfig } from '../projects/lib/compile-runtime-config';
import {
  enabledHarnessIds,
  harnessNotEnabledError,
  isHarnessEnabled,
} from '../projects/lib/harness-gate';
import { resolveManifestVerdict } from '../projects/lib/manifest-verdict';
import { parseManifestString } from '../projects/triggers';

const EVERY_HARNESS = 'opencode,claude,codex,pi';

function compiledFor(template: string) {
  const files = getStarterFiles({
    projectName: 'Acme Co',
    repoFullName: 'kortix/acme-co',
    template: template as never,
  });
  const manifestFile = files.find((f) => f.path === 'kortix.yaml');
  if (!manifestFile) throw new Error(`starter "${template}" scaffolds no kortix.yaml`);
  const parsed = parseManifestString(manifestFile.content, 'yaml', 'kortix.yaml');
  const compiled = compileRuntimeConfig(parsed.raw);
  if (!compiled) throw new Error(`starter "${template}" produced no runtime config`);
  return { compiled, manifest: manifestFile.content };
}

describe('stable starter — the harness chain can only land on opencode', () => {
  const { compiled } = compiledFor(STABLE_STARTER_TEMPLATE_ID);

  test('compiles a single kortix_version 2 opencode runtime profile', () => {
    expect(compiled.version).toBe(2);
    expect(Object.values(compiled.runtimes).map((r) => r.harness)).toEqual(['opencode']);
  });

  test('every declared agent resolves to opencode', () => {
    expect([...new Set(Object.values(compiled.agents).map((a) => a.harness))]).toEqual([
      'opencode',
    ]);
  });

  test('the default agent is declared, enabled, and on opencode', () => {
    expect(compiled.agents[compiled.defaultAgent]).toMatchObject({
      enabled: true,
      harness: 'opencode',
    });
  });

  test('its harness passes the gate on a default deployment', () => {
    for (const agent of Object.values(compiled.agents)) {
      expect(isHarnessEnabled(agent.harness, '')).toBe(true);
    }
  });

  test('it cannot silently resolve claude, codex, or pi even with the gate wide open', () => {
    const harnesses = new Set(Object.values(compiled.agents).map((a) => a.harness));
    for (const harness of ['claude', 'codex', 'pi']) {
      expect(harnesses.has(harness as never)).toBe(false);
    }
    expect(enabledHarnessIds(EVERY_HARNESS)).toContain('claude');
  });

  test('a v2 stable project is NOT told to migrate', () => {
    const { manifest } = compiledFor(STABLE_STARTER_TEMPLATE_ID);
    const verdict = resolveManifestVerdict({ raw: manifest, format: 'yaml', path: 'kortix.yaml' });

    expect(verdict.version).toBe(2);
    expect(verdict.migration_offered).toBe(false);
    expect(verdict.target_version).toBeNull();
    expect(verdict.unknown_reason).toBeNull();
  });
});

describe('experimental starter — declared by the manifest, gated by the operator', () => {
  const { compiled } = compiledFor(EXPERIMENTAL_STARTER_TEMPLATE_ID);

  test('compiles kortix_version 3 with all four harnesses declared', () => {
    expect(compiled.version).toBe(3);
    expect(
      Object.values(compiled.runtimes)
        .map((r) => r.harness)
        .sort(),
    ).toEqual(['claude', 'codex', 'opencode', 'pi']);
  });

  test('its default agent is still opencode, so the default session is stable', () => {
    expect(compiled.agents[compiled.defaultAgent]).toMatchObject({ harness: 'opencode' });
  });

  test('an experimental harness requires an explicit operator opt-in', () => {
    for (const harness of ['claude', 'codex', 'pi']) {
      expect(isHarnessEnabled(harness, '')).toBe(false);
      expect(isHarnessEnabled(harness, EVERY_HARNESS)).toBe(true);
    }
  });

  test('the kill switch closes again without touching the manifest', () => {
    expect(isHarnessEnabled('pi', EVERY_HARNESS)).toBe(true);
    expect(isHarnessEnabled('pi', 'opencode,claude')).toBe(false);
    expect(isHarnessEnabled('opencode', 'opencode,claude')).toBe(true);
  });

  test('every declared non-opencode agent is refused by name, never downgraded', () => {
    const refused = Object.values(compiled.agents)
      .filter((agent) => !isHarnessEnabled(agent.harness, ''))
      .map((agent) => harnessNotEnabledError(agent.harness));

    expect(refused.length).toBeGreaterThan(0);
    for (const error of refused) {
      expect(error.status).toBe(409);
      expect(error.body.code).toBe('HARNESS_NOT_ENABLED');
    }
  });

  test('a v3 experimental project is offered no migration either', () => {
    const { manifest } = compiledFor(EXPERIMENTAL_STARTER_TEMPLATE_ID);
    const verdict = resolveManifestVerdict({ raw: manifest, format: 'yaml', path: 'kortix.yaml' });

    expect(verdict.version).toBe(3);
    expect(verdict.migration_offered).toBe(false);
  });
});
