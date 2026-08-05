import { beforeEach, describe, expect, mock, test } from 'bun:test';

let rows: Array<Record<string, unknown>> = [];
const audits: Array<Record<string, unknown>> = [];

mock.module('../shared/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: async () => rows,
      }),
    }),
  },
}));

mock.module('../shared/audit', () => ({
  recordAuditEvent: async (event: Record<string, unknown>) => {
    audits.push(event);
  },
}));

const { decryptProjectSecret, encryptProjectSecret, getProjectSecretValueForConsumer } =
  await import('./secrets');

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const ACCOUNT_ID = '22222222-2222-4222-8222-222222222222';
const SESSION_ID = 'session-1';

function secret(overrides: Record<string, unknown> = {}) {
  return {
    secretId: '33333333-3333-4333-8333-333333333333',
    identifier: 'provider-primary',
    valueEnc: encryptProjectSecret(PROJECT_ID, 'plaintext-test-value'),
    scope: 'runtime',
    active: true,
    strategy: 'broker',
    consumer: 'llm_gateway',
    updatedAt: new Date('2026-08-05T12:00:00.000Z'),
    ...overrides,
  };
}

function read() {
  return getProjectSecretValueForConsumer({
    projectId: PROJECT_ID,
    accountId: ACCOUNT_ID,
    sessionId: SESSION_ID,
    actorUserId: '44444444-4444-4444-8444-444444444444',
    name: 'provider_key',
    consumer: 'llm_gateway',
  });
}

describe('getProjectSecretValueForConsumer', () => {
  beforeEach(() => {
    rows = [];
    audits.length = 0;
  });

  test('returns plaintext only to the configured consumer and records the use', async () => {
    rows = [secret()];

    expect(await read()).toBe('plaintext-test-value');
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      accountId: ACCOUNT_ID,
      projectId: PROJECT_ID,
      sessionId: SESSION_ID,
      actorType: 'agent',
      source: 'llm_gateway',
      action: 'secret.consumer.used',
      resourceType: 'project_secret',
      metadata: {
        identifier: 'provider-primary',
        name: 'PROVIDER_KEY',
        consumer: 'llm_gateway',
      },
    });
    expect(JSON.stringify(audits)).not.toContain('plaintext-test-value');
  });

  test('denies a runtime sandbox secret to the LLM gateway', async () => {
    rows = [secret({ strategy: 'runtime', consumer: 'sandbox' })];

    expect(await read()).toBeNull();
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      outcome: 'denied',
      action: 'secret.consumer.denied',
      metadata: {
        requested_consumer: 'llm_gateway',
        configured_consumer: 'sandbox',
      },
    });
    expect(JSON.stringify(audits)).not.toContain('plaintext-test-value');
  });

  test('allows a connector-scoped legacy row only through the connector boundary', async () => {
    rows = [secret({ scope: 'connector', strategy: 'runtime', consumer: 'connector' })];

    expect(
      await getProjectSecretValueForConsumer({
        projectId: PROJECT_ID,
        accountId: ACCOUNT_ID,
        sessionId: SESSION_ID,
        actorUserId: '44444444-4444-4444-8444-444444444444',
        name: 'provider_key',
        consumer: 'connector',
      }),
    ).toBe('plaintext-test-value');
    expect(audits[0]).toMatchObject({
      source: 'connector',
      action: 'secret.consumer.used',
      metadata: { consumer: 'connector' },
    });
    expect(JSON.stringify(audits)).not.toContain('plaintext-test-value');
  });

  test('allows a broker row assigned to the connector consumer', async () => {
    rows = [secret({ strategy: 'broker', consumer: 'connector' })];

    expect(
      await getProjectSecretValueForConsumer({
        projectId: PROJECT_ID,
        accountId: ACCOUNT_ID,
        sessionId: SESSION_ID,
        actorUserId: '44444444-4444-4444-8444-444444444444',
        name: 'provider_key',
        consumer: 'connector',
      }),
    ).toBe('plaintext-test-value');
    expect(audits[0]).toMatchObject({ action: 'secret.consumer.used' });
  });

  test('records a denied lookup when the secret is absent', async () => {
    expect(await read()).toBeNull();
    expect(audits).toEqual([
      expect.objectContaining({
        outcome: 'denied',
        action: 'secret.consumer.missing',
        metadata: { name: 'PROVIDER_KEY', consumer: 'llm_gateway' },
      }),
    ]);
  });

  test('denies an inactive secret to its configured consumer', async () => {
    rows = [secret({ active: false })];

    expect(await read()).toBeNull();
    expect(audits[0]).toMatchObject({
      outcome: 'denied',
      action: 'secret.consumer.denied',
    });
  });

  test('returns null and records malformed ciphertext without exposing it', async () => {
    rows = [secret({ valueEnc: 'not-an-envelope' })];

    expect(await read()).toBeNull();
    expect(audits).toEqual([
      expect.objectContaining({
        outcome: 'failure',
        action: 'secret.consumer.invalid',
        metadata: {
          identifier: 'provider-primary',
          name: 'PROVIDER_KEY',
          consumer: 'llm_gateway',
        },
      }),
    ]);
    expect(JSON.stringify(audits)).not.toContain('not-an-envelope');
  });
});

test('project secret encryption preserves an empty value', () => {
  const envelope = encryptProjectSecret(PROJECT_ID, '');

  expect(decryptProjectSecret(PROJECT_ID, envelope)).toBe('');
});
