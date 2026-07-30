import { beforeEach, describe, expect, mock, test } from 'bun:test';

import type { ProjectConfigSummary } from '../../core/rest/projects-client';

mock.module('@tanstack/react-query', () => ({
  useQuery: (config: Record<string, unknown>) => config,
  useMutation: (config: Record<string, unknown>) => config,
  useQueries: (config: Record<string, unknown>) => config,
  useInfiniteQuery: (config: Record<string, unknown>) => config,
  useQueryClient: () => ({
    setQueryData: () => undefined,
    getQueryData: () => undefined,
    invalidateQueries: () => undefined,
    refetchQueries: () => undefined,
    removeQueries: () => undefined,
    cancelQueries: () => undefined,
  }),
}));

let runtimeReady = true;
const realKeys = await import('./keys');
mock.module('./keys', () => ({
  ...realKeys,
  useOpenCodeRestReady: () => runtimeReady,
}));

let getClientCalls = 0;
mock.module('../../core/runtime/client', () => ({
  getClient: () => {
    getClientCalls += 1;
    return {
      app: {
        agents: async () => ({ data: [{ name: 'from-sandbox' }] }),
      },
    };
  },
}));

let projectDetailCalls: string[] = [];
const realProjectsClient = await import('../../core/rest/projects-client');
mock.module('../../core/rest/projects-client', () => ({
  ...realProjectsClient,
  getProjectDetail: async (projectId: string) => {
    projectDetailCalls.push(projectId);
    return {
      config: {
        default_agent: 'kortix',
        open_code_default_agent: null,
        agents: [
          { name: 'kortix', path: 'kortix.md', description: null, mode: 'primary' },
          { name: 'reviewer', path: 'reviewer.md', description: null, mode: 'primary' },
        ],
      },
    };
  },
}));

const { projectConfigAgentsToOpenCodeAgents, useOpenCodeAgents } = await import('./agents');

type QueryConfig = {
  enabled: boolean;
  queryKey: readonly unknown[];
  queryFn: () => Promise<{ name: string }[]>;
};

const config = (defaultAgent: string | null) =>
  ({
    open_code_default_agent: defaultAgent,
    agents: [
      { name: 'kortix', path: 'kortix.md', description: null, mode: 'primary' },
      {
        name: 'memory-reflector',
        path: 'memory-reflector.md',
        description: null,
        mode: 'primary',
      },
    ],
  }) as ProjectConfigSummary;

beforeEach(() => {
  runtimeReady = true;
  getClientCalls = 0;
  projectDetailCalls = [];
});

describe('projectConfigAgentsToOpenCodeAgents', () => {
  test('places the declared project default first for fallback consumers', () => {
    expect(
      projectConfigAgentsToOpenCodeAgents(config('memory-reflector')).map((agent) => agent.name),
    ).toEqual(['memory-reflector', 'kortix']);
  });

  test('preserves manifest order when there is no declared default', () => {
    expect(projectConfigAgentsToOpenCodeAgents(config(null)).map((agent) => agent.name)).toEqual([
      'kortix',
      'memory-reflector',
    ]);
  });

  test('preserves runtime and harness metadata for project agent consumers', () => {
    const input = config('memory-reflector');
    input.agents[1] = {
      ...input.agents[1],
      runtime: 'codex',
      harness: 'codex',
      native_agent: 'reviewer',
    };

    expect(projectConfigAgentsToOpenCodeAgents(input)[0]).toMatchObject({
      name: 'memory-reflector',
      runtime: 'codex',
      harness: 'codex',
      nativeAgent: 'reviewer',
    });
  });
});

describe('useOpenCodeAgents', () => {
  test('resolves the project roster without any sandbox runtime request', async () => {
    const query = useOpenCodeAgents({ projectId: 'proj_1' }) as unknown as QueryConfig;

    const agents = await query.queryFn();

    expect(agents.map((agent) => agent.name)).toEqual(['kortix', 'reviewer']);
    expect(projectDetailCalls).toEqual(['proj_1']);
    expect(getClientCalls).toBe(0);
  });

  test('falls back to the sandbox runtime only when no projectId is given', async () => {
    const query = useOpenCodeAgents() as unknown as QueryConfig;

    const agents = await query.queryFn();

    expect(agents.map((agent) => agent.name)).toEqual(['from-sandbox']);
    expect(getClientCalls).toBe(1);
    expect(projectDetailCalls).toEqual([]);
  });

  test('never issues a sandbox request when the caller disables the query', () => {
    const query = useOpenCodeAgents({ enabled: false }) as unknown as QueryConfig;

    expect(query.enabled).toBe(false);
  });

  test('keeps the project roster enabled by default', () => {
    runtimeReady = false;

    expect((useOpenCodeAgents({ projectId: 'proj_1' }) as unknown as QueryConfig).enabled).toBe(
      true,
    );
  });

  test('opting out wins over an available project roster', () => {
    const query = useOpenCodeAgents({
      projectId: 'proj_1',
      enabled: false,
    }) as unknown as QueryConfig;

    expect(query.enabled).toBe(false);
  });

  test('gates the sandbox fallback on runtime readiness', () => {
    runtimeReady = false;

    expect((useOpenCodeAgents() as unknown as QueryConfig).enabled).toBe(false);
  });
});
