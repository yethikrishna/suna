import { beforeEach, describe, expect, mock, test } from 'bun:test';

mock.module('@tanstack/react-query', () => ({
  useQuery: (config: Record<string, unknown>) => config,
  useMutation: (config: Record<string, unknown>) => config,
  useQueryClient: () => ({
    setQueryData: () => undefined,
    getQueryData: () => undefined,
    invalidateQueries: () => undefined,
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

mock.module('../use-current-runtime', () => ({
  useCurrentRuntime: () => 'sb-1',
}));

let sessionListCalls = 0;
mock.module('../../core/runtime/client', () => ({
  getClient: () => ({
    session: {
      list: async () => {
        sessionListCalls += 1;
        return { data: [] };
      },
    },
  }),
}));

const { useOpenCodeSessions } = await import('./sessions');

type QueryConfig = { enabled: boolean; retry: unknown; queryFn: () => Promise<unknown> };

beforeEach(() => {
  sessionListCalls = 0;
  runtimeReady = true;
});

describe('useOpenCodeSessions', () => {
  test('a runtime that serves OpenCode REST still lists sessions', async () => {
    const query = useOpenCodeSessions() as unknown as QueryConfig;

    expect(query.enabled).toBe(true);
    await query.queryFn();
    expect(sessionListCalls).toBe(1);
  });

  test('a runtime that serves no OpenCode REST never lists sessions, so its tight retry loop cannot run', () => {
    runtimeReady = false;

    const query = useOpenCodeSessions() as unknown as QueryConfig;

    expect(query.enabled).toBe(false);
    expect(sessionListCalls).toBe(0);
  });
});
