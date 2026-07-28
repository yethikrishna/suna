import { afterAll, beforeEach, expect, mock, test } from 'bun:test';
import { sessionSandboxes } from '@kortix/db';

const PROJECT_ID = '11111111-2222-4333-8444-555555555555';
const SESSION_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

let appended: unknown[] = [];
let upstreamUrl = '';
let upstreamHeaders = new Headers();
let syncedProviderHeaders: Record<string, string> | null = null;
let accessActions: string[] = [];
let capabilityActions: string[] = [];
let canManageSharing = true;

mock.module('../lib/access', () => ({
  assertProjectCapability: async (
    _c: unknown,
    _userId: string,
    _accountId: string,
    _projectId: string,
    action: string,
  ) => {
    capabilityActions.push(action);
  },
  loadProjectForUser: async (_c: unknown, _projectId: string, action: string) => {
    accessActions.push(action);
    return {
      userId: 'user-1',
      row: { projectId: PROJECT_ID, accountId: 'account-1' },
    };
  },
  loadVisibleSession: async () => ({
    row: {
      sessionId: SESSION_ID,
      metadata: {
        runtime_transport: 'acp',
        runtime_harness: 'codex',
        acp_server_id: SESSION_ID,
      },
    },
    canManageSharing,
  }),
}));

mock.module('../../shared/db', () => ({
  hasDatabase: true,
  db: {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          limit: async () =>
            table === sessionSandboxes ? [{ externalId: 'sandbox-external-1' }] : [],
        }),
      }),
    }),
  },
}));

mock.module('../runtime-inspection', () => ({
  sandboxRuntimeEndpoint: async () => ({
    url: 'https://sandbox.test',
    headers: { 'x-kortix-user-context': 'signed' },
    providerHeaders: { 'x-daytona-preview-token': 'preview' },
    serviceKey: 'service-key',
  }),
}));

mock.module('../lib/sandbox-env-sync', () => ({
  syncSandboxEnvForPrompt: async (input: {
    providerHeaders: Record<string, string>;
  }) => {
    syncedProviderHeaders = input.providerHeaders;
  },
}));

mock.module('../lib/acp-transcript', () => ({
  appendAcpEnvelope: async (input: unknown) => {
    appended.push(input);
    return { ordinal: appended.length, envelope: (input as { envelope: unknown }).envelope };
  },
  loadAcpTranscript: async () => [],
}));

mock.module('../lib/acp-sse-proxy', () => ({
  createPersistedAcpSseProxy: (body: ReadableStream<Uint8Array>) => body,
}));

const realFetch = globalThis.fetch;
globalThis.fetch = (async (input, init) => {
  upstreamUrl = String(input);
  upstreamHeaders = new Headers(init?.headers);
  if (init?.method === 'DELETE') {
    return new Response(null, { status: 204 });
  }
  const request = JSON.parse(String(init?.body)) as Record<string, unknown>;
  return Response.json({
    jsonrpc: '2.0',
    id: request.id,
    result: { protocolVersion: 1 },
  });
}) as typeof fetch;

const { projectsApp } = await import('../lib/app');
await import('./acp');

beforeEach(() => {
  appended = [];
  upstreamUrl = '';
  upstreamHeaders = new Headers();
  syncedProviderHeaders = null;
  accessActions = [];
  capabilityActions = [];
  canManageSharing = true;
});

afterAll(() => {
  globalThis.fetch = realFetch;
  mock.restore();
});

test('POST .../acp proxies through the immutable harness route and persists both envelopes', async () => {
  const request = {
    jsonrpc: '2.0',
    id: 'rpc-1',
    method: 'initialize',
    params: { protocolVersion: 1 },
  };
  const response = await projectsApp.request(`/${PROJECT_ID}/sessions/${SESSION_ID}/acp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });

  expect(response.status).toBe(200);
  expect(accessActions).toEqual(['session']);
  expect(capabilityActions).toEqual(['project.session.start']);
  expect(upstreamUrl).toBe(`https://sandbox.test/kortix/acp/${SESSION_ID}?agent=codex`);
  expect(upstreamHeaders.get('x-kortix-user-context')).toBe('signed');
  expect(appended).toEqual([
    expect.objectContaining({
      projectId: PROJECT_ID,
      sessionId: SESSION_ID,
      direction: 'client_to_agent',
      envelope: request,
    }),
    expect.objectContaining({
      projectId: PROJECT_ID,
      sessionId: SESSION_ID,
      direction: 'agent_to_client',
      envelope: expect.objectContaining({
        id: 'rpc-1',
        result: { protocolVersion: 1 },
      }),
    }),
  ]);
});

test('session/prompt syncs env with provider headers and no user context', async () => {
  const response = await projectsApp.request(`/${PROJECT_ID}/sessions/${SESSION_ID}/acp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'rpc-prompt',
      method: 'session/prompt',
      params: { sessionId: 'native-session', prompt: [] },
    }),
  });

  expect(response.status).toBe(200);
  expect(syncedProviderHeaders).toEqual({
    'x-daytona-preview-token': 'preview',
  });
});

test('GET transcript retains project read access', async () => {
  const response = await projectsApp.request(
    `/${PROJECT_ID}/sessions/${SESSION_ID}/acp/transcript`,
  );

  expect(response.status).toBe(200);
  expect(accessActions).toEqual(['read']);
  expect(capabilityActions).toEqual(['project.session.read']);
});

test('DELETE .../acp requires stop capability and session-management authority', async () => {
  const response = await projectsApp.request(`/${PROJECT_ID}/sessions/${SESSION_ID}/acp`, {
    method: 'DELETE',
  });

  expect(response.status).toBe(204);
  expect(accessActions).toEqual(['session']);
  expect(capabilityActions).toEqual(['project.session.stop']);
});

test('DELETE .../acp rejects a visible session that the caller cannot manage', async () => {
  canManageSharing = false;

  const response = await projectsApp.request(`/${PROJECT_ID}/sessions/${SESSION_ID}/acp`, {
    method: 'DELETE',
  });

  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({
    error: 'Only the session owner or an account owner/admin can stop this session',
  });
});
