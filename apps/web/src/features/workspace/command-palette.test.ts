import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(join(import.meta.dir, 'command-palette.tsx'), 'utf8');

describe('command palette agent roster', () => {
  test('reads the server-side project roster instead of the sandbox OpenCode runtime', () => {
    expect(source).toMatch(/useRuntimeAgents\(\{[^}]*projectId[^}]*\}\)/);
    expect(source).not.toMatch(/useRuntimeAgents\(\)/);
  });

  test('opts out entirely when the palette is open outside a project', () => {
    expect(source).toMatch(/useRuntimeAgents\(\{[^}]*enabled: !!projectId[^}]*\}\)/);
  });

  test('resolves projectId from the project route before the roster query', () => {
    const projectIdLine = source.indexOf('const projectId =');
    const agentsLine = source.indexOf('useRuntimeAgents(');

    expect(projectIdLine).toBeGreaterThan(-1);
    expect(agentsLine).toBeGreaterThan(projectIdLine);
  });
});
