import { describe, expect, test } from 'bun:test';

import {
  resolveSessionSandboxSlug,
  sandboxSlugFromSessionMetadata,
  workspaceModeFromSessionMetadata,
} from './session-sandbox-metadata';

describe('sandboxSlugFromSessionMetadata', () => {
  test('returns a persisted template slug', () => {
    expect(sandboxSlugFromSessionMetadata({ sandbox_slug: 'ml' })).toBe('ml');
    expect(sandboxSlugFromSessionMetadata({ sandbox_slug: 'default' })).toBe('default');
  });

  test('rejects missing and invalid metadata values', () => {
    expect(sandboxSlugFromSessionMetadata(null)).toBeUndefined();
    expect(sandboxSlugFromSessionMetadata({})).toBeUndefined();
    expect(sandboxSlugFromSessionMetadata({ sandbox_slug: '../escape' })).toBeUndefined();
  });
});

describe('workspaceModeFromSessionMetadata', () => {
  test('returns a persisted workspace mode', () => {
    expect(workspaceModeFromSessionMetadata({ workspace_mode: 'runtime' })).toBe('runtime');
    expect(workspaceModeFromSessionMetadata({ workspace_mode: 'read' })).toBe('read');
    expect(workspaceModeFromSessionMetadata({ workspace_mode: 'branch' })).toBe('branch');
  });

  test('rejects missing and invalid metadata values', () => {
    expect(workspaceModeFromSessionMetadata(null)).toBeUndefined();
    expect(workspaceModeFromSessionMetadata({})).toBeUndefined();
    expect(workspaceModeFromSessionMetadata({ workspace_mode: 'all' })).toBeUndefined();
  });
});

describe('resolveSessionSandboxSlug', () => {
  test('uses explicit, agent, project, then platform precedence', () => {
    expect(
      resolveSessionSandboxSlug({
        explicit: 'override',
        agent: 'ml',
        project: 'node',
      }),
    ).toBe('override');
    expect(resolveSessionSandboxSlug({ agent: 'ml', project: 'node' })).toBe('ml');
    expect(resolveSessionSandboxSlug({ project: 'node' })).toBe('node');
    expect(resolveSessionSandboxSlug({})).toBe('default');
  });
});
