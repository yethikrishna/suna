import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const REST_HOOK_MODULES = [
  './agents.ts',
  './commands.ts',
  './mcp.ts',
  './projects.ts',
  './providers.ts',
  './sessions.ts',
  './tools.ts',
  '../use-opencode-config.ts',
  '../runtime-actions.ts',
];

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('the OpenCode REST readiness gate', () => {
  test.each(REST_HOOK_MODULES)('%s gates on the REST capability, not sandbox liveness', (path) => {
    const code = source(path);
    expect(code).toContain('useOpenCodeRestReady');
    expect(code).not.toMatch(/useOpenCodeRuntimeReady\(\)/);
  });

  test('keeps sandbox liveness separate so a host composer gate never reads the REST capability', () => {
    const keys = source('./keys.ts');
    expect(keys).toMatch(/export function useOpenCodeRuntimeReady\(\)/);
    expect(keys).toMatch(/export function useOpenCodeRestReady\(\)/);
    const runtimeReadyBody = keys.slice(
      keys.indexOf('export function useOpenCodeRuntimeReady()'),
      keys.indexOf('export function useOpenCodeRestReady()'),
    );
    expect(runtimeReadyBody).not.toContain('servesOpenCodeRest');
  });
});
