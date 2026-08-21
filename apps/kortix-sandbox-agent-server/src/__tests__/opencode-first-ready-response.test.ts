import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { chmodSync, existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { Config } from '../config'
import { createOpencodeSupervisor } from '../opencode'

const MAIN = await Bun.file(new URL('../main.ts', import.meta.url).pathname).text()

let root: string
let supervisor: ReturnType<typeof createOpencodeSupervisor> | null

function reservePort(): number {
  const server = Bun.serve({ port: 0, fetch: () => new Response('reserved') })
  const port = server.port
  server.stop(true)
  if (typeof port !== 'number') throw new Error('Bun did not assign a port')
  return port
}

async function waitFor(check: () => boolean, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (check()) return
    await Bun.sleep(20)
  }
  throw new Error('condition did not become true')
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'kortix-first-ready-response-'))
  supervisor = null
})

afterEach(async () => {
  await supervisor?.stop()
  rmSync(root, { recursive: true, force: true })
})

describe('OpenCode supervisor first ready response', () => {
  test('reports the first successful readiness response once', async () => {
    const workspace = join(root, 'workspace')
    const configDir = join(root, 'config')
    const binary = join(root, 'opencode')
    const readyFile = join(root, 'ready')
    const probedFile = join(root, 'probed')
    mkdirSync(workspace)
    mkdirSync(configDir)
    writeFileSync(
      binary,
      `#!/usr/bin/env bun
import { existsSync, writeFileSync } from 'node:fs'
const port = Number(Bun.argv[Bun.argv.indexOf('--port') + 1])
Bun.serve({
  port,
  hostname: '127.0.0.1',
  fetch: () => {
    writeFileSync(${JSON.stringify(probedFile)}, 'probed')
    return existsSync(${JSON.stringify(readyFile)})
      ? Response.json([])
      : new Response('starting', { status: 503 })
  },
})
`,
    )
    chmodSync(binary, 0o755)

    const cfg = {
      workspace,
      projectTarget: workspace,
      opencodeInternalPort: reservePort(),
      opencodeStandbyPort: reservePort(),
      gitUserName: 'Kortix Agent',
      gitUserEmail: 'agent@kortix.ai',
    } as Config
    let reports = 0
    supervisor = createOpencodeSupervisor(cfg, configDir, undefined, {
      binaryPathOverride: binary,
      configPathOverride: join(root, 'runtime-config.json'),
      onFirstReadyResponse: () => {
        reports += 1
      },
    })

    await supervisor.start()
    await waitFor(() => existsSync(probedFile))
    expect(reports).toBe(0)

    writeFileSync(readyFile, 'ready')
    await waitFor(() => reports === 1)
    expect(supervisor.getState()).toBe('ok')

    await supervisor.restart()
    await waitFor(() => supervisor?.getState() === 'ok')
    expect(reports).toBe(1)
  }, 15_000)

  test('wires the first ready response to its own de-duplicated boot mark', () => {
    const supervisorAt = MAIN.indexOf('const opencode = createOpencodeSupervisor(')
    const sessionRuntimeAt = MAIN.indexOf('void startSessionRuntime(', supervisorAt)
    const bootPath = MAIN.slice(supervisorAt, sessionRuntimeAt)
    const callbackAt = bootPath.indexOf('onFirstReadyResponse: () => {')
    const fastPathAt = bootPath.indexOf('nativeBinaryFastPathEnabled:', callbackAt)
    const callback = bootPath.slice(callbackAt, fastPathAt)

    expect(supervisorAt).toBeGreaterThan(-1)
    expect(sessionRuntimeAt).toBeGreaterThan(supervisorAt)
    expect(callbackAt).toBeGreaterThan(-1)
    expect(fastPathAt).toBeGreaterThan(callbackAt)
    expect(callback).toContain("mark.label === 'opencode-session-api-ready'")
    expect(callback).toContain("bootMark('opencode-session-api-ready')")
    expect(callback).not.toContain('opencode-listening')
  })
})
