import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

import { loadConfig } from '../config'
import { isShallowRepo, scheduleHistoryBackfill } from '../git'
import { buildOpencodeConfigContent, hasKortixLlmGateway } from '../opencode'

const BASE_ENV = { KORTIX_WORKSPACE: '/workspace', KORTIX_REPO_URL: 'https://example.test/r.git' }

function git(cwd: string, ...args: string[]): string {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (res.status !== 0) throw new Error(`git ${args.join(' ')}: ${res.stderr}`)
  return res.stdout
}

async function makeOriginRepo(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'kortix-origin-'))
  git(dir, 'init', '--initial-branch=main', '--quiet')
  git(dir, 'config', 'user.email', 't@example.test')
  git(dir, 'config', 'user.name', 'Test')
  for (let i = 0; i < 3; i++) {
    await writeFile(join(dir, `f${i}.txt`), `v${i}`)
    git(dir, 'add', '-A')
    git(dir, 'commit', '-m', `c${i}`, '--quiet')
  }
  return dir
}

const tempDirs: string[] = []
afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((d) => rm(d, { recursive: true, force: true })))
})

describe('clone depth configuration', () => {
  test('defaults to a shallow depth-1 clone', () => {
    expect(loadConfig(BASE_ENV as NodeJS.ProcessEnv).cloneDepth).toBe(1)
  })

  test('no partial-clone filter is applied by default', () => {
    expect(loadConfig(BASE_ENV as NodeJS.ProcessEnv).cloneFilter).toBe('')
  })

  test('depth 0 opts back into a full-history clone', () => {
    expect(loadConfig({ ...BASE_ENV, KORTIX_CLONE_DEPTH: '0' } as NodeJS.ProcessEnv).cloneDepth).toBe(0)
  })

  test('an explicit depth is honoured', () => {
    expect(loadConfig({ ...BASE_ENV, KORTIX_CLONE_DEPTH: '25' } as NodeJS.ProcessEnv).cloneDepth).toBe(25)
  })

  test('a negative depth is rejected rather than silently passed to git', () => {
    expect(() => loadConfig({ ...BASE_ENV, KORTIX_CLONE_DEPTH: '-1' } as NodeJS.ProcessEnv)).toThrow()
  })
})

describe('isShallowRepo', () => {
  test('reports true for a depth-limited clone and false once unshallowed', async () => {
    const origin = await makeOriginRepo()
    const clone = await mkdtemp(join(tmpdir(), 'kortix-clone-'))
    tempDirs.push(origin, clone)
    const target = join(clone, 'repo')

    git(clone, 'clone', '--depth', '1', '--branch', 'main', `file://${origin}`, target)
    expect(await isShallowRepo(target)).toBe(true)

    git(target, 'fetch', '--unshallow', 'origin')
    expect(await isShallowRepo(target)).toBe(false)
  })

  test('reports false for a full clone', async () => {
    const origin = await makeOriginRepo()
    const clone = await mkdtemp(join(tmpdir(), 'kortix-full-'))
    tempDirs.push(origin, clone)
    const target = join(clone, 'repo')

    git(clone, 'clone', '--branch', 'main', `file://${origin}`, target)
    expect(await isShallowRepo(target)).toBe(false)
  })

  test('a depth-1 clone carries exactly one commit while a full clone carries every commit', async () => {
    const origin = await makeOriginRepo()
    const clone = await mkdtemp(join(tmpdir(), 'kortix-depths-'))
    tempDirs.push(origin, clone)
    const shallow = join(clone, 'shallow')
    const full = join(clone, 'full')

    git(clone, 'clone', '--depth', '1', '--branch', 'main', `file://${origin}`, shallow)
    git(clone, 'clone', '--branch', 'main', `file://${origin}`, full)

    expect(git(shallow, 'rev-list', '--count', 'HEAD').trim()).toBe('1')
    expect(git(full, 'rev-list', '--count', 'HEAD').trim()).toBe('3')
    expect(git(shallow, 'rev-parse', 'HEAD')).toBe(git(full, 'rev-parse', 'HEAD'))
  })
})

describe('scheduleHistoryBackfill', () => {
  test('restores full history for a shallow clone without blocking the caller', async () => {
    const origin = await makeOriginRepo()
    const clone = await mkdtemp(join(tmpdir(), 'kortix-backfill-'))
    tempDirs.push(origin, clone)
    const target = join(clone, 'repo')
    git(clone, 'clone', '--depth', '1', '--branch', 'main', `file://${origin}`, target)

    const cfg = loadConfig({ ...BASE_ENV, KORTIX_REPO_URL: `file://${origin}` } as NodeJS.ProcessEnv)
    scheduleHistoryBackfill(cfg, target)

    const deadline = Date.now() + 20_000
    while (Date.now() < deadline && (await isShallowRepo(target))) {
      await new Promise((r) => setTimeout(r, 50))
    }
    expect(await isShallowRepo(target)).toBe(false)
    expect(git(target, 'rev-list', '--count', 'HEAD').trim()).toBe('3')
  })

  test('is a no-op on an already-complete repo', async () => {
    const origin = await makeOriginRepo()
    const clone = await mkdtemp(join(tmpdir(), 'kortix-noop-'))
    tempDirs.push(origin, clone)
    const target = join(clone, 'repo')
    git(clone, 'clone', '--branch', 'main', `file://${origin}`, target)

    const cfg = loadConfig({ ...BASE_ENV, KORTIX_REPO_URL: `file://${origin}` } as NodeJS.ProcessEnv)
    scheduleHistoryBackfill(cfg, target)
    await new Promise((r) => setTimeout(r, 300))

    expect(await isShallowRepo(target)).toBe(false)
    expect(git(target, 'rev-list', '--count', 'HEAD').trim()).toBe('3')
  })
})

describe('gateway catalog fetch is bounded so it cannot gate opencode spawn', () => {
  const realFetch = globalThis.fetch
  afterEach(() => {
    globalThis.fetch = realFetch
  })

  const GATEWAY_ENV = {
    KORTIX_LLM_BASE_URL: 'https://gateway.kortix.test/v1',
    KORTIX_LLM_API_KEY: 'k-test',
    KORTIX_API_URL: 'https://api.kortix.test/v1',
  }

  test('the env under test really does engage the gateway path', () => {
    expect(hasKortixLlmGateway(GATEWAY_ENV as NodeJS.ProcessEnv)).toBe(true)
  })

  test('a gateway that is slow but never errors cannot burn more than the total budget', async () => {
    let calls = 0
    globalThis.fetch = (async (input: string) => {
      if (String(input).endsWith('/models')) {
        calls++
        await new Promise((r) => setTimeout(r, 2_000))
        return new Response(JSON.stringify({ models: {} }), { status: 200 })
      }
      return new Response('not found', { status: 404 })
    }) as typeof fetch

    const started = Date.now()
    const raw = await buildOpencodeConfigContent(GATEWAY_ENV as NodeJS.ProcessEnv)
    const elapsed = Date.now() - started

    expect(elapsed).toBeLessThan(8_000)
    expect(calls).toBeGreaterThan(0)
    expect(raw).toBeDefined()
  }, 20_000)

  test('a hard-failing gateway falls back without exhausting the budget', async () => {
    globalThis.fetch = (async (input: string) => {
      if (String(input).endsWith('/models')) return new Response('boom', { status: 503 })
      return new Response('not found', { status: 404 })
    }) as typeof fetch

    const started = Date.now()
    const raw = await buildOpencodeConfigContent(GATEWAY_ENV as NodeJS.ProcessEnv)

    expect(Date.now() - started).toBeLessThan(6_000)
    expect(raw).toBeDefined()
  }, 20_000)
})
