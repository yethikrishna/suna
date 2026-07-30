import { beforeEach, describe, expect, mock, test } from 'bun:test';

import type { CurrentRuntimeState } from '../../core/session/current-runtime';

type ConnectionState = { status: string; healthy: boolean | null };

let connection: ConnectionState = { status: 'connected', healthy: true };
let runtime: CurrentRuntimeState = {
  url: 'http://backend.local/p/sb-1/8000',
  sandboxId: 'sb-1',
  dbSandboxId: 'db-1',
  servesOpenCodeRest: true,
  version: 1,
};

mock.module('../../browser/stores/sandbox-connection-store', () => ({
  useSandboxConnectionStore: <T>(selector: (state: ConnectionState) => T) => selector(connection),
}));
mock.module('../../core/session/server-store/active', () => ({
  getActiveOpenCodeUrl: () => null,
}));
mock.module('../use-current-runtime', () => ({
  useCurrentRuntime: <T>(selector: (state: CurrentRuntimeState) => T) => selector(runtime),
}));

const { useOpenCodeRestReady, useOpenCodeRuntimeReady } = await import('./keys');

beforeEach(() => {
  connection = { status: 'connected', healthy: true };
  runtime = {
    url: 'http://backend.local/p/sb-1/8000',
    sandboxId: 'sb-1',
    dbSandboxId: 'db-1',
    servesOpenCodeRest: true,
    version: 1,
  };
});

describe('useOpenCodeRuntimeReady', () => {
  test('a healthy runtime with a pinned url is ready', () => {
    expect(useOpenCodeRuntimeReady()).toBe(true);
  });

  test('stays ready on a runtime that serves no OpenCode REST, because the sandbox is up', () => {
    runtime = { ...runtime, servesOpenCodeRest: false };

    expect(useOpenCodeRuntimeReady()).toBe(true);
  });

  test('an unhealthy runtime is not ready', () => {
    connection = { status: 'connected', healthy: false };

    expect(useOpenCodeRuntimeReady()).toBe(false);
  });

  test('a healthy runtime without a pinned url is not ready', () => {
    runtime = { ...runtime, url: null };

    expect(useOpenCodeRuntimeReady()).toBe(false);
  });
});

describe('useOpenCodeRestReady', () => {
  test('a healthy REST runtime can be read over OpenCode REST', () => {
    expect(useOpenCodeRestReady()).toBe(true);
  });

  test('a healthy runtime that serves no OpenCode REST can never be read over it', () => {
    runtime = { ...runtime, servesOpenCodeRest: false };

    expect(useOpenCodeRestReady()).toBe(false);
  });

  test('an unhealthy runtime cannot be read over OpenCode REST either', () => {
    connection = { status: 'connected', healthy: false };

    expect(useOpenCodeRestReady()).toBe(false);
  });
});
