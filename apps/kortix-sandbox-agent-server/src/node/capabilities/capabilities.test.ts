import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createNodeCapabilityRegistry, createSandboxCapabilityRegistry } from '.'

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
    await expect(read({ path: '/etc/passwd' }, new AbortController().signal)).rejects.toThrow('outside allowed roots')
    await expect(read({ path: join(link, 'passwd') }, new AbortController().signal)).rejects.toThrow('outside allowed roots')
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
    const read = createNodeCapabilityRegistry(() => allowed).methods.get('fs.read')!
    await writeFile(join(first, 'a'), 'first')
    await writeFile(join(second, 'b'), 'second')
    expect(await read({ path: join(first, 'a') }, new AbortController().signal)).toMatchObject({ content: 'first' })
    allowed = [second]
    await expect(read({ path: join(first, 'a') }, new AbortController().signal)).rejects.toThrow('outside allowed roots')
    expect(await read({ path: join(second, 'b') }, new AbortController().signal)).toMatchObject({ content: 'second' })
  })
})
