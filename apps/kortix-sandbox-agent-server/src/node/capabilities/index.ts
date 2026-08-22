import { spawn } from 'node:child_process'
import { constants, realpathSync, statSync } from 'node:fs'
import { mkdir, open, readdir, stat, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, normalize, relative, resolve } from 'node:path'
import type { NodeCapabilityHandler, NodeCapabilityName, NodeCapabilityRegistry } from './types'

const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_SHELL_OUTPUT_BYTES = 1024 * 1024
const MAX_SHELL_TIMEOUT_MS = 120_000
const DEFAULT_SHELL_TIMEOUT_MS = 30_000
const SANDBOX_ROOTS = ['/workspace', '/tmp', '/home', '/opt']
const BLOCKED_ROOTS = ['/etc/shadow', '/etc/sudoers', '/etc/ssh', '/root/.ssh', '/proc', '/sys', '/dev']
const ENV_ALLOWLIST = ['PATH', 'HOME', 'USER', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TMPDIR', 'NODE_ENV', 'HOSTNAME']
const COMMAND_METACHARS = /[;&|`$(){}[\]<>!#~]/
const CUA_TOOLS = [
  'bring_to_front', 'check_permissions', 'click', 'double_click', 'drag', 'end_session',
  'get_accessibility_tree', 'get_agent_cursor_state', 'get_config', 'get_cursor_position',
  'get_recording_state', 'get_screen_size', 'get_window_state', 'hotkey', 'kill_app',
  'launch_app', 'list_apps', 'list_windows', 'move_cursor', 'page', 'press_key',
  'replay_trajectory', 'right_click', 'scroll', 'set_agent_cursor_enabled',
  'set_agent_cursor_motion', 'set_agent_cursor_style', 'set_config', 'set_value',
  'start_recording', 'start_session', 'stop_recording', 'type_text', 'zoom',
] as const

function existingRoot(path: string): string {
  try { return realpathSync(path) } catch { return normalize(resolve(path)) }
}

function inside(path: string, root: string): boolean {
  const child = relative(root, path)
  return child === '' || (!child.startsWith('..') && !isAbsolute(child))
}

function resolveSafe(path: unknown, write = false, allowedRoots: readonly string[] = SANDBOX_ROOTS): string {
  if (typeof path !== 'string' || !isAbsolute(path)) throw new Error('Path must be absolute')
  const requested = normalize(resolve(path))
  let resolved: string
  try {
    resolved = realpathSync(requested)
  } catch (error) {
    if (!write || (error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error(`Cannot resolve path: ${path}`)
    let parent = dirname(requested)
    const missing: string[] = [basename(requested)]
    while (parent !== dirname(parent)) {
      try {
        resolved = join(realpathSync(parent), ...missing.reverse())
        break
      } catch (parentError) {
        if ((parentError as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error(`Cannot resolve path: ${path}`)
        missing.push(basename(parent))
        parent = dirname(parent)
      }
    }
    resolved ??= requested
  }
  if (BLOCKED_ROOTS.some((root) => inside(resolved, existingRoot(root)))) throw new Error(`Access denied: blocked path "${path}"`)
  if (!allowedRoots.some((root) => inside(resolved, existingRoot(root)))) throw new Error(`Access denied: path "${path}" is outside allowed roots`)
  return resolved
}

function encoding(value: unknown): 'utf8' | 'base64' {
  if (value === undefined || value === 'utf8' || value === 'utf-8') return 'utf8'
  if (value === 'base64') return 'base64'
  throw new Error('Encoding must be utf8 or base64')
}

function filesystemMethods(roots: () => readonly string[]): Map<string, NodeCapabilityHandler> {
  return new Map<string, NodeCapabilityHandler>([
    ['fs.read', async (params) => {
      const path = resolveSafe(params.path, false, roots())
      const format = encoding(params.encoding)
      const handle = await open(path, 'r')
      try {
        const info = await handle.stat()
        if (!info.isFile()) throw new Error('Path is not a regular file')
        if (info.size > MAX_FILE_BYTES) throw new Error(`File exceeds ${MAX_FILE_BYTES} bytes`)
        return { content: await handle.readFile({ encoding: format }), size: info.size, encoding: format }
      } finally { await handle.close() }
    }],
    ['fs.write', async (params) => {
      const path = resolveSafe(params.path, true, roots())
      const content = params.content
      const format = encoding(params.encoding)
      if (typeof content !== 'string') throw new Error('Content must be a string')
      if (Buffer.byteLength(content, format) > MAX_FILE_BYTES) throw new Error(`Content exceeds ${MAX_FILE_BYTES} bytes`)
      await mkdir(dirname(path), { recursive: true })
      resolveSafe(path, true, roots())
      await writeFile(path, content, { encoding: format, mode: 0o600 })
      return { path, size: (await stat(path)).size }
    }],
    ['fs.list', async (params) => {
      const path = resolveSafe(params.path, false, roots())
      const entries = await readdir(path, { withFileTypes: true })
      return { entries: entries.map((entry) => ({ name: entry.name, path: join(path, entry.name), isDirectory: entry.isDirectory(), isFile: entry.isFile(), isSymlink: entry.isSymbolicLink() })), count: entries.length }
    }],
    ['fs.stat', async (params) => {
      const info = await stat(resolveSafe(params.path, false, roots()))
      return { size: info.size, isDirectory: info.isDirectory(), isFile: info.isFile(), isSymlink: info.isSymbolicLink(), mode: info.mode, mtime: info.mtime.toISOString(), ctime: info.ctime.toISOString(), atime: info.atime.toISOString() }
    }],
    ['fs.delete', async (params) => {
      const path = resolveSafe(params.path, false, roots())
      const info = await stat(path)
      if (!info.isFile()) throw new Error('Only regular files can be deleted')
      await unlink(path)
      return { deleted: true, path }
    }],
  ])
}

function shellMethods(roots: () => readonly string[]): Map<string, NodeCapabilityHandler> {
  return new Map([['shell.exec', async (params, signal) => {
    if (typeof params.command !== 'string' || !params.command.trim() || COMMAND_METACHARS.test(params.command)) throw new Error('Invalid command')
    const args = params.args ?? []
    if (!Array.isArray(args) || !args.every((arg) => typeof arg === 'string')) throw new Error('Command args must be strings')
    const allowed = roots()
    const cwd = resolveSafe(params.cwd ?? allowed[0], false, allowed)
    const requestedTimeout = params.timeout === undefined ? DEFAULT_SHELL_TIMEOUT_MS : Number(params.timeout)
    if (!Number.isSafeInteger(requestedTimeout) || requestedTimeout <= 0) throw new Error('Command timeout must be a positive integer')
    const timeout = Math.min(requestedTimeout, MAX_SHELL_TIMEOUT_MS)
    const env: Record<string, string> = { TERM: 'dumb' }
    for (const key of ENV_ALLOWLIST) if (process.env[key] !== undefined) env[key] = process.env[key]!
    return await new Promise((resolveResult, reject) => {
      const child = spawn(params.command as string, args as string[], { cwd, shell: false, env, stdio: ['ignore', 'pipe', 'pipe'] })
      let stdout: Buffer<ArrayBufferLike> = Buffer.alloc(0)
      let stderr: Buffer<ArrayBufferLike> = Buffer.alloc(0)
      let stdoutTruncated = false
      let stderrTruncated = false
      const append = (current: Buffer<ArrayBufferLike>, chunk: Buffer<ArrayBufferLike>, mark: () => void): Buffer<ArrayBufferLike> => {
        const remaining = MAX_SHELL_OUTPUT_BYTES - current.byteLength
        if (remaining <= 0) { mark(); return current }
        if (chunk.byteLength > remaining) mark()
        return Buffer.concat([current, chunk.subarray(0, remaining)])
      }
      child.stdout.on('data', (chunk: Buffer) => { stdout = append(stdout, chunk, () => { stdoutTruncated = true }) })
      child.stderr.on('data', (chunk: Buffer) => { stderr = append(stderr, chunk, () => { stderrTruncated = true }) })
      const timer = setTimeout(() => child.kill('SIGKILL'), timeout)
      const abort = () => child.kill('SIGKILL')
      signal.addEventListener('abort', abort, { once: true })
      child.once('error', (error) => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(error) })
      child.once('close', (exitCode, exitSignal) => {
        clearTimeout(timer)
        signal.removeEventListener('abort', abort)
        resolveResult({ exitCode, signal: exitSignal, stdout: stdout.toString(), stderr: stderr.toString(), stdoutTruncated, stderrTruncated })
      })
    })
  }]])
}

export function createSandboxCapabilityRegistry(): NodeCapabilityRegistry {
  return createNodeCapabilityRegistry(() => SANDBOX_ROOTS)
}

/** Create host capabilities constrained to roots supplied by the active lease. */
export function createNodeCapabilityRegistry(allowedRoots: () => readonly string[]): NodeCapabilityRegistry {
  const methods = new Map<string, NodeCapabilityHandler>([...filesystemMethods(allowedRoots), ...shellMethods(allowedRoots)])
  const names: NodeCapabilityName[] = ['filesystem', 'shell']
  try {
    const driver = process.env.CUA_DRIVER_BIN
    if (driver) {
      const resolved = realpathSync(driver)
      const info = statSync(resolved)
      if (!info.isFile() || (info.mode & constants.X_OK) === 0 || (info.mode & 0o022) !== 0) throw new Error('CUA driver is not a trusted executable')
      methods.set('desktop.cua.ensure', async (_params, signal) => ({ ok: true, binary: resolved, version: await shellText(resolved, ['--version'], signal) }))
      methods.set('desktop.cua.start_daemon', async () => {
        const child = spawn(resolved, ['serve'], { detached: true, stdio: 'ignore' })
        child.unref()
        return { ok: true }
      })
      methods.set('desktop.cua.status', async (_params, signal) => ({ status: await shellText(resolved, ['status'], signal) }))
      methods.set('desktop.cua.version', async (_params, signal) => ({ version: await shellText(resolved, ['--version'], signal) }))
      methods.set('desktop.cua.list_tools', async (_params, signal) => ({ tools: await shellText(resolved, ['list-tools'], signal) }))
      methods.set('desktop.cua.describe', async (params, signal) => {
        if (typeof params.tool !== 'string' || !params.tool) throw new Error('CUA tool is required')
        return { description: await shellText(resolved, ['describe', params.tool], signal) }
      })
      methods.set('desktop.cua.call', async (params, signal) => {
        if (typeof params.tool !== 'string' || !params.tool) throw new Error('CUA tool is required')
        if (params.tool === 'check_for_update' || params.tool === 'install_ffmpeg') throw new Error(`CUA tool "${params.tool}" is local-only`)
        return shellJson(resolved, ['call', params.tool, JSON.stringify(params.args ?? {})], signal)
      })
      for (const tool of CUA_TOOLS) {
        methods.set(`desktop.cua.${tool}`, async (params, signal) => shellJson(resolved, ['call', tool, JSON.stringify(params)], signal))
      }
      names.push('desktop')
    }
  } catch {
    // Desktop remains unregistered when no trusted local driver exists.
  }
  return { methods, names }
}

async function shellJson(command: string, args: string[], signal: AbortSignal): Promise<unknown> {
  return await new Promise((resolveResult, reject) => {
    const child = spawn(command, args, { shell: false, stdio: ['ignore', 'pipe', 'pipe'] })
    const chunks: Buffer[] = []
    let bytes = 0
    const abort = () => child.kill('SIGKILL')
    signal.addEventListener('abort', abort, { once: true })
    child.stdout.on('data', (chunk: Buffer) => { bytes += chunk.byteLength; if (bytes > 5 * 1024 * 1024) child.kill('SIGKILL'); else chunks.push(chunk) })
    child.once('error', reject)
    child.once('close', (code) => {
      signal.removeEventListener('abort', abort)
      if (code !== 0) return reject(new Error(`CUA driver failed with exit code ${code}`))
      const output = Buffer.concat(chunks).toString().trim()
      try { resolveResult(output ? JSON.parse(output) : {}) } catch { resolveResult(output) }
    })
  })
}

async function shellText(command: string, args: string[], signal: AbortSignal): Promise<string> {
  const result = await shellJson(command, args, signal)
  return typeof result === 'string' ? result : JSON.stringify(result)
}

export type { NodeCapabilityRegistry } from './types'
