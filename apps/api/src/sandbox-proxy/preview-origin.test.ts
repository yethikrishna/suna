import { beforeEach, describe, expect, mock, test } from 'bun:test';

const configState: Record<string, unknown> = {
  FRONTEND_URL: 'https://dev.kortix.com',
  KORTIX_URL: 'https://dev-api.kortix.com',
  INTERNAL_KORTIX_ENV: 'dev',
  PORT: 8008,
  API_KEY_SECRET: 'test-secret-value-32-chars-long!!',
  KORTIX_PREVIEW_BASE_DOMAIN: undefined,
};
mock.module('../config', () => ({ config: configState }));

let labelLookups: string[] = [];
let principalCalls: Array<string | null | undefined> = [];
let forwarded = 0;
let forwardedPath = '';
let forwardedQuery = '';
let shares: Record<string, unknown> = {};

mock.module('./backend', () => ({
  resolveExternalIdFromHostLabel: async (label: string) => {
    labelLookups.push(label);
    return label === 'sbx-known' ? 'sbx_KNOWN' : null;
  },
}));
mock.module('./preview-auth', () => ({
  extractPreviewToken: (req: Request, url: URL) =>
    req.headers.get('Authorization')?.replace('Bearer ', '') || url.searchParams.get('token'),
  authenticatePreviewPrincipalDetailed: async (token: string | null) => {
    principalCalls.push(token);
    return token === 'good' ? { userId: 'user-1', sessionId: null } : null;
  },
}));
mock.module('./routes/preview', () => ({
  forwardToSandbox: async (
    _sandboxId: string,
    _port: number,
    _access: unknown,
    _method: string,
    remainingPath: string,
    queryString: string,
  ) => {
    forwarded += 1;
    forwardedPath = remainingPath;
    forwardedQuery = queryString;
    return new Response('upstream', { status: 200 });
  },
}));
mock.module('../shared/session-public-shares', () => ({
  // The REAL blocked set, including the static-file port. An empty mock here
  // once made a file-share test pass against a path the production constant
  // refuses — the test asserted an unreachable branch.
  PUBLIC_SHARE_BLOCKED_PORTS: new Set<number>([22, 4096, 8000, 3211]),
  STATIC_FILE_SHARE_PORT: 3211,
  resolvePublicShare: async (token: string) => shares[token] ?? { ok: false },
  touchPublicShare: async () => {},
}));

const { handlePreviewOriginRequest } = await import('./preview-origin');

const HOST = 'p8081-sbx-known.localhost:8008';

function request(path: string, init: RequestInit = {}, host = HOST): [Request, URL] {
  const req = new Request(`http://127.0.0.1:8008${path}`, {
    ...init,
    headers: { host, ...(init.headers as Record<string, string> | undefined) },
  });
  return [req, new URL(`http://${host.split(':')[0]}:8008${path}`)];
}

beforeEach(() => {
  labelLookups = [];
  principalCalls = [];
  forwarded = 0;
  forwardedPath = '';
  forwardedQuery = '';
  shares = {};
});

describe('preview origin auth gate', () => {
  test('a request with no credential is refused before any database work', async () => {
    const res = await handlePreviewOriginRequest(...request('/learn'));
    expect(res?.status).toBe(401);
    // The label→id lookup cannot use an index, so an anonymous caller must not
    // be able to spend one per made-up hostname.
    expect(labelLookups).toEqual([]);
    expect(principalCalls).toEqual([]);
  });

  test('a hostname that is not a preview falls through to normal API routing', async () => {
    expect(await handlePreviewOriginRequest(...request('/v1/health', {}, 'dev-api.kortix.com'))).toBeNull();
  });

  test('an unknown preview with a credential answers 404, not 401', async () => {
    const [req, url] = request('/learn?token=good', {}, 'p8081-sbx-missing.localhost:8008');
    const res = await handlePreviewOriginRequest(req, url);
    expect(res?.status).toBe(404);
    expect(labelLookups).toEqual(['sbx-missing']);
  });

  test('a valid token mints a cookie and forwards', async () => {
    const [req, url] = request('/learn', { headers: { Authorization: 'Bearer good' } });
    const res = await handlePreviewOriginRequest(req, url);
    expect(res?.status).toBe(200);
    expect(forwarded).toBe(1);
    const cookies = res!.headers.getSetCookie();
    expect(cookies.length).toBe(2);
    expect(cookies.every((c) => c.includes('Secure'))).toBe(true);
    expect(cookies.some((c) => c.includes('Partitioned'))).toBe(true);
  });

  test('a token in the URL is exchanged for a cookie and bounced off the address bar', async () => {
    const [req, url] = request('/learn?token=good&keep=1', {
      headers: { 'sec-fetch-dest': 'document' },
    });
    const res = await handlePreviewOriginRequest(req, url);
    expect(res?.status).toBe(302);
    // The credential is gone; everything else the app was asked for survives.
    expect(res?.headers.get('location')).toBe('/learn?keep=1');
    expect(res!.headers.getSetCookie().length).toBe(2);
    expect(forwarded).toBe(0);
  });

  test('a sub-resource with a token is served directly, not redirected', async () => {
    const [req, url] = request('/app.js?token=good', { headers: { 'sec-fetch-dest': 'script' } });
    const res = await handlePreviewOriginRequest(req, url);
    expect(res?.status).toBe(200);
    expect(forwarded).toBe(1);
  });

  test('an invalid token is refused', async () => {
    const [req, url] = request('/learn?token=nope');
    const res = await handlePreviewOriginRequest(req, url);
    expect(res?.status).toBe(401);
    expect(principalCalls).toEqual(['nope']);
  });

  test('a CORS preflight is answered before auth', async () => {
    const [req, url] = request('/api', { method: 'OPTIONS', headers: { Origin: 'https://x.test' } });
    const res = await handlePreviewOriginRequest(req, url);
    expect(res?.status).toBe(204);
    expect(res?.headers.get('Access-Control-Allow-Origin')).toBe('https://x.test');
    expect(principalCalls).toEqual([]);
  });

  test('self-host direct-edge mode serves the real Host with no signature', async () => {
    // No Cloudflare Worker fronts a self-host: the operator's own reverse proxy
    // (the bundled Caddy) is the trust boundary and passes the real Host
    // through untouched.
    configState.KORTIX_PREVIEW_BASE_DOMAIN = 'p.acme.com';
    process.env.KORTIX_PREVIEW_ALLOW_DIRECT_EDGE = 'true';
    try {
      const [req, url] = request(
        '/learn?token=good',
        {},
        `dev-p8081-${'sbx-known'}.p.acme.com`,
      );
      const res = await handlePreviewOriginRequest(req, url);
      expect(res?.status).toBe(200);
      expect(forwarded).toBe(1);
    } finally {
      delete process.env.KORTIX_PREVIEW_ALLOW_DIRECT_EDGE;
      configState.KORTIX_PREVIEW_BASE_DOMAIN = undefined;
    }
  });

  test('direct-edge mode ignores a claimed host header — only the real Host counts', async () => {
    // Otherwise anyone reaching a self-host API directly could name any preview
    // by setting a header, which is the whole reason the header is signed on
    // Kortix Cloud.
    configState.KORTIX_PREVIEW_BASE_DOMAIN = 'p.acme.com';
    process.env.KORTIX_PREVIEW_ALLOW_DIRECT_EDGE = 'true';
    try {
      const [req, url] = request(
        '/learn?token=good',
        { headers: { 'x-kortix-preview-host': 'dev-p8081-sbx-known.p.acme.com' } },
        'api.acme.com',
      );
      expect(await handlePreviewOriginRequest(req, url)).toBeNull();
      expect(forwarded).toBe(0);
    } finally {
      delete process.env.KORTIX_PREVIEW_ALLOW_DIRECT_EDGE;
      configState.KORTIX_PREVIEW_BASE_DOMAIN = undefined;
    }
  });

  test('a claimed preview host without an edge signature is refused', async () => {
    configState.KORTIX_PREVIEW_BASE_DOMAIN = 'p.kortix.com';
    const [req, url] = request(
      '/learn?token=good',
      { headers: { 'x-kortix-preview-host': 'dev-p8081-sbx-known.p.kortix.com' } },
      'dev-api.kortix.com',
    );
    const res = await handlePreviewOriginRequest(req, url);
    expect(res?.status).toBe(403);
    expect(labelLookups).toEqual([]);
    configState.KORTIX_PREVIEW_BASE_DOMAIN = undefined;
  });
});

describe('what a browser is shown instead of JSON', () => {
  test('the address it sends people back to keeps the port', async () => {
    // publicHost feeds both this and X-Forwarded-Prefix, so a stripped port
    // would send local development to the wrong listener in both places.
    const [req, url] = request('/learn', { headers: { 'sec-fetch-dest': 'document' } });
    const html = await (await handlePreviewOriginRequest(req, url))!.text();
    expect(html).toContain('http://p8081-sbx-known.localhost:8008/learn');
  });

  test('a person navigating with no credential gets a page they can act on', async () => {
    const [req, url] = request('/learn', { headers: { 'sec-fetch-dest': 'document' } });
    const res = await handlePreviewOriginRequest(req, url);
    expect(res?.status).toBe(401);
    expect(res?.headers.get('content-type')).toContain('text/html');
    const html = await res!.text();
    expect(html).toContain('Sign in to open this preview');
    // The action carries them to the web app, which brings them back here.
    expect(html).toContain('https://dev.kortix.com/preview/authorize?to=');
    expect(html).toContain(encodeURIComponent('http://p8081-sbx-known.localhost:8008/learn'));
    // A sign-in flow must never try to render inside the preview frame.
    expect(html).toContain('target="_top"');
  });

  test('an iframe load is a navigation too', async () => {
    const [req, url] = request('/', { headers: { 'sec-fetch-dest': 'iframe' } });
    const res = await handlePreviewOriginRequest(req, url);
    expect(res?.headers.get('content-type')).toContain('text/html');
  });

  test('a sub-resource still gets JSON — an app must never be handed HTML', async () => {
    for (const dest of ['empty', 'script', 'style', 'image']) {
      const [req, url] = request('/api/items', { headers: { 'sec-fetch-dest': dest } });
      const res = await handlePreviewOriginRequest(req, url);
      expect(res?.status).toBe(401);
      expect(res?.headers.get('content-type')).toContain('application/json');
    }
  });

  test('a preview that no longer exists says so, and offers no sign-in', async () => {
    const [req, url] = request('/?token=good', { headers: { 'sec-fetch-dest': 'document' } }, 'p8081-sbx-missing.localhost:8008');
    const res = await handlePreviewOriginRequest(req, url);
    expect(res?.status).toBe(404);
    const html = await res!.text();
    expect(html).toContain('no longer available');
    expect(html).not.toContain('/preview/authorize');
  });

  test('an unsigned claimed host explains itself rather than dumping JSON', async () => {
    configState.KORTIX_PREVIEW_BASE_DOMAIN = 'p.kortix.com';
    try {
      const [req, url] = request(
        '/learn',
        { headers: { 'x-kortix-preview-host': 'dev-p8081-sbx-known.p.kortix.com', 'sec-fetch-dest': 'document' } },
        'dev-api.kortix.com',
      );
      const res = await handlePreviewOriginRequest(req, url);
      expect(res?.status).toBe(403);
      expect(res?.headers.get('content-type')).toContain('text/html');
    } finally {
      configState.KORTIX_PREVIEW_BASE_DOMAIN = undefined;
    }
  });
});

describe('a public share names one thing', () => {
  test('a file share is pinned to its own file, whatever the visitor asks for', async () => {
    shares = {
      'file-token': {
        ok: true,
        row: {
          shareId: 's-file',
          mode: 'view',
          resourceType: 'file',
          externalId: 'sbx_KNOWN',
          port: null,
          filePath: '/workspace/report.html',
        },
      },
    };
    const [req, url] = request(
      '/etc/passwd?public_share=file-token',
      {},
      'p3211-sbx-known.localhost:8008',
    );
    const res = await handlePreviewOriginRequest(req, url);
    expect(res?.status).toBe(200);
    // Not /etc/passwd: the share's own file, through the static-web entry.
    expect(forwardedPath).toBe('/open');
    expect(forwardedQuery).toBe(`?path=${encodeURIComponent('/workspace/report.html')}`);
  });

  test('a file share is not a key to the static-web port on another port', async () => {
    shares = {
      'file-token': {
        ok: true,
        row: {
          shareId: 's-file',
          mode: 'view',
          resourceType: 'file',
          externalId: 'sbx_KNOWN',
          port: null,
          filePath: '/workspace/report.html',
        },
      },
    };
    const [req, url] = request('/?public_share=file-token', {}, 'p8081-sbx-known.localhost:8008');
    expect((await handlePreviewOriginRequest(req, url))?.status).toBe(401);
  });

  test('a preview share is refused on a port it does not name', async () => {
    shares = {
      'prev-token': {
        ok: true,
        row: {
          shareId: 's-prev',
          mode: 'view',
          resourceType: 'preview',
          externalId: 'sbx_KNOWN',
          port: 8081,
          filePath: null,
        },
      },
    };
    const [req, url] = request('/?public_share=prev-token', {}, 'p9999-sbx-known.localhost:8008');
    expect((await handlePreviewOriginRequest(req, url))?.status).toBe(401);
  });
});

describe('the blocked-port set applies to the share kind it was written for', () => {
  test('a file share works on the static-file port, which is exactly what serves it', async () => {
    shares = {
      't': {
        ok: true,
        row: {
          shareId: 's', mode: 'view', resourceType: 'file', externalId: 'sbx_KNOWN',
          port: null, filePath: '/workspace/a.html',
        },
      },
    };
    const [req, url] = request('/?public_share=t', {}, 'p3211-sbx-known.localhost:8008');
    expect((await handlePreviewOriginRequest(req, url))?.status).toBe(200);
  });

  test('a preview share still cannot name an infrastructure port', async () => {
    for (const port of [22, 4096, 8000, 3211]) {
      shares = {
        't': {
          ok: true,
          row: {
            shareId: 's', mode: 'view', resourceType: 'preview', externalId: 'sbx_KNOWN',
            port, filePath: null,
          },
        },
      };
      const [req, url] = request('/?public_share=t', {}, `p${port}-sbx-known.localhost:8008`);
      expect((await handlePreviewOriginRequest(req, url))?.status).toBe(401);
    }
  });
});
