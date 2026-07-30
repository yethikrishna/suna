import { describe, expect, test } from 'bun:test';
import { validateManifest } from '@kortix/manifest-schema';

import {
  DEFAULT_STARTER_TEMPLATE_ID,
  EXPERIMENTAL_STARTER_TEMPLATE_ID,
  STABLE_STARTER_TEMPLATE_ID,
  STARTER_TEMPLATES,
  getStarterFiles,
  listedStarterTemplates,
  starterTemplate,
} from '../index';

const NATIVE_GUIDANCE_PATHS = ['.claude/CLAUDE.md', '.codex/AGENTS.md', '.pi/README.md'] as const;

function filesFor(template: string) {
  return getStarterFiles({
    projectName: 'Harness Lab',
    repoFullName: 'kortix/harness-lab',
    template: template as never,
  });
}

function manifestFor(template: string): string {
  return filesFor(template).find((file) => file.path === 'kortix.yaml')?.content ?? '';
}

describe('the two starters', () => {
  test('the stable starter is the default', () => {
    expect(STABLE_STARTER_TEMPLATE_ID).toBe('general-knowledge-worker');
    expect(DEFAULT_STARTER_TEMPLATE_ID).toBe(STABLE_STARTER_TEMPLATE_ID);
  });

  test('the experimental starter is the multi-harness one', () => {
    expect(EXPERIMENTAL_STARTER_TEMPLATE_ID).toBe('acp-multi-harness');
  });

  test('exactly two starters are listed to a user, one stable and one experimental', () => {
    expect(listedStarterTemplates().map((t) => [t.id, t.stability])).toEqual([
      ['general-knowledge-worker', 'stable'],
      ['acp-multi-harness', 'experimental'],
    ]);
  });

  test('the internal minimal build is never listed to a user', () => {
    expect(starterTemplate('minimal').listed).toBe(false);
    expect(listedStarterTemplates().some((t) => t.id === 'minimal')).toBe(false);
  });

  test('every descriptor declares the manifest version it scaffolds', () => {
    expect(STARTER_TEMPLATES.map((t) => [t.id, t.manifestVersion])).toEqual([
      ['minimal', 2],
      ['general-knowledge-worker', 2],
      ['acp-multi-harness', 3],
    ]);
  });

  test('only the experimental descriptor is labelled experimental, and says it is unreleased', () => {
    const experimental = starterTemplate(EXPERIMENTAL_STARTER_TEMPLATE_ID);
    expect(experimental.stability).toBe('experimental');
    expect(experimental.label).toContain('experimental');
    expect(experimental.description.toLowerCase()).toContain('not fully released');

    expect(starterTemplate(STABLE_STARTER_TEMPLATE_ID).stability).toBe('stable');
  });
});

describe('stable starter — opencode only, kortix_version 2', () => {
  test('scaffolds a v2 manifest', () => {
    expect(manifestFor(STABLE_STARTER_TEMPLATE_ID)).toContain('kortix_version: 2');
  });

  test('declares no runtimes block and no non-opencode harness', () => {
    const manifest = manifestFor(STABLE_STARTER_TEMPLATE_ID);

    expect(manifest).not.toContain('runtimes:');
    for (const harness of ['claude', 'codex', 'pi']) {
      expect(manifest).not.toContain(`harness: ${harness}`);
    }
  });

  test('pins the single opencode runtime', () => {
    expect(manifestFor(STABLE_STARTER_TEMPLATE_ID)).toContain('runtime: opencode');
  });

  test('its default agent is the declared opencode agent', () => {
    expect(manifestFor(STABLE_STARTER_TEMPLATE_ID)).toContain('default_agent: kortix');
  });

  test('ships no native config for another harness', () => {
    const paths = filesFor(STABLE_STARTER_TEMPLATE_ID).map((f) => f.path);

    for (const path of NATIVE_GUIDANCE_PATHS) expect(paths).not.toContain(path);
  });

  test('keeps the general-knowledge skill kit', () => {
    const paths = filesFor(STABLE_STARTER_TEMPLATE_ID).map((f) => f.path);

    expect(paths).toContain('.kortix/opencode/skills/pdf/SKILL.md');
    expect(paths).toContain('.kortix/opencode/agents/kortix.md');
  });

  test('the manifest is schema-valid with zero errors', () => {
    const result = validateManifest(manifestFor(STABLE_STARTER_TEMPLATE_ID), 'yaml');

    expect(result.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(result.valid).toBe(true);
  });
});

describe('experimental starter — multi-harness, kortix_version 3', () => {
  test('scaffolds a v3 manifest with four runtime profiles and four agents', () => {
    const manifest = manifestFor(EXPERIMENTAL_STARTER_TEMPLATE_ID);

    expect(manifest).toContain('kortix_version: 3');
    expect(manifest).toContain('default_agent: opencode');
    for (const harness of ['opencode', 'claude', 'codex', 'pi']) {
      expect(manifest).toContain(`harness: ${harness}`);
      expect(manifest).toContain(`  ${harness}:`);
      expect(manifest).toContain(`runtime: ${harness}`);
    }
  });

  test('says experimental in the manifest a user reads', () => {
    expect(manifestFor(EXPERIMENTAL_STARTER_TEMPLATE_ID)).toContain('EXPERIMENTAL');
  });

  test('ships native config for every harness it declares', () => {
    const paths = filesFor(EXPERIMENTAL_STARTER_TEMPLATE_ID).map((f) => f.path);

    for (const path of NATIVE_GUIDANCE_PATHS) expect(paths).toContain(path);
  });

  test('is a superset of the stable starter, differing only where it must', () => {
    const stable = new Set(filesFor(STABLE_STARTER_TEMPLATE_ID).map((f) => f.path));
    const experimentalPaths = new Set(
      filesFor(EXPERIMENTAL_STARTER_TEMPLATE_ID).map((f) => f.path),
    );

    for (const path of stable) expect(experimentalPaths.has(path)).toBe(true);
    expect([...experimentalPaths].filter((p) => !stable.has(p)).sort()).toEqual(
      [...NATIVE_GUIDANCE_PATHS].sort(),
    );
  });

  test('keeps the general-knowledge skill kit', () => {
    expect(
      filesFor(EXPERIMENTAL_STARTER_TEMPLATE_ID).some(
        (f) => f.path === '.kortix/opencode/skills/pdf/SKILL.md',
      ),
    ).toBe(true);
  });

  test('the manifest is schema-valid with zero errors', () => {
    const result = validateManifest(manifestFor(EXPERIMENTAL_STARTER_TEMPLATE_ID), 'yaml');

    expect(result.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(result.valid).toBe(true);
  });

  test('a user never reaches it by accident — the default is the stable starter', () => {
    expect(
      getStarterFiles({ projectName: 'Harness Lab', repoFullName: 'kortix/harness-lab' }),
    ).toEqual(filesFor(STABLE_STARTER_TEMPLATE_ID));
    expect(
      getStarterFiles({
        projectName: 'Harness Lab',
        repoFullName: 'kortix/harness-lab',
        template: 'bogus' as never,
      }),
    ).toEqual(filesFor(STABLE_STARTER_TEMPLATE_ID));
  });
});

describe('internal minimal build', () => {
  test('lays down the stable v2 floor, not the multi-harness one', () => {
    const manifest = manifestFor('minimal');

    expect(manifest).toContain('kortix_version: 2');
    expect(manifest).not.toContain('harness: claude');
  });
});
