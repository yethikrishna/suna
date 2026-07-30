import { beforeEach, describe, expect, mock, test } from 'bun:test';

import type { RuntimeAgent } from './use-opencode-sessions';

let received: unknown;
let roster: RuntimeAgent[] = [];

const realReact = await import('react');
mock.module('react', () => ({
  ...realReact,
  default: realReact.default,
  useMemo: <T>(factory: () => T) => factory(),
}));

const realHooks = await import('./use-opencode-sessions');
mock.module('./use-opencode-sessions', () => ({
  ...realHooks,
  useOpenCodeAgents: (options?: unknown) => {
    received = options;
    return { data: roster };
  },
}));

const { useAllVisibleAgents, useVisibleAgents } = await import('./use-visible-agents');

const agent = (name: string, extra: Partial<RuntimeAgent> = {}) =>
  ({ name, mode: 'primary', ...extra }) as RuntimeAgent;

beforeEach(() => {
  received = undefined;
  roster = [];
});

describe('useVisibleAgents', () => {
  test('forwards a project scope to the server-side roster', () => {
    useVisibleAgents({ projectId: 'project-1' });

    expect(received).toEqual({ projectId: 'project-1' });
  });

  test('forwards an opt-out so a caller with no project in scope reads no sandbox roster', () => {
    useVisibleAgents({ projectId: null, enabled: false });

    expect(received).toEqual({ projectId: null, enabled: false });
  });

  test('drops hidden agents and subagents', () => {
    roster = [
      agent('kortix'),
      agent('hidden-one', { hidden: true }),
      agent('helper', { mode: 'subagent' }),
    ];

    expect(useVisibleAgents({ projectId: 'project-1' }).map((a) => a.name)).toEqual(['kortix']);
  });

  test('an unreachable roster resolves to an empty list, never undefined', () => {
    roster = [];

    expect(useVisibleAgents({ projectId: 'project-1' })).toEqual([]);
  });
});

describe('useAllVisibleAgents', () => {
  test('forwards an opt-out too', () => {
    useAllVisibleAgents({ enabled: false });

    expect(received).toEqual({ enabled: false });
  });

  test('keeps subagents and still drops hidden agents', () => {
    roster = [agent('kortix'), agent('helper', { mode: 'subagent' }), agent('h', { hidden: true })];

    expect(useAllVisibleAgents({ projectId: 'project-1' }).map((a) => a.name)).toEqual([
      'kortix',
      'helper',
    ]);
  });
});
