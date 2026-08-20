# Sandbox preview origins

Every sandbox port a user can open in a browser is served on its own hostname:

```
{env}-p{port}-{sandbox-label}.p.kortix.com
dev-p8081-sbx-01m0g4hxcm32bx5r1gpyzdyc1h.p.kortix.com
```

Locally the same shape without the environment prefix:
`p8081-sbx-01m0….localhost:8008`.

## Why not a path prefix

The path form `/v1/p/{sandbox}/{port}/…` still exists and still works — for
programmatic clients. It is not a browser surface. An app served under a path
prefix escapes it the moment it emits anything root-absolute:

| the app writes | the browser resolves to | result under a path prefix |
| --- | --- | --- |
| `<a href="/learn">` | `https://dev-api.kortix.com/learn` | API 404 |
| `fetch('/api/items')` | `https://dev-api.kortix.com/api/items` | API 404 |
| `history.pushState('/x')` | address bar leaves the prefix | reload 404s |
| `url(/bg.png)` in CSS | `https://dev-api.kortix.com/bg.png` | missing asset |
| service worker scope `/` | the API origin | registration rejected |
| `new WebSocket('/hmr')` | the API origin | no hot reload |

Only `Location:` redirects can be repaired at the proxy, and they already are
(`sanitizeRedirectLocation`). Nothing else is visible to it. Rewriting HTML does
not close the set either — a minified bundle builds URLs at runtime.

A second reason: under the path form, arbitrary sandbox code runs on the SAME
origin as the Kortix API, so two of a user's previews share cookies and storage
with each other. An origin per preview puts each app in its own principal.

## The pieces

| piece | file |
| --- | --- |
| hostname shape (build + match) | `apps/api/src/sandbox-proxy/preview-hosts.ts` |
| signed session cookie | `apps/api/src/sandbox-proxy/preview-session.ts` |
| request handling | `apps/api/src/sandbox-proxy/preview-origin.ts` |
| WebSocket upgrade | `apps/api/src/sandbox-proxy/ws-proxy.ts` |
| edge signature | `apps/api/src/shared/edge-signature.ts` |
| edge Worker | `infra/cloudflare/workers/preview-router/` |
| provisioning | `.github/workflows/configure-preview-edge.yml` |
| client URL building | `packages/sdk/src/core/session/url.ts` |

## Auth

1. The client opens the preview with a one-shot `?token=` (a Supabase JWT, a
   Kortix token, or a `?public_share=` token).
2. The proxy validates it, mints an HMAC-signed cookie bound to that one
   (sandbox, port), and — on a top-level navigation — redirects once to the same
   URL without the token, so it never lingers in the address bar or a Referer.
3. Every later request rides the cookie. That is the only credential an app's own
   code can carry: `fetch('/api')` and `new WebSocket('/hmr')` cannot attach a
   header or a query parameter.

Two cookie copies are set, `__kortix_preview` and `__kortix_preview_chips`
(`Partitioned`). A preview is normally an iframe inside the Kortix web app — a
third-party context where an ordinary cookie may be blocked — while the same URL
opened in its own tab is first-party and cannot see a partitioned cookie. One
copy covers each; verification accepts either.

The cookie is stateless by design. The API runs several tasks behind one load
balancer, so anything remembered in a process is invisible to the next request.

## Trust boundary

The Worker forwards to the API's own origin, so the browser's hostname survives
only in `x-kortix-preview-host`. It is signed
(`timestamp \n host \n method \n path?query`, HMAC-SHA256) and the API refuses a
claimed host whose signature does not verify — otherwise anyone reaching the API
origin could name any preview.

The secret is `KORTIX_PREVIEW_EDGE_SECRET` in the API environment, falling back
to `API_KEY_SECRET`, and must equal the Worker secret for that environment
(`DEV_EDGE_SECRET` / `STAGING_EDGE_SECRET` / `PROD_EDGE_SECRET`). A self-host
behind its own reverse proxy sets `KORTIX_PREVIEW_ALLOW_DIRECT_EDGE=true`, which
takes the real `Host` header and requires no signature.

## Provisioning a new environment

1. Set the Worker secret for it:
   `echo -n "<API_KEY_SECRET of that env>" | wrangler secret put PROD_EDGE_SECRET`
   from `infra/cloudflare/workers/preview-router/`.
2. Run **Configure Sandbox Preview Edge** (`workflow_dispatch`). It is
   idempotent: it verifies the Worker route, creates the proxied wildcard DNS
   record, orders the advanced certificate pack if missing, waits for it to go
   active, and probes a synthetic preview host end to end.

Universal SSL covers `kortix.com` and `*.kortix.com` — one label deep. A preview
host is two, so the advanced certificate pack is not optional: without it the TLS
handshake fails before the Worker is ever reached.

## Deployments without a preview domain

`previewBaseDomain()` returns null when the API origin has no registrable domain
(e.g. in-cluster `http://kortix-api:8008`). Then `GET /v1/p/config` answers
`{"preview_url_template": null}` and clients keep using the path proxy. Set
`KORTIX_PREVIEW_BASE_DOMAIN` to opt a self-host in.

## What is still not identical to reaching the box directly

- `X-Frame-Options` and CSP `frame-ancestors` are stripped from responses, so the
  preview can be embedded in the Kortix session panel.
- The upstream sees `Host`/`x-forwarded-host` of the sandbox ingress, not the
  preview hostname. This is deliberate: frameworks that check `Origin` against
  `Host` on mutations (Next.js Server Actions, SvelteKit, Django CSRF) reject a
  mismatch. The true public origin is passed as `X-Forwarded-Prefix`.
- Request bodies are buffered, not streamed, because the proxy retries an
  attempt that fails before delivery.
- `Accept-Encoding` is forced to `identity` upstream, so bytes pass through
  without a decompress/recompress step.
