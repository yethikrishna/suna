import { describe, expect, test } from 'bun:test';
import { createConnectorRouter, type ConnectorRouterDeps } from '../connectors/router';

const PROJECT = 'proj-composio';
const ADMIN = { 'x-test-admin': 'user-1' };

function deps(overrides: Partial<ConnectorRouterDeps>): ConnectorRouterDeps {
  return {
    featureFlagEnabled: async () => true,
    resolvePrincipal: async () => null,
    resolveProjectPrincipal: async () => null,
    makeGatewayDeps: (() => ({} as unknown)) as ConnectorRouterDeps['makeGatewayDeps'],
    listCatalog: async () => [],
    resolveAdmin: async (c) =>
      c.req.header('x-test-admin') ? { accountId: 'acct-1', userId: 'user-1' } : null,
    listConnectors: async () => [],
    syncConnectors: async () => ({ synced: 0, errors: [] }),
    ...overrides,
  };
}

function request(app: ReturnType<typeof createConnectorRouter>, path: string, init: RequestInit = {}) {
  return app.fetch(new Request(`http://x${path}`, init));
}

describe('connector router provider-neutral connect routes', () => {
  test('connect-status returns Composio as the configured provider when wired', async () => {
    const app = createConnectorRouter(
      deps({
        connectStatus: async () => ({ configured: true, provider: 'composio', providers: ['composio'] }),
      }),
    );

    const res = await request(app, '/connect-status', { headers: ADMIN });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      configured: true,
      provider: 'composio',
      providers: ['composio'],
    });
  });

  test('connect and finalize call provider-neutral deps and preserve Pipedream fallback path', async () => {
    const calls: string[] = [];
    const app = createConnectorRouter(
      deps({
        connectorConnect: async (_projectId, slug, _userId, redirects) => {
          calls.push(`connect:${slug}:${redirects?.success ?? ''}`);
          return { provider: 'composio', app: 'github', connectUrl: 'https://composio.test/connect', requestId: 'req_1' };
        },
        connectorFinalize: async (_projectId, slug) => {
          calls.push(`finalize:${slug}`);
          return { provider: 'composio', connected: true, accountId: 'ca_1', connectionId: 'conn_1' };
        },
      }),
    );

    const connect = await request(app, `/projects/${PROJECT}/connectors/github/connect`, {
      method: 'POST',
      headers: { ...ADMIN, 'content-type': 'application/json' },
      body: JSON.stringify({ success_redirect_uri: 'kortix://success' }),
    });
    expect(connect.status).toBe(200);
    expect(await connect.json()).toMatchObject({
      provider: 'composio',
      app: 'github',
      connectUrl: 'https://composio.test/connect',
      requestId: 'req_1',
    });

    const finalize = await request(app, `/projects/${PROJECT}/connectors/github/connect/finalize`, {
      method: 'POST',
      headers: ADMIN,
    });
    expect(finalize.status).toBe(200);
    expect(await finalize.json()).toEqual({
      provider: 'composio',
      connected: true,
      accountId: 'ca_1',
      connectionId: 'conn_1',
    });
    expect(calls).toEqual(['connect:github:kortix://success', 'finalize:github']);
  });
});
