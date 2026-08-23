import { afterEach, describe, expect, test } from 'bun:test'
import { chmod, mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createNodeCapabilityRegistry, createSandboxCapabilityRegistry } from '.'
import { sandboxNodePolicy } from '../policy-store'
import { findCuaDriverBinary, NativeCuaDriver } from './cua-driver'

const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true }))) })

async function root() {
  const path = await mkdtemp('/tmp/kortixd-cap-')
  roots.push(path)
  return path
}

describe('kortixd native capabilities', () => {
  test('performs filesystem CRUD inside an allowed root', async () => {
    const dir = await root()
    const file = join(dir, 'nested', 'a.txt')
    const methods = createSandboxCapabilityRegistry().methods
    await methods.get('fs.write')!({ path: file, content: 'hello' }, new AbortController().signal)
    expect(await methods.get('fs.read')!({ path: file }, new AbortController().signal)).toMatchObject({ content: 'hello', size: 5 })
    expect(await methods.get('fs.list')!({ path: join(dir, 'nested') }, new AbortController().signal)).toMatchObject({ count: 1 })
    expect(await methods.get('fs.stat')!({ path: file }, new AbortController().signal)).toMatchObject({ isFile: true, size: 5 })
    expect(await methods.get('fs.delete')!({ path: file }, new AbortController().signal)).toMatchObject({ deleted: true })
  })

  test('rejects blocked paths, traversal, and symlink escapes', async () => {
    const dir = await root()
    const link = join(dir, 'escape')
    await symlink('/etc', link)
    const read = createSandboxCapabilityRegistry().methods.get('fs.read')!
    await expect(read({ path: '/etc/passwd' }, new AbortController().signal)).rejects.toThrow('blocked path')
    await expect(read({ path: join(link, 'passwd') }, new AbortController().signal)).rejects.toThrow('blocked path')
    await expect(read({ path: 'relative' }, new AbortController().signal)).rejects.toThrow('absolute')
  })

  test('executes commands without a shell and enforces timeout and output ceilings', async () => {
    const dir = await root()
    await writeFile(join(dir, 'input'), 'x')
    const shell = createSandboxCapabilityRegistry().methods.get('shell.exec')!
    expect(await shell({ command: 'printf', args: ['hello'], cwd: dir }, new AbortController().signal)).toMatchObject({ exitCode: 0, stdout: 'hello' })
    await expect(shell({ command: 'sh;id', cwd: dir }, new AbortController().signal)).rejects.toThrow('Invalid command')
    const timed = await shell({ command: 'sleep', args: ['1'], cwd: dir, timeout: 5 }, new AbortController().signal) as { signal: string }
    expect(timed.signal).toBe('SIGKILL')
  })

  test('changes workstation access when the active assignment roots change', async () => {
    const first = await root()
    const second = await root()
    let allowed = [first]
    const policy = sandboxNodePolicy()
    policy.allowedPaths = [first, second]
    const read = createNodeCapabilityRegistry({ assignmentRoots: () => allowed, policy: () => policy }).methods.get('fs.read')!
    await writeFile(join(first, 'a'), 'first')
    await writeFile(join(second, 'b'), 'second')
    expect(await read({ path: join(first, 'a') }, new AbortController().signal)).toMatchObject({ content: 'first' })
    allowed = [second]
    await expect(read({ path: join(first, 'a') }, new AbortController().signal)).rejects.toThrow('outside assignment roots')
    expect(await read({ path: join(second, 'b') }, new AbortController().signal)).toMatchObject({ content: 'second' })
  })

  test('applies assignment capability restrictions below the local policy ceiling', async () => {
    const dir = await root()
    const writable = join(dir, 'write')
    const readable = join(dir, 'read')
    await mkdir(writable, { recursive: true })
    await mkdir(readable, { recursive: true })
    await writeFile(join(readable, 'visible.txt'), 'visible')
    await writeFile(join(readable, 'hidden.secret'), 'x')
    const policy = sandboxNodePolicy()
    policy.allowedPaths = [dir]
    const registry = createNodeCapabilityRegistry({
      assignmentRoots: () => [dir],
      assignmentPolicy: () => ({
        filesystem: {
          operations: ['read', 'list'],
          readable_roots: [readable],
          writable_roots: [writable],
          exclude_patterns: ['**/*.secret'],
          max_file_size: 4,
        },
        shell: { commands: ['printf'], working_roots: [writable], max_timeout_ms: 100 },
        desktop: { features: ['mouse'] },
      }),
      policy: () => policy,
    })
    const signal = new AbortController().signal
    await expect(registry.methods.get('fs.list')!({ path: readable }, signal)).rejects.toThrow('exclude pattern')
    await expect(registry.methods.get('fs.read')!({ path: join(readable, 'visible.txt') }, signal)).rejects.toThrow('4 bytes')
    await expect(registry.methods.get('fs.read')!({ path: join(readable, 'hidden.secret') }, signal)).rejects.toThrow('exclude pattern')
    await expect(registry.methods.get('fs.write')!({ path: join(writable, 'new.txt'), content: 'x' }, signal)).rejects.toThrow('operation')
    await expect(registry.methods.get('shell.exec')!({ command: 'uname', cwd: writable }, signal)).rejects.toThrow('assignment allowlist')
    await expect(registry.methods.get('shell.exec')!({ command: 'printf', args: ['ok'], cwd: readable }, signal)).rejects.toThrow('assignment roots')
  })

  test('lists nested filesystem entries when recursive is true', async () => {
    const dir = await root()
    await mkdir(join(dir, 'a', 'b'), { recursive: true })
    await writeFile(join(dir, 'a', 'b', 'nested.txt'), 'x')
    const list = createSandboxCapabilityRegistry().methods.get('fs.list')!
    const shallow = await list({ path: dir }, new AbortController().signal) as { entries: Array<{ path: string }> }
    expect(shallow.entries.some((entry) => entry.path.endsWith('nested.txt'))).toBe(false)
    const recursive = await list({ path: dir, recursive: true }, new AbortController().signal) as { entries: Array<{ path: string }> }
    expect(recursive.entries.some((entry) => entry.path.endsWith('nested.txt'))).toBe(true)
  })

  test('discovers a trusted CUA driver and removes relay metadata from tool arguments', async () => {
    const dir = await root()
    const binary = join(dir, 'cua-driver')
    await writeFile(binary, `#!/usr/bin/env bun
const [command, tool, payload] = process.argv.slice(2)
if (command === '--version') console.log('cua-driver 1.2.3')
else if (command === 'status') console.log('running')
else if (command === 'list-tools') console.log('click\\ntype_text')
else if (command === 'describe') console.log('description:' + tool)
else if (command === 'call') console.log(JSON.stringify({ tool, args: JSON.parse(payload || '{}') }))
else process.exit(2)
`)
    await chmod(binary, 0o700)
    expect(findCuaDriverBinary({ ...process.env, CUA_DRIVER_BIN: binary })).toBe(await realpath(binary))
    const driver = new NativeCuaDriver({ ...process.env, CUA_DRIVER_BIN: binary })
    expect(await driver.version()).toBe('cua-driver 1.2.3')
    expect(await driver.call('click', { x: 10, _sig: 'private', node_id: 'private' })).toEqual({ tool: 'click', args: { x: 10 } })
  })

  test('rejects a CUA driver writable by another local user', async () => {
    if (process.platform === 'win32') return
    const dir = await root()
    const binary = join(dir, 'cua-driver')
    await writeFile(binary, '#!/bin/sh\nexit 0\n')
    await chmod(binary, 0o722)
    expect(() => findCuaDriverBinary({ ...process.env, CUA_DRIVER_BIN: binary })).toThrow('must not be writable')
  })
})
