/**
 * Unit tests for the GitHub App's OWN OAuth identity-proof flow — the
 * App-native replacement for routing account-linking's "prove your GitHub
 * identity" step through Supabase's separate, dual-purpose GitHub login
 * provider (which broke in production when that unrelated provider was
 * disabled on the dev Supabase project — the flow's uptime should never have
 * depended on it).
 *
 * Covers:
 *  - githubAppClientId / githubAppClientSecret / isGithubAppOAuthConfigured
 *    (projects/github.ts) — DB-first, env-fallback, same shape as every
 *    other githubApp* accessor.
 *  - signGitHubOAuthState / verifyGitHubOAuthState (platform/routes/
 *    github-app.ts) — the CSRF state round-tripped through GitHub's
 *    /login/oauth/authorize → oauth/callback redirect.
 *  - exchangeGitHubOAuthCode — the code→token exchange against GitHub,
 *    with an injected fetch so no network call is made.
 *
 * Mocks only `platform/services/managed-github-app` (the DB-cache module);
 * everything downstream runs for real. Must run in its own `bun test <file>`
 * invocation — see the same convention/caveat in
 * unit-github-app-isconfigured.test.ts.
 */
import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { ManagedGithubAppConfig } from '../platform/services/managed-github-app';

let dbConfig: ManagedGithubAppConfig = {};

mock.module('../platform/services/managed-github-app', () => ({
  managedGithubAppConfig: () => dbConfig,
  refreshManagedGithubAppConfig: async () => {},
  invalidateManagedGithubAppConfig: () => {},
  resetManagedGithubAppConfig: async () => {
    dbConfig = {};
  },
  updateManagedGithubAppConfig: async (patch: ManagedGithubAppConfig) => {
    dbConfig = { ...dbConfig, ...patch };
    return dbConfig;
  },
}));

const { githubAppClientId, githubAppClientSecret, isGithubAppOAuthConfigured } = await import(
  '../projects/github'
);
const { signGitHubOAuthState, verifyGitHubOAuthState, exchangeGitHubOAuthCode } = await import(
  '../platform/routes/github-app'
);

const ENV_KEYS = [
  'KORTIX_GITHUB_APP_CLIENT_ID',
  'GITHUB_APP_CLIENT_ID',
  'KORTIX_GITHUB_APP_CLIENT_SECRET',
  'GITHUB_APP_CLIENT_SECRET',
  'SUPABASE_JWT_SECRET',
] as const;
const savedEnv: Record<string, string | undefined> = {};
for (const k of ENV_KEYS) savedEnv[k] = process.env[k];

beforeEach(() => {
  dbConfig = {};
  for (const k of ENV_KEYS) delete process.env[k];
  process.env.SUPABASE_JWT_SECRET = 'test-supabase-jwt-secret';
});

describe('githubAppClientId / githubAppClientSecret (DB-first, env-fallback)', () => {
  test('null when nothing is configured', () => {
    expect(githubAppClientId()).toBeNull();
    expect(githubAppClientSecret()).toBeNull();
  });

  test('reads from the DB config (manifest flow / POST /app)', () => {
    dbConfig = { clientId: 'Iv1.db-client-id', clientSecret: 'db-secret' };
    expect(githubAppClientId()).toBe('Iv1.db-client-id');
    expect(githubAppClientSecret()).toBe('db-secret');
  });

  test('falls back to KORTIX_GITHUB_APP_CLIENT_ID/SECRET (hosted Kortix env config)', () => {
    process.env.KORTIX_GITHUB_APP_CLIENT_ID = 'Iv1.env-client-id';
    process.env.KORTIX_GITHUB_APP_CLIENT_SECRET = 'env-secret';
    expect(githubAppClientId()).toBe('Iv1.env-client-id');
    expect(githubAppClientSecret()).toBe('env-secret');
  });

  test('falls back to the unprefixed GITHUB_APP_CLIENT_ID/SECRET', () => {
    process.env.GITHUB_APP_CLIENT_ID = 'Iv1.unprefixed';
    process.env.GITHUB_APP_CLIENT_SECRET = 'unprefixed-secret';
    expect(githubAppClientId()).toBe('Iv1.unprefixed');
    expect(githubAppClientSecret()).toBe('unprefixed-secret');
  });

  test('DB value wins over env when both are set', () => {
    dbConfig = { clientId: 'from-db' };
    process.env.KORTIX_GITHUB_APP_CLIENT_ID = 'from-env';
    expect(githubAppClientId()).toBe('from-db');
  });
});

describe('isGithubAppOAuthConfigured — independent of isGithubAppConfigured', () => {
  test('false with nothing set', () => {
    expect(isGithubAppOAuthConfigured()).toBe(false);
  });

  test('false with only a client id (secret missing — e.g. a pasted App with no OAuth creds)', () => {
    dbConfig = { clientId: 'Iv1.abc' };
    expect(isGithubAppOAuthConfigured()).toBe(false);
  });

  test('true once both client id and secret are present, regardless of appId/privateKey', () => {
    dbConfig = { clientId: 'Iv1.abc', clientSecret: 'shh' };
    expect(isGithubAppOAuthConfigured()).toBe(true);
  });
});

describe('signGitHubOAuthState / verifyGitHubOAuthState', () => {
  test('round-trips a valid https frontend origin', () => {
    const token = signGitHubOAuthState('https://dev.kortix.com');
    const verified = verifyGitHubOAuthState(token);
    expect(verified?.frontendOrigin).toBe('https://dev.kortix.com');
    expect(verified?.nonce).toBeTruthy();
  });

  test('round-trips a localhost origin (local dev)', () => {
    const token = signGitHubOAuthState('http://localhost:13108');
    expect(verifyGitHubOAuthState(token)?.frontendOrigin).toBe('http://localhost:13108');
  });

  test('throws when the frontend origin is not a valid/allowed URL', () => {
    expect(() => signGitHubOAuthState('not-a-url')).toThrow();
  });

  test('rejects a plain http origin that is not localhost (open-redirect guard)', () => {
    // normalizeGitHubFrontendOrigin only allows https, or http on
    // localhost/127.0.0.1 — signing with an attacker-controlled http origin
    // must fail closed rather than silently downgrade/accept it.
    expect(() => signGitHubOAuthState('http://attacker.example')).toThrow();
  });

  test('returns null for undefined/null/empty', () => {
    expect(verifyGitHubOAuthState(undefined)).toBeNull();
    expect(verifyGitHubOAuthState(null)).toBeNull();
    expect(verifyGitHubOAuthState('')).toBeNull();
  });

  test('returns null for a malformed token (wrong part count)', () => {
    expect(verifyGitHubOAuthState('only-one-part')).toBeNull();
    expect(verifyGitHubOAuthState('a.b.c')).toBeNull();
  });

  test('returns null when the signature is tampered', () => {
    const token = signGitHubOAuthState('https://dev.kortix.com');
    const [body, mac] = token.split('.');
    const tamperedMac = mac!.endsWith('A') ? mac!.slice(0, -1) + 'B' : mac!.slice(0, -1) + 'A';
    expect(verifyGitHubOAuthState(`${body}.${tamperedMac}`)).toBeNull();
  });

  test('returns null past the 10-minute TTL', () => {
    const elevenMinAgo = Date.now() - 11 * 60 * 1000;
    const token = signGitHubOAuthState('https://dev.kortix.com', elevenMinAgo);
    expect(verifyGitHubOAuthState(token, Date.now())).toBeNull();
  });

  test('accepts a token just inside the 10-minute TTL', () => {
    const nineMinAgo = Date.now() - 9 * 60 * 1000;
    const token = signGitHubOAuthState('https://dev.kortix.com', nineMinAgo);
    expect(verifyGitHubOAuthState(token, Date.now())?.frontendOrigin).toBe('https://dev.kortix.com');
  });

  test('two states for the same origin carry different nonces', () => {
    const a = signGitHubOAuthState('https://dev.kortix.com');
    const b = signGitHubOAuthState('https://dev.kortix.com');
    expect(verifyGitHubOAuthState(a)?.nonce).not.toBe(verifyGitHubOAuthState(b)?.nonce);
  });
});

describe('exchangeGitHubOAuthCode', () => {
  test('throws when OAuth client credentials are not configured', async () => {
    await expect(
      exchangeGitHubOAuthCode({ code: 'abc', redirectUri: 'https://dev-api.kortix.com/cb' }),
    ).rejects.toThrow(/not configured/i);
  });

  test('returns the access token on a successful exchange, posting client creds + code + redirect_uri', async () => {
    dbConfig = { clientId: 'Iv1.client', clientSecret: 'shh' };
    let capturedBody: any = null;
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      capturedBody = JSON.parse(init!.body as string);
      return new Response(JSON.stringify({ access_token: 'ghu_token123' }), { status: 200 });
    }) as unknown as typeof fetch;

    const token = await exchangeGitHubOAuthCode(
      { code: 'the-code', redirectUri: 'https://dev-api.kortix.com/v1/platform/github-app/oauth/callback' },
      fetchImpl,
    );

    expect(token).toBe('ghu_token123');
    expect(capturedBody).toEqual({
      client_id: 'Iv1.client',
      client_secret: 'shh',
      code: 'the-code',
      redirect_uri: 'https://dev-api.kortix.com/v1/platform/github-app/oauth/callback',
    });
  });

  test('throws when GitHub responds with an OAuth error body', async () => {
    dbConfig = { clientId: 'Iv1.client', clientSecret: 'shh' };
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({ error: 'bad_verification_code', error_description: 'The code passed is incorrect or expired.' }),
        { status: 200 },
      )) as unknown as typeof fetch;

    await expect(
      exchangeGitHubOAuthCode({ code: 'stale', redirectUri: 'https://x/cb' }, fetchImpl),
    ).rejects.toThrow(/incorrect or expired/i);
  });

  test('throws when GitHub responds with a non-2xx status', async () => {
    dbConfig = { clientId: 'Iv1.client', clientSecret: 'shh' };
    const fetchImpl = (async () => new Response('server error', { status: 500 })) as unknown as typeof fetch;

    await expect(
      exchangeGitHubOAuthCode({ code: 'x', redirectUri: 'https://x/cb' }, fetchImpl),
    ).rejects.toThrow(/500/);
  });
});
