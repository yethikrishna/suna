import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { projectSecrets } from '@kortix/db';
import { Hono } from 'hono';

const PROJECT_ID = '33333333-3333-4333-8333-333333333333';
const ACCOUNT_ID = '44444444-4444-4444-8444-444444444444';
const USER_ID = '11111111-1111-4111-8111-111111111111';
const SECRET_ID = '55555555-5555-4555-8555-555555555555';

const PROJECT_ACTIONS = {
  PROJECT_CONNECTOR_READ: 'project.connector.read',
  PROJECT_CONNECTOR_WRITE: 'project.connector.write',
  PROJECT_CUSTOMIZE_WRITE: 'project.customize.write',
  PROJECT_SECRET_READ: 'project.secret.read',
  PROJECT_SECRET_WRITE: 'project.secret.write',
};
mock.module('../iam', () => ({ PROJECT_ACTIONS }));

let agentGrant: Record<string, unknown> | null = null;

let row: ReturnType<typeof secretRow> | null = secretRow();
const updates: Array<Record<string, unknown>> = [];
const audits: Array<Record<string, unknown>> = [];
const propagations: Array<{ projectId: string; options: unknown }> = [];

function secretRow(overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-08-03T10:00:00.000Z');
  return {
    secretId: SECRET_ID,
    projectId: PROJECT_ID,
    identifier: 'SERVICE_API_KEY',
    name: 'SERVICE_API_KEY',
    valueEnc: 'encrypted-value',
    scope: 'runtime',
    ownerUserId: null,
    description: null,
    strategy: 'runtime' as const,
    egressPolicy: null,
    handlePrefix: null,
    rotatedAt: null,
    strategyLocked: false,
    active: true,
    createdBy: USER_ID,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function queryResult(fields: Record<string, unknown> | undefined) {
  if (!row) {
    return {
      limit: async () => [],
      orderBy: async () => [],
    };
  }
  const selected = fields
    ? {
        secretId: row.secretId,
        name: row.name,
        strategy: row.strategy,
        strategyLocked: row.strategyLocked,
      }
    : row;
  return {
    limit: async () => [selected],
    orderBy: async () => [selected],
  };
}

mock.module('../shared/db', () => ({
  hasDatabase: true,
  db: {
    select: (fields?: Record<string, unknown>) => ({
      from: (table: unknown) => {
        if (table !== projectSecrets) throw new Error('unexpected table');
        return { where: () => queryResult(fields) };
      },
    }),
    update: (table: unknown) => {
      if (table !== projectSecrets) throw new Error('unexpected table');
      return {
        set: (values: Record<string, unknown>) => ({
          where: async () => {
            updates.push(values);
            if (row) row = { ...row, ...values };
          },
        }),
      };
    },
    insert: (table: unknown) => {
      if (table !== projectSecrets) throw new Error('unexpected table');
      return {
        values: (values: Record<string, unknown>) => {
          const inserted = secretRow(values);
          row = inserted;
          return {
            onConflictDoUpdate: ({ set }: { set: Record<string, unknown> }) => ({
              returning: async () => {
                row = row ? { ...row, ...set } : inserted;
                return [{ secretId: SECRET_ID }];
              },
            }),
          };
        },
      };
    },
    delete: (table: unknown) => {
      if (table !== projectSecrets) throw new Error('unexpected table');
      return {
        where: async () => {
          row = null;
        },
      };
    },
  },
}));

mock.module('../projects/lib/access', () => ({
  loadProjectForUser: async () => ({
    row: { accountId: ACCOUNT_ID, projectId: PROJECT_ID },
    userId: USER_ID,
    accountRole: 'owner',
    projectRole: 'owner',
    effectiveRole: 'owner',
    adminBypass: false,
  }),
  assertProjectCapability: async () => undefined,
}));

mock.module('../projects/lib/sandbox-env-sync', () => ({
  propagateProjectSecretsToActiveSandboxes: async (projectId: string, options: unknown) => {
    propagations.push({ projectId, options });
  },
}));

mock.module('../shared/audit', () => ({
  inferAuditSource: () => 'api',
  recordAuditEvent: async (event: Record<string, unknown>) => {
    audits.push(event);
  },
}));

const { projectsApp } = await import('../projects/lib/app');
await import('../projects/routes/r3');

function buildApp() {
  const app = new Hono<{
    Variables: {
      userId: string;
      agentGrant: Record<string, unknown>;
    };
  }>();
  app.use('*', async (c, next) => {
    c.set('userId', USER_ID);
    if (agentGrant) c.set('agentGrant', agentGrant);
    await next();
  });
  app.route('/v1/projects', projectsApp);
  return app;
}

describe('PUT /v1/projects/:projectId/secrets/:identifier/strategy', () => {
  beforeEach(() => {
    row = secretRow();
    agentGrant = null;
    updates.length = 0;
    audits.length = 0;
    propagations.length = 0;
  });

  test('changes runtime to denied and records metadata-only audit data', async () => {
    const response = await buildApp().request(
      `/v1/projects/${PROJECT_ID}/secrets/SERVICE_API_KEY/strategy`,
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ strategy: 'denied' }),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      identifier: 'SERVICE_API_KEY',
      strategy: 'denied',
      delivery_status: 'disabled',
      requires_rotation: true,
    });
    expect(updates).toHaveLength(1);
    expect(updates[0]?.strategy).toBe('denied');
    expect(propagations).toHaveLength(1);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      accountId: ACCOUNT_ID,
      projectId: PROJECT_ID,
      actorUserId: USER_ID,
      action: 'secret.strategy.changed',
      resourceType: 'project_secret',
      resourceId: SECRET_ID,
      before: { strategy: 'runtime' },
      after: { strategy: 'denied', requires_rotation: true },
      metadata: { identifier: 'SERVICE_API_KEY', name: 'SERVICE_API_KEY' },
    });
    expect(JSON.stringify(audits[0])).not.toContain('encrypted-value');
  });

  test.each(['broker', 'egress'] as const)(
    'rejects unavailable %s delivery without changing the row',
    async (strategy) => {
      const response = await buildApp().request(
        `/v1/projects/${PROJECT_ID}/secrets/SERVICE_API_KEY/strategy`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ strategy }),
        },
      );

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: 'secret_delivery_unavailable' });
      expect(updates).toHaveLength(0);
      expect(audits).toHaveLength(0);
    },
  );

  test('rejects an agent principal', async () => {
    agentGrant = { env: ['SERVICE_API_KEY'] };

    const response = await buildApp().request(
      `/v1/projects/${PROJECT_ID}/secrets/SERVICE_API_KEY/strategy`,
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ strategy: 'denied' }),
      },
    );

    expect(response.status).toBe(403);
    expect(updates).toHaveLength(0);
  });

  test('rejects a locked strategy', async () => {
    row = secretRow({ strategyLocked: true });

    const response = await buildApp().request(
      `/v1/projects/${PROJECT_ID}/secrets/SERVICE_API_KEY/strategy`,
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ strategy: 'denied' }),
      },
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'secret_strategy_locked' });
    expect(updates).toHaveLength(0);
  });
});

describe('POST /v1/projects/:projectId/secrets audit', () => {
  beforeEach(() => {
    row = null;
    agentGrant = null;
    updates.length = 0;
    audits.length = 0;
    propagations.length = 0;
  });

  test('records a metadata-only create event and marks the value rotated', async () => {
    const response = await buildApp().request(`/v1/projects/${PROJECT_ID}/secrets`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'SERVICE_API_KEY', value: 'plaintext-test-value' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      identifier: 'SERVICE_API_KEY',
      strategy: 'runtime',
      delivery_status: 'available',
      last_rotated_at: expect.any(String),
      requires_rotation: false,
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      action: 'secret.created',
      resourceType: 'project_secret',
      resourceId: SECRET_ID,
      before: null,
      after: { configured: true, strategy: 'runtime', rotated: true },
      metadata: { identifier: 'SERVICE_API_KEY', name: 'SERVICE_API_KEY' },
    });
    expect(JSON.stringify(audits[0])).not.toContain('plaintext-test-value');
  });
});

describe('DELETE /v1/projects/:projectId/secrets/:identifier audit', () => {
  beforeEach(() => {
    row = secretRow({ valueEnc: 'encrypted-delete-value', strategy: 'denied' });
    agentGrant = null;
    updates.length = 0;
    audits.length = 0;
    propagations.length = 0;
  });

  test('records the deleted policy metadata without the encrypted value', async () => {
    const response = await buildApp().request(
      `/v1/projects/${PROJECT_ID}/secrets/SERVICE_API_KEY`,
      { method: 'DELETE' },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      action: 'secret.deleted',
      resourceType: 'project_secret',
      resourceId: SECRET_ID,
      before: { configured: true, strategy: 'denied' },
      after: { configured: false },
      metadata: { identifier: 'SERVICE_API_KEY', name: 'SERVICE_API_KEY' },
    });
    expect(JSON.stringify(audits[0])).not.toContain('encrypted-delete-value');
  });
});
