import { expect, test } from 'bun:test';
import { composioUserId, executeComposio, type ComposioRuntime } from './composio';
import { handleCall, type GatewayDeps } from './gateway';
import { normalizeComposio } from './normalize';
import type { GatewayConnector } from './gateway';

function fakeRuntime(calls: Array<Record<string, unknown>>): ComposioRuntime {
  return {
    sessions: {
      async create(userId, config) {
        calls.push({ type: 'create', userId, config });
        return {
          sessionId: 'session-1',
          async tools() {
            return [];
          },
          async authorize() {
            return { id: 'conn-1', redirectUrl: 'https://composio.test/connect' };
          },
          async execute(toolSlug, args, options) {
            calls.push({ type: 'execute', toolSlug, args, options });
            return { data: { ok: true }, error: null, logId: 'log-123' };
          },
        };
      },
      async use() {
        throw new Error('unexpected use');
      },
    },
  };
}

test('composioUserId is stable per connector and connection', () => {
  expect(composioUserId('project-1', 'gmail', null)).toBe('kortix-connector:project-1:gmail');
  expect(composioUserId('project-1', 'gmail', 'connection-1')).toBe('kortix-connection:connection-1');
});

test('normalizeComposio emits Composio action bindings and bounded schemas', () => {
  const actions = normalizeComposio(
    [
      {
        slug: 'GMAIL_SEND_EMAIL',
        name: 'Send email',
        description: 'Send one email',
        inputParameters: {
          type: 'object',
          properties: { to: { type: 'string' } },
          required: ['to'],
        },
        outputParameters: { type: 'object', properties: { id: { type: 'string' } } },
      },
    ],
    'gmail',
  );

  expect(actions).toEqual([
    {
      path: 'send_email',
      name: 'Send email',
      description: 'Send one email',
      inputSchema: {
        type: 'object',
        properties: { to: { type: 'string' } },
        required: ['to'],
      },
      outputSchema: { type: 'object', properties: { id: { type: 'string' } } },
      risk: 'write',
      binding: { kind: 'composio', toolkit: 'gmail', toolSlug: 'GMAIL_SEND_EMAIL' },
    },
  ]);
});

test('executeComposio uses sessions and returns provider result with log id', async () => {
  const calls: Array<Record<string, unknown>> = [];
  const result = await executeComposio({
    projectId: 'project-1',
    connectorSlug: 'gmail',
    toolkit: 'gmail',
    toolSlug: 'GMAIL_SEND_EMAIL',
    args: { to: 'a@example.com' },
    accountId: 'account-1',
    userId: 'connection-1',
    runtime: fakeRuntime(calls),
  });

  expect(result).toEqual({
    ok: true,
    status: 200,
    data: { provider: 'composio', requestId: 'log-123', result: { ok: true } },
  });
  expect(calls).toEqual([
    {
      type: 'create',
      userId: 'kortix-connection:connection-1',
      config: { toolkits: ['gmail'], manageConnections: true },
    },
    {
      type: 'execute',
      toolSlug: 'GMAIL_SEND_EMAIL',
      args: { to: 'a@example.com' },
      options: { account: 'account-1' },
    },
  ]);
});

test('executeComposio rejects empty Composio log id', async () => {
  const runtime: ComposioRuntime = {
    sessions: {
      async create() {
        return {
          sessionId: 'session-1',
          async tools() {
            return [];
          },
          async authorize() {
            return { id: 'conn-1', redirectUrl: 'https://composio.test/connect' };
          },
          async execute() {
            return { data: {}, error: null, logId: ' ' };
          },
        };
      },
      async use() {
        throw new Error('unexpected use');
      },
    },
  };

  await expect(
    executeComposio({
      projectId: 'project-1',
      connectorSlug: 'gmail',
      toolkit: 'gmail',
      toolSlug: 'GMAIL_SEND_EMAIL',
      args: {},
      accountId: null,
      userId: null,
      runtime,
    }),
  ).rejects.toThrow('composio execution returned no log id');
});

test('gateway executes composio binding without exposing API key or credential to args', async () => {
  const connector: GatewayConnector = {
    connectorId: 'connector-1',
    connectionId: 'connection-1',
    connectionIsDefault: false,
    slug: 'gmail',
    provider: 'composio',
    platform: 'gmail',
    baseUrl: null,
    auth: { type: 'none', in: 'header', name: null, prefix: null },
    hasAuth: true,
    credentialMode: 'shared',
    enabled: true,
  };
  const executions: Array<Record<string, unknown>> = [];
  const deps: GatewayDeps = {
    async loadConnectorBySlug() {
      return connector;
    },
    async loadAction() {
      return {
        path: 'gmail.send_email',
        relPath: 'send_email',
        inputSchema: null,
        risk: 'write',
        binding: { kind: 'composio', toolkit: 'gmail', toolSlug: 'GMAIL_SEND_EMAIL' },
      };
    },
    async resolveCredential() {
      return 'connected-account-1';
    },
    async loadPolicies() {
      return [];
    },
    async recordExecution(rec) {
      executions.push(rec as unknown as Record<string, unknown>);
      return 'exec-1';
    },
    fetchImpl: async () => new Response('{}'),
    enforcePolicies: false,
    async executeComposio(input) {
      executions.push({ composioInput: input });
      return {
        ok: true,
        status: 200,
        data: { provider: 'composio', requestId: 'log-123', result: { sent: true } },
      };
    },
  };

  const result = await handleCall(deps, {
    projectId: 'project-1',
    accountId: 'account-1',
    subject: { userId: 'user-1', groupIds: [] },
    sessionId: 'session-1',
    connectorSlug: 'gmail',
    actionPath: 'send_email',
    args: { to: 'a@example.com' },
  });

  expect(result).toEqual({
    status: 'ok',
    risk: 'write',
    data: { provider: 'composio', requestId: 'log-123', result: { sent: true } },
  });
  expect(executions[0]).toEqual({
    composioInput: {
      projectId: 'project-1',
      connectorSlug: 'gmail',
      toolkit: 'gmail',
      toolSlug: 'GMAIL_SEND_EMAIL',
      args: { to: 'a@example.com' },
      accountId: 'connected-account-1',
      userId: 'connection-1',
    },
  });
  expect(JSON.stringify(executions)).not.toContain('COMPOSIO_API_KEY');
});
