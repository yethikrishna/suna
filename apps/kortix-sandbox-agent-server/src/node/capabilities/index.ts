import { spawn } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { mkdir, open, readdir, stat, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, normalize, relative, resolve } from 'node:path'
import type { NodeCapabilityHandler, NodeCapabilityName, NodeCapabilityRegistry } from './types'
import { sandboxNodePolicy, type NodeLocalPolicy } from '../policy-store'
import { findCuaDriverBinary, NativeCuaDriver } from './cua-driver'
import type { NodeAssignmentCapabilityPolicy } from '@kortix/api-contract/node-channel'

const SANDBOX_ROOTS = ['/workspace', '/tmp', '/home', '/opt']
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
const CUA_FEATURES: Readonly<Record<string, string>> = {
  bring_to_front: 'windows', check_permissions: 'computer_use', click: 'mouse', double_click: 'mouse', drag: 'mouse',
  end_session: 'computer_use', get_accessibility_tree: 'accessibility', get_agent_cursor_state: 'mouse', get_config: 'computer_use',
  get_cursor_position: 'mouse', get_recording_state: 'computer_use', get_screen_size: 'screenshot', get_window_state: 'accessibility',
  hotkey: 'keyboard', kill_app: 'apps', launch_app: 'apps', list_apps: 'apps', list_windows: 'windows', move_cursor: 'mouse',
  page: 'accessibility', press_key: 'keyboard', replay_trajectory: 'computer_use', right_click: 'mouse', scroll: 'keyboard',
  set_agent_cursor_enabled: 'mouse', set_agent_cursor_motion: 'mouse', set_agent_cursor_style: 'mouse', set_config: 'computer_use',
  set_value: 'accessibility', start_recording: 'screenshot', start_session: 'computer_use', stop_recording: 'screenshot',
  type_text: 'keyboard', zoom: 'screenshot',
}

function existingRoot(path: string): string {
  try { return realpathSync(path) } catch { return normalize(resolve(path)) }
}

function inside(path: string, root: string): boolean {
  const child = relative(root, path)
  return child === '' || (!child.startsWith('..') && !isAbsolute(child))
}

function resolveSafe(path: unknown, write: boolean, policy: NodeLocalPolicy, assignmentRoots: readonly string[]): string {
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
  if (policy.blockedPaths.some((root) => inside(resolved, existingRoot(root)))) throw new Error(`Access denied: blocked path "${path}"`)
  if (!policy.allowedPaths.some((root) => inside(resolved, existingRoot(root)))) throw new Error(`Access denied: path "${path}" is outside local allowed roots`)
  if (assignmentRoots.length > 0 && !assignmentRoots.some((root) => inside(resolved, existingRoot(root)))) throw new Error(`Access denied: path "${path}" is outside assignment roots`)
  return resolved
}

function encoding(value: unknown): 'utf8' | 'base64' {
  if (value === undefined || value === 'utf8' || value === 'utf-8') return 'utf8'
  if (value === 'base64') return 'base64'
  throw new Error('Encoding must be utf8 or base64')
}

function matchesPattern(path: string, pattern: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '{{ALL}}').replace(/\*/g, '[^/\\\\]*').replace(/\{\{ALL\}\}/g, '.*')
  return new RegExp(`^${escaped}$`).test(path)
}

function filesystemMethods(policy: () => NodeLocalPolicy, roots: () => readonly string[], assignmentPolicy: () => NodeAssignmentCapabilityPolicy | undefined): Map<string, NodeCapabilityHandler> {
  const authorize = (method: 'read' | 'write' | 'list' | 'stat' | 'delete', path: unknown, write: boolean) => {
    const current = policy()
    const scope = assignmentPolicy()?.filesystem
    if (scope && !scope.operations.includes(method)) throw new Error(`Filesystem operation "${method}" is outside the assignment policy`)
    const configuredRoots = scope ? (write ? scope.writable_roots : [...scope.readable_roots, ...scope.writable_roots]) : []
    const scopedRoots = configuredRoots.length > 0 ? configuredRoots : roots()
    const resolved = resolveSafe(path, write, current, scopedRoots)
    if (scope?.exclude_patterns.some((pattern) => matchesPattern(String(path), pattern) || matchesPattern(resolved, pattern))) throw new Error(`Access denied: path matches assignment exclude pattern`)
    return { current, resolved, maxFileSize: Math.min(current.maxFileSize, scope?.max_file_size ?? current.maxFileSize) }
  }
  return new Map<string, NodeCapabilityHandler>([
    ['fs.read', async (params) => {
      const { resolved: path, maxFileSize } = authorize('read', params.path, false)
      const format = encoding(params.encoding)
      const handle = await open(path, 'r')
      try {
        const info = await handle.stat()
        if (!info.isFile()) throw new Error('Path is not a regular file')
        if (info.size > maxFileSize) throw new Error(`File exceeds ${maxFileSize} bytes`)
        return { content: await handle.readFile({ encoding: format }), size: info.size, encoding: format }
      } finally { await handle.close() }
    }],
    ['fs.write', async (params) => {
      const { resolved: path, maxFileSize } = authorize('write', params.path, true)
      const content = params.content
      const format = encoding(params.encoding)
      if (typeof content !== 'string') throw new Error('Content must be a string')
      if (Buffer.byteLength(content, format) > maxFileSize) throw new Error(`Content exceeds ${maxFileSize} bytes`)
      await mkdir(dirname(path), { recursive: true })
      authorize('write', path, true)
      await writeFile(path, content, { encoding: format, mode: 0o600 })
      return { path, size: (await stat(path)).size }
    }],
    ['fs.list', async (params) => {
      const path = authorize('list', params.path, false).resolved
      const result: Array<{ name: string; path: string; isDirectory: boolean; isFile: boolean; isSymlink: boolean }> = []
      const pending = [path]
      while (pending.length) {
        const directory = pending.shift()!
        for (const entry of await readdir(directory, { withFileTypes: true })) {
          const entryPath = join(directory, entry.name)
          authorize('list', entryPath, false)
          result.push({ name: entry.name, path: entryPath, isDirectory: entry.isDirectory(), isFile: entry.isFile(), isSymlink: entry.isSymbolicLink() })
          if (params.recursive === true && entry.isDirectory() && !entry.isSymbolicLink()) pending.push(entryPath)
          if (result.length > 10_000) throw new Error('Filesystem listing exceeds 10000 entries')
        }
        if (params.recursive !== true) break
      }
      return { entries: result, count: result.length }
    }],
    ['fs.stat', async (params) => {
      const info = await stat(authorize('stat', params.path, false).resolved)
      return { size: info.size, isDirectory: info.isDirectory(), isFile: info.isFile(), isSymlink: info.isSymbolicLink(), mode: info.mode, mtime: info.mtime.toISOString(), ctime: info.ctime.toISOString(), atime: info.atime.toISOString() }
    }],
    ['fs.delete', async (params) => {
      const path = authorize('delete', params.path, true).resolved
      const info = await stat(path)
      if (!info.isFile()) throw new Error('Only regular files can be deleted')
      await unlink(path)
      return { deleted: true, path }
    }],
  ])
}

function shellMethods(policy: () => NodeLocalPolicy, roots: () => readonly string[], assignmentPolicy: () => NodeAssignmentCapabilityPolicy | undefined): Map<string, NodeCapabilityHandler> {
  return new Map([['shell.exec', async (params, signal) => {
    const current = policy()
    if (typeof params.command !== 'string' || !params.command.trim() || COMMAND_METACHARS.test(params.command)) throw new Error('Invalid command')
    const command = params.command.trim()
    if (current.blockedCommands.includes(command)) throw new Error(`Command "${command}" is blocked`)
    if (current.allowedCommands.length > 0 && !current.allowedCommands.includes(command)) throw new Error(`Command "${command}" is outside the local allowlist`)
    const assignment = assignmentPolicy()?.shell
    if (assignment && !assignment.commands.includes(command)) throw new Error(`Command "${command}" is outside the assignment allowlist`)
    const args = params.args ?? []
    if (!Array.isArray(args) || !args.every((arg) => typeof arg === 'string')) throw new Error('Command args must be strings')
    const assigned = roots()
    const scopedWorkingRoots = assignment?.working_roots.length ? assignment.working_roots : assigned
    const cwd = resolveSafe(params.cwd ?? assigned[0] ?? current.allowedPaths[0], false, current, scopedWorkingRoots)
    const requestedTimeout = params.timeout === undefined ? current.shellTimeout : Number(params.timeout)
    if (!Number.isSafeInteger(requestedTimeout) || requestedTimeout <= 0) throw new Error('Command timeout must be a positive integer')
    const timeout = Math.min(requestedTimeout, current.shellMaxTimeout, assignment?.max_timeout_ms ?? current.shellMaxTimeout)
    const env: Record<string, string> = { TERM: 'dumb' }
    for (const key of current.shellEnvPassthrough) if (process.env[key] !== undefined) env[key] = process.env[key]!
    return await new Promise((resolveResult, reject) => {
      const child = spawn(params.command as string, args as string[], { cwd, shell: false, env, stdio: ['ignore', 'pipe', 'pipe'] })
      let stdout: Buffer<ArrayBufferLike> = Buffer.alloc(0)
      let stderr: Buffer<ArrayBufferLike> = Buffer.alloc(0)
      let stdoutTruncated = false
      let stderrTruncated = false
      const append = (current: Buffer<ArrayBufferLike>, chunk: Buffer<ArrayBufferLike>, mark: () => void): Buffer<ArrayBufferLike> => {
        const remaining = policy().shellMaxOutputSize - current.byteLength
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
  return createNodeCapabilityRegistry({ assignmentRoots: () => SANDBOX_ROOTS, policy: sandboxNodePolicy })
}

/** Create host capabilities constrained to roots supplied by the active lease. */
export function createNodeCapabilityRegistry(options: { assignmentRoots: () => readonly string[]; assignmentPolicy?: () => NodeAssignmentCapabilityPolicy | undefined; policy: () => NodeLocalPolicy }): NodeCapabilityRegistry {
  const current = options.policy()
  const assignmentPolicy = options.assignmentPolicy ?? (() => undefined)
  const methods = new Map<string, NodeCapabilityHandler>()
  const names: NodeCapabilityName[] = []
  if (current.enabledCapabilities.includes('filesystem')) { for (const entry of filesystemMethods(options.policy, options.assignmentRoots, assignmentPolicy)) methods.set(...entry); names.push('filesystem') }
  if (current.enabledCapabilities.includes('shell')) { for (const entry of shellMethods(options.policy, options.assignmentRoots, assignmentPolicy)) methods.set(...entry); names.push('shell') }
  try {
    const driver = new NativeCuaDriver()
    if (current.enabledCapabilities.includes('desktop') && findCuaDriverBinary()) {
      const authorizeDesktop = (tool: string) => {
        const features = assignmentPolicy()?.desktop?.features
        const feature = CUA_FEATURES[tool] ?? 'computer_use'
        if (features && !features.some((allowed) => allowed === feature)) throw new Error(`Desktop feature "${feature}" is outside the assignment policy`)
      }
      methods.set('desktop.cua.ensure', async (_params, signal) => { authorizeDesktop('ensure'); return { ok: true, binary: await driver.ensureInstalled(), version: await driver.version(signal) } })
      methods.set('desktop.cua.start_daemon', async () => { authorizeDesktop('start_daemon'); return driver.startDaemon() })
      methods.set('desktop.cua.status', async (_params, signal) => { authorizeDesktop('status'); return { status: await driver.status(signal) } })
      methods.set('desktop.cua.version', async (_params, signal) => { authorizeDesktop('version'); return { version: await driver.version(signal) } })
      methods.set('desktop.cua.list_tools', async (_params, signal) => { authorizeDesktop('list_tools'); return { tools: await driver.listTools(signal) } })
      methods.set('desktop.cua.describe', async (params, signal) => {
        if (typeof params.tool !== 'string' || !params.tool) throw new Error('CUA tool is required')
        authorizeDesktop('describe')
        return { description: await driver.describe(params.tool, signal) }
      })
      methods.set('desktop.cua.call', async (params, signal) => {
        if (typeof params.tool !== 'string' || !params.tool) throw new Error('CUA tool is required')
        if (params.tool === 'check_for_update' || params.tool === 'install_ffmpeg') throw new Error(`CUA tool "${params.tool}" is local-only`)
        authorizeDesktop(params.tool)
        return driver.call(params.tool, params.args as Record<string, unknown> ?? {}, signal)
      })
      for (const tool of CUA_TOOLS) {
        methods.set(`desktop.cua.${tool}`, async (params, signal) => { authorizeDesktop(tool); return driver.call(tool, params, signal) })
      }
      names.push('desktop')
    }
  } catch {
    // Desktop remains unregistered when no trusted local driver exists.
  }
  return { methods, names }
}

export type { NodeCapabilityRegistry } from './types'
