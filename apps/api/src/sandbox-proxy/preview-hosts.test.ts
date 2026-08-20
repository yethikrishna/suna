import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

const configState: Record<string, unknown> = {
  KORTIX_URL: 'https://dev-api.kortix.com',
  INTERNAL_KORTIX_ENV: 'dev',
  PORT: 8008,
  KORTIX_PREVIEW_BASE_DOMAIN: undefined,
};
mock.module('../config', () => ({ config: configState }));

const {
  previewBaseDomain,
  previewHostname,
  previewOrigin,
  previewUrlTemplate,
  resolvePreviewHost,
  sandboxHostLabel,
} = await import('./preview-hosts');

const SBX = 'sbx_01M0G4HXCM32BX5R1GPYZDYC1H';
const LABEL = 'sbx-01m0g4hxcm32bx5r1gpyzdyc1h';

const savedEnv = { ...process.env };
beforeEach(() => {
  configState.KORTIX_PREVIEW_BASE_DOMAIN = undefined;
  delete process.env.KORTIX_PREVIEW_LOCAL;
  delete process.env.KORTIX_PREVIEW_LOCAL_PORT;
  configState.KORTIX_URL = 'https://dev-api.kortix.com';
  configState.INTERNAL_KORTIX_ENV = 'dev';
  configState.PORT = 8008;
});
afterEach(() => {
  process.env = { ...savedEnv };
});

describe('sandboxHostLabel', () => {
  test('lowercases and replaces the underscore DNS cannot carry', () => {
    expect(sandboxHostLabel(SBX)).toBe(LABEL);
  });
  test('leaves an already-safe id alone', () => {
    expect(sandboxHostLabel('sb-abc123')).toBe('sb-abc123');
  });
  test('produces a label within the 63-character DNS limit', () => {
    expect(sandboxHostLabel(SBX).length).toBeLessThan(50);
  });
});

describe('previewBaseDomain', () => {
  test('derives p.<registrable> from the API origin', () => {
    expect(previewBaseDomain()).toBe('p.kortix.com');
  });
  test('derives the same domain for staging and prod API origins', () => {
    configState.KORTIX_URL = 'https://api.kortix.com';
    expect(previewBaseDomain()).toBe('p.kortix.com');
    configState.KORTIX_URL = 'https://staging-api.kortix.com';
    expect(previewBaseDomain()).toBe('p.kortix.com');
  });
  test('an operator override wins and is normalized', () => {
    configState.KORTIX_PREVIEW_BASE_DOMAIN = 'https://Preview.ACME.io/';
    expect(previewBaseDomain()).toBe('preview.acme.io');
  });
  test('is null when the API origin has no registrable domain', () => {
    configState.KORTIX_URL = 'http://localhost:8008';
    expect(previewBaseDomain()).toBeNull();
  });
});

describe('previewHostname / previewOrigin', () => {
  test('builds the env-prefixed deployed hostname', () => {
    expect(previewHostname(SBX, 8081)).toBe(`dev-p8081-${LABEL}.p.kortix.com`);
    expect(previewOrigin(SBX, 8081)).toBe(`https://dev-p8081-${LABEL}.p.kortix.com`);
  });
  test('each environment gets its own label under one wildcard', () => {
    configState.INTERNAL_KORTIX_ENV = 'prod';
    configState.KORTIX_URL = 'https://api.kortix.com';
    expect(previewHostname(SBX, 3000)).toBe(`prod-p3000-${LABEL}.p.kortix.com`);
  });
  test('local mode serves previews on *.localhost with the API port', () => {
    configState.KORTIX_URL = 'http://localhost:8008';
    expect(previewOrigin(SBX, 3000)).toBe(`http://p3000-${LABEL}.localhost:8008`);
  });
  test('rejects an out-of-range port', () => {
    expect(previewHostname(SBX, 0)).toBeNull();
    expect(previewHostname(SBX, 70000)).toBeNull();
  });
  test('is null when the API origin is a single-label internal host', () => {
    // In-cluster service DNS (`http://kortix-api:8008`) yields no registrable
    // domain, so there is nothing to hang a wildcard off — previews stay on the
    // path proxy rather than publishing a hostname we do not serve.
    configState.KORTIX_URL = 'http://kortix-api:8008';
    expect(previewBaseDomain()).toBeNull();
    expect(previewHostname(SBX, 3000)).toBeNull();
    expect(previewOrigin(SBX, 3000)).toBeNull();
    expect(previewUrlTemplate()).toBeNull();
  });
});

describe('previewUrlTemplate', () => {
  test('carries the shape to the client with only two slots', () => {
    expect(previewUrlTemplate()).toBe('https://dev-p{port}-{sandbox}.p.kortix.com');
  });
  test('local template points at the API port', () => {
    configState.KORTIX_URL = 'http://localhost:8008';
    expect(previewUrlTemplate()).toBe('http://p{port}-{sandbox}.localhost:8008');
  });
});

describe('resolvePreviewHost', () => {
  test('round-trips the hostname it builds', () => {
    const host = previewHostname(SBX, 8081)!;
    expect(resolvePreviewHost(host)).toEqual({ port: 8081, sandboxLabel: LABEL, local: false });
  });
  test('accepts a Host header carrying a port and a trailing dot', () => {
    expect(resolvePreviewHost(`dev-p8081-${LABEL}.p.kortix.com.:443`)).toEqual({
      port: 8081,
      sandboxLabel: LABEL,
      local: false,
    });
  });
  test('matches the local form', () => {
    expect(resolvePreviewHost(`p3000-${LABEL}.localhost:8008`)).toEqual({
      port: 3000,
      sandboxLabel: LABEL,
      local: true,
    });
  });
  test('refuses another environment’s label', () => {
    expect(resolvePreviewHost(`prod-p8081-${LABEL}.p.kortix.com`)).toBeNull();
  });
  test('refuses a nested label that would escape the wildcard certificate', () => {
    expect(resolvePreviewHost(`a.dev-p8081-${LABEL}.p.kortix.com`)).toBeNull();
  });
  test('refuses the API host itself and unrelated hosts', () => {
    expect(resolvePreviewHost('dev-api.kortix.com')).toBeNull();
    expect(resolvePreviewHost('evil.com')).toBeNull();
    expect(resolvePreviewHost('')).toBeNull();
  });
  test('refuses a malformed label', () => {
    expect(resolvePreviewHost('dev-p-abc.p.kortix.com')).toBeNull();
    expect(resolvePreviewHost('dev-8081-abc.p.kortix.com')).toBeNull();
    expect(resolvePreviewHost(`dev-p99999999-${LABEL}.p.kortix.com`)).toBeNull();
  });
});
