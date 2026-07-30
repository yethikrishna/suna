import { beforeEach, describe, expect, mock, test } from 'bun:test';

let servesRest = true;
const realCurrentRuntime = await import('../core/session/current-runtime');
mock.module('../core/session/current-runtime', () => ({
  ...realCurrentRuntime,
  runtimeServesOpenCodeRest: () => servesRest,
}));

let calls: string[] = [];
mock.module('../core/runtime/client', () => ({
  getClient: () => ({
    project: {
      current: async () => {
        calls.push('project.current');
        return { data: { worktree: '/workspace' } };
      },
    },
    path: {
      get: async () => {
        calls.push('path.get');
        return { data: { directory: '/workspace' } };
      },
    },
    global: {
      config: {
        get: async () => {
          calls.push('global.config.get');
          return { data: {} };
        },
      },
    },
  }),
}));

const { getRuntimeConfig, getRuntimePathInfo, getRuntimeProjectInfo } = await import(
  './runtime-actions'
);

beforeEach(() => {
  calls = [];
  servesRest = true;
});

describe('imperative OpenCode REST reads', () => {
  test('a runtime that serves OpenCode REST answers from the runtime client', async () => {
    expect(await getRuntimeProjectInfo()).toEqual({ worktree: '/workspace' } as never);
    expect(await getRuntimePathInfo()).toEqual({ directory: '/workspace' } as never);
    expect(await getRuntimeConfig()).toEqual({});

    expect(calls).toEqual(['project.current', 'path.get', 'global.config.get']);
  });

  test('a runtime that serves no OpenCode REST rejects locally and sends no request', async () => {
    servesRest = false;

    await expect(getRuntimeProjectInfo()).rejects.toThrow(
      'This session runtime serves no OpenCode REST API',
    );
    await expect(getRuntimePathInfo()).rejects.toThrow(
      'This session runtime serves no OpenCode REST API',
    );
    await expect(getRuntimeConfig()).rejects.toThrow(
      'This session runtime serves no OpenCode REST API',
    );

    expect(calls).toEqual([]);
  });
});
