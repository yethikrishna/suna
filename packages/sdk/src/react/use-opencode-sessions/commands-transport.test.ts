import { beforeEach, describe, expect, mock, test } from 'bun:test';

mock.module('@tanstack/react-query', () => ({
  useQuery: (config: Record<string, unknown>) => config,
  useMutation: (config: Record<string, unknown>) => config,
}));

let runtimeReady = true;
const realKeys = await import('./keys');
mock.module('./keys', () => ({
  ...realKeys,
  useOpenCodeRestReady: () => runtimeReady,
}));

let commandListCalls = 0;
mock.module('../../core/runtime/client', () => ({
  getClient: () => ({
    command: {
      list: async () => {
        commandListCalls += 1;
        return { data: [{ name: 'review', template: 'review $ARGUMENTS', hints: [] }] };
      },
    },
  }),
}));

const { useOpenCodeCommands } = await import('./commands');

type QueryConfig = {
  enabled: boolean;
  queryFn: () => Promise<unknown[]>;
  placeholderData: () => unknown;
};

beforeEach(() => {
  commandListCalls = 0;
  runtimeReady = true;
});

describe('useOpenCodeCommands', () => {
  test('a runtime that serves OpenCode REST still lists commands over REST', async () => {
    const query = useOpenCodeCommands() as unknown as QueryConfig;

    expect(query.enabled).toBe(true);
    await query.queryFn();
    expect(commandListCalls).toBe(1);
  });

  test('a runtime that serves no OpenCode REST issues no command request at all', () => {
    runtimeReady = false;

    const query = useOpenCodeCommands() as unknown as QueryConfig;

    expect(query.enabled).toBe(false);
    expect(commandListCalls).toBe(0);
  });

  test('a disabled command query degrades to a list, never to undefined', () => {
    runtimeReady = false;

    const query = useOpenCodeCommands() as unknown as QueryConfig;

    expect(query.placeholderData() ?? []).toEqual([]);
  });
});
