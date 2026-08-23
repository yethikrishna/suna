// PlatinumProvider.create() must THROW when the create wait returns a
// terminal-fail state (failed-start / lost / deleted) and best-effort remove
// the dead box — so retrySandboxProvisionCreate re-provisions instead of
// silently handing back an unusable "running" session (proven 2026-07-07,
// session c6fef0b5: Platinum state=failed-start while comp status=active).
// Env is set before importing anything that reads config at module load.
import { test, expect, mock, beforeEach } from 'bun:test';

process.env.ALLOWED_SANDBOX_PROVIDERS = 'platinum';
process.env.PLATINUM_API_KEY = 'pt_test_key';
process.env.PLATINUM_API_URL = 'https://api.platinum.dev';
process.env.PLATINUM_TEMPLATE = 'tpl_test';
process.env.KORTIX_URL ??= 'https://api.example.com';
process.env.KORTIX_NODE_RELAY_URL ??= 'https://api.example.com';
process.env.DATABASE_URL ??= 'postgres://x';

// Capture the paths platinumJson is called with so we can assert the dead box
// gets a DELETE. `state` is driven per-test via the closure below.
let createState = 'running';
const calls: { path: string; method: string; body?: string }[] = [];

mock.module('../../shared/platinum', () => ({
  isPlatinumConfigured: () => true,
  platinumJsonResponse: async () => {
    throw new Error('unexpected Platinum materialization request');
  },
  platinumJson: async (path: string, init: RequestInit = {}) => {
    calls.push({
      path,
      method: String(init.method ?? 'GET'),
      body: typeof init.body === 'string' ? init.body : undefined,
    });
    // POST /v1/sandboxes?wait_for_state=running — return a box in `createState`.
    if (path.startsWith('/v1/sandboxes?')) {
      return { id: 'sbx_dead', state: createState };
    }
    // expose / delete / anything else — succeed cheaply.
    if (path.includes('/expose')) return { url: 'https://sbx.test/agent', port: 8000, public: true };
    return {};
  },
}));

// Keep service-key + frontend-url from touching real deps.
mock.module('../service-key', () => ({ serviceKeyForExternalId: () => 'svc_key' }));
mock.module('../sandbox-frontend-url', () => ({ sandboxFrontendBaseUrl: () => 'https://app.example.com' }));

async function makeProvider() {
  const { PlatinumProvider } = await import('./platinum');
  return new PlatinumProvider();
}

const baseOpts = {
  accountId: 'acc_1',
  userId: 'usr_1',
  name: 'test-box',
  envVars: { KORTIX_TOKEN: 'tok_test' },
  snapshot: 'tpl_test',
};

function expectSessionBootstrap(body: string, legacyEnrollment = false): void {
  const parsed = JSON.parse(body) as { cmd: string[]; timeout_ms: number };
  expect(parsed.cmd.slice(0, 2)).toEqual(['/bin/sh', '-lc']);
  expect(parsed.cmd[2]).toContain('/proc/[0-9]*');
  if (legacyEnrollment) {
    expect(parsed.cmd[2]).toContain('/runtime-assets/agent');
    expect(parsed.cmd[2]).toContain('agent.bootstrap supervise');
  }
  expect(parsed.cmd[2]).toContain('/usr/local/bin/kortix-agent');
  expect(parsed.cmd[2]).toContain('/opt/kortix/agent.current run');
  expect(parsed.cmd[2]).toContain('kill -TERM "${proc#/proc/}"');
  expect(parsed.cmd[2]).not.toContain('ps -u');
  expect(parsed.cmd[2]).toContain("KORTIX_API_URL='https://api.example.com/v1'");
  expect(parsed.cmd[2]).toContain('/usr/local/bin/kortix-entrypoint');
  expect(parsed.timeout_ms).toBe(15_000);
}

beforeEach(() => {
  calls.length = 0;
});

for (const state of ['failed-start', 'lost', 'deleted']) {
  test(`create() throws and removes the box when create returns terminal state '${state}'`, async () => {
    createState = state;
    const p = await makeProvider();
    await expect(p.create({ ...baseOpts })).rejects.toThrow(/did not reach running/);
    // The dead box must be DELETE'd (best-effort remove) so it doesn't linger.
    const deleted = calls.some((c) => c.method === 'DELETE' && c.path === '/v1/sandboxes/sbx_dead');
    expect(deleted).toBe(true);
  });
}

test('create() does NOT throw when the box is running', async () => {
  createState = 'running';
  const p = await makeProvider();
  const res = await p.create({ ...baseOpts });
  expect(res.externalId).toBe('sbx_dead');
  // No DELETE for a healthy box.
  const deleted = calls.some((c) => c.method === 'DELETE');
  expect(deleted).toBe(false);
  const bootstrap = calls.find(
    (c) => c.method === 'POST' && c.path === '/v1/sandboxes/sbx_dead/exec',
  );
  expect(bootstrap).toBeDefined();
  expectSessionBootstrap(bootstrap!.body!);
});

test('session runtime convergence starts the kortixd supervisor after a wake', async () => {
  const p = await makeProvider();

  await p.ensureSessionRuntimeStarted('sbx_session', {
    nodeId: 'node-legacy-1',
    nodeToken: 'knd_test_legacy_credential',
  });

  const bootstrap = calls.find(
    (c) => c.method === 'POST' && c.path === '/v1/sandboxes/sbx_session/exec',
  );
  expectSessionBootstrap(bootstrap!.body!, true);
  expect(bootstrap!.body!).toContain("KORTIX_COMPUTE_NODE_ID='node-legacy-1'");
  expect(bootstrap!.body!).toContain("KORTIX_NODE_TOKEN='knd_test_legacy_credential'");
});

test("create() does NOT tear down a still-'provisioning' box (FE poll picks it up)", async () => {
  createState = 'provisioning';
  const p = await makeProvider();
  // Should NOT throw on a non-terminal state — returns the id, FE readiness
  // poll takes over.
  const res = await p.create({ ...baseOpts });
  expect(res.externalId).toBe('sbx_dead');
  const deleted = calls.some((c) => c.method === 'DELETE');
  expect(deleted).toBe(false);
});

test('routeIngress() sends Kortix-native PTY websockets through the authenticated agent bridge', async () => {
  const p = await makeProvider();
  expect(p.routeIngress({
    port: 8000,
    transport: 'websocket',
    path: '/kortix/pty/kpty_test/connect',
  })).toEqual({
    effectivePort: 8000,
    websocket: {
      userContextQueryParam: '__kortix_user_context',
      queryDefaults: { cursor: '0' },
    },
  });
});
