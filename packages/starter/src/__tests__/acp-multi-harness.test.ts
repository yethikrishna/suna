import { describe, expect, test } from 'bun:test';

import { getStarterFiles, STARTER_TEMPLATE_IDS } from '../index';

const NATIVE_GUIDANCE_PATHS = ['.claude/CLAUDE.md', '.codex/AGENTS.md', '.pi/README.md'] as const;

describe('ACP multi-harness starter', () => {
  test('is a selectable starter template', () => {
    expect(STARTER_TEMPLATE_IDS).toContain('acp-multi-harness');
  });

  test('ships four runtime profiles, four agents, and native guidance', () => {
    const files = getStarterFiles({
      projectName: 'Harness Lab',
      repoFullName: 'kortix/harness-lab',
      template: 'acp-multi-harness',
    });
    const paths = files.map((file) => file.path);
    const manifest = files.find((file) => file.path === 'kortix.yaml')?.content ?? '';

    expect(manifest).toContain('kortix_version: 3');
    expect(manifest).toContain('default_agent: opencode');
    for (const harness of ['opencode', 'claude', 'codex', 'pi']) {
      expect(manifest).toContain(`harness: ${harness}`);
      expect(manifest).toContain(`  ${harness}:`);
      expect(manifest).toContain(`runtime: ${harness}`);
    }
    for (const path of NATIVE_GUIDANCE_PATHS) expect(paths).toContain(path);
    expect(paths).toContain('.kortix/opencode/skills/pdf/SKILL.md');
  });
});
