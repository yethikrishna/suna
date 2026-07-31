import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { Hono } from 'hono';

let auditRows: Array<Record<string, unknown>> = [];

mock.module('../shared/db', () => ({
  db: {
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        auditRows.push(values);
        return {
          returning: async () => [{
            eventId: 'audit_test',
            occurredAt: new Date('2026-01-01T00:00:00Z'),
            ...values,
          }],
        };
      },
    }),
    select: () => {
      const chain = {
        from: () => chain,
        where: () => chain,
        then: (resolve: (rows: unknown[]) => unknown) => Promise.resolve(resolve([])),
      };
      return chain;
    },
  },
}));

const { auditApiRequest } = await import('../shared/audit');

describe('audit event middleware', () => {
  beforeEach(() => {
    auditRows = [];
  });

  test('records a successful API mutation with the full request envelope', async () => {
    const app = new Hono();
    app.use('/v1/*', auditApiRequest);
    app.post('/v1/projects/:projectId/sessions/:sessionId/messages', async (c) => {
      (c as any).set('userId', '00000000-0000-4000-a000-000000000001');
      (c as any).set('accountId', '00000000-0000-4000-a000-000000000101');
      (c as any).set('authType', 'pat');
      (c as any).set('sessionId', c.req.param('sessionId'));
      return c.json({ ok: true });
    });

    const res = await app.request(
      '/v1/projects/00000000-0000-4000-a000-000000000201/sessions/session-1/messages',
      {
      method: 'POST',
      headers: { 'User-Agent': 'kortix-cli/dev', 'X-Kortix-Client': 'cli' },
      body: '{}',
      },
    );

    expect(res.status).toBe(200);
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]).toMatchObject({
      accountId: '00000000-0000-4000-a000-000000000101',
      projectId: '00000000-0000-4000-a000-000000000201',
      sessionId: 'session-1',
      actorUserId: '00000000-0000-4000-a000-000000000001',
      actorType: 'agent',
      source: 'cli',
      outcome: 'success',
      httpStatus: 200,
      action:
        'POST /v1/projects/00000000-0000-4000-a000-000000000201/sessions/session-1/messages',
      resourceType: 'project_session',
      resourceId: 'session-1',
      userAgent: 'kortix-cli/dev',
    });
    expect(auditRows[0]?.durationMs).toBeNumber();
  });

  test('records failed mutations with a failure outcome', async () => {
    const app = new Hono();
    app.use('/v1/*', auditApiRequest);
    app.post('/v1/projects/:projectId/secrets', async (c) => {
      (c as any).set('userId', '00000000-0000-4000-a000-000000000001');
      (c as any).set('accountId', '00000000-0000-4000-a000-000000000101');
      (c as any).set('authType', 'supabase');
      return c.json({ error: 'bad input' }, 400);
    });

    const res = await app.request('/v1/projects/project-1/secrets', { method: 'POST' });

    expect(res.status).toBe(400);
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]).toMatchObject({
      actorType: 'human',
      source: 'web',
      outcome: 'failure',
      httpStatus: 400,
    });
  });

  test('records authenticated reads', async () => {
    const app = new Hono();
    app.use('/v1/*', auditApiRequest);
    app.get('/v1/accounts/:accountId/projects', async (c) => {
      (c as any).set('userId', '00000000-0000-4000-a000-000000000001');
      (c as any).set('accountId', c.req.param('accountId'));
      (c as any).set('authType', 'supabase');
      return c.json({ projects: [] });
    });

    const res = await app.request(
      '/v1/accounts/00000000-0000-4000-a000-000000000101/projects',
    );

    expect(res.status).toBe(200);
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]).toMatchObject({
      action: 'GET /v1/accounts/00000000-0000-4000-a000-000000000101/projects',
      outcome: 'success',
      httpStatus: 200,
    });
  });
});
