/**
 * The :3211 static server must not serve the session's credentials.
 *
 * It has NO authentication of its own — it trusts that whoever reached the port
 * was allowed to — and its allowed roots included `/home`, which is exactly
 * where the daemon writes:
 *
 *   ~/.config/kortix-opencode.json          the session's LLM gateway key and,
 *                                           on Daytona, its executor PAT
 *   ~/.local/share/opencode/auth.json       the account's Codex/OpenCode
 *                                           subscription credential
 *
 * Mode 0600 was no defence: this listener runs as the same user that wrote
 * them, so the permission bits were satisfied. And the file's own header
 * comment claimed it binds localhost while it binds 0.0.0.0 — part of why the
 * exposure went unnoticed.
 *
 * These run against the REAL server on a real temp directory, because the
 * property under test is what the process hands back over HTTP, not what a
 * predicate returns.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { startStaticWebServer } from '../static-web'

let server: ReturnType<typeof startStaticWebServer>
let base: string
let scratch: string

beforeAll(() => {
  server = startStaticWebServer(0)
  base = `http://127.0.0.1:${server.port}`
  // Explicitly under `/tmp` — an allowed root. NOT os.tmpdir(), which on macOS
  // is /var/folders/... and would put the fixture outside the roots, making the
  // "still works" tests fail for a reason that has nothing to do with the code.
  scratch = mkdtempSync('/tmp/kortix-staticweb-')
})

afterAll(() => {
  server.stop?.()
  rmSync(scratch, { recursive: true, force: true })
})

async function get(path: string): Promise<{ status: number; body: string }> {
  const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(5000) })
  return { status: res.status, body: await res.text() }
}

describe('the credential files are not readable', () => {
  // The real paths, from opencode.ts. Written for whatever user the daemon runs
  // as, so the test asserts on the ROUTE being refused rather than on a file it
  // would have to create in a real home directory.
  const CREDENTIAL_PATHS = [
    '/home/kortix/.config/kortix-opencode.json',
    '/home/kortix/.local/share/opencode/auth.json',
    '/root/.config/kortix-opencode.json',
    '/home/kortix/.ssh/id_ed25519',
    '/home/kortix/.aws/credentials',
    '/home/kortix/.netrc',
    '/home/kortix/.git-credentials',
  ]

  test.each(CREDENTIAL_PATHS)('/abs%s is refused', async (path) => {
    const { status } = await get(`/abs${path}`)
    expect(status).toBe(403)
  })

  test.each(CREDENTIAL_PATHS)('/open?path=%s is refused', async (path) => {
    const { status } = await get(`/open?path=${encodeURIComponent(path)}`)
    expect(status).toBe(403)
  })

  test('a traversal back into a credential directory is refused', async () => {
    // `normalize()` collapses this to /home/kortix/.config/... before the check,
    // which is why the deny list is matched on the normalized path.
    const { status } = await get(
      '/abs/workspace/../home/kortix/.config/kortix-opencode.json',
    )
    expect(status).toBe(403)
  })

  test('the whole /home root is gone, not just the credential paths', async () => {
    const { status } = await get('/abs/home/kortix/notes.txt')
    expect(status).toBe(403)
  })

  test('/opt is gone too', async () => {
    const { status } = await get('/abs/opt/anything.html')
    expect(status).toBe(403)
  })
})

describe('serving agent output still works', () => {
  test('an HTML file under /tmp is served', async () => {
    // The purpose of this server. If this breaks, the narrowing went too far.
    const dir = join(scratch, 'preview')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'report.html'), '<html><body>REPORT_OK</body></html>')

    const { status, body } = await get(`/abs${dir}/report.html`)
    expect(status).toBe(200)
    expect(body).toContain('REPORT_OK')
  })

  test('a dotfile that is NOT a credential directory is still served', async () => {
    // Build output lives in dot-directories (`.next`, `.output`). A blanket
    // "refuse any dot component" rule would have been simpler and would have
    // broken them, so the deny list names credential directories specifically.
    const dir = join(scratch, '.next', 'static')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'app.html'), '<html><body>BUILD_OK</body></html>')

    const { status, body } = await get(`/abs${dir}/app.html`)
    expect(status).toBe(200)
    expect(body).toContain('BUILD_OK')
  })
})
