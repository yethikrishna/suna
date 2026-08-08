import { chmodSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * Durable daemon state must live under the runtime user's home directory.
 * Platinum replaces /run after image creation and starts the entrypoint as
 * `kortix`, so image-time ownership and root-only entrypoint repairs cannot
 * make /var/run/kortix reliable.
 */
export const DEFAULT_KORTIX_RUNTIME_STATE_DIRECTORY = '/home/kortix/.local/state/kortix'

export function resolveKortixRuntimeStateDirectory(
  env: Record<string, string | undefined> = process.env,
): string {
  return env.KORTIX_RUNTIME_STATE_DIR?.trim() || DEFAULT_KORTIX_RUNTIME_STATE_DIRECTORY
}

export function resolveOpenCodeAuditSpoolPath(
  env: Record<string, string | undefined> = process.env,
): string {
  return (
    env.KORTIX_AUDIT_SPOOL_PATH?.trim() ||
    join(resolveKortixRuntimeStateDirectory(env), 'opencode-audit-spool.json')
  )
}

export const OPENCODE_SESSION_PIN_PATH = join(
  resolveKortixRuntimeStateDirectory(),
  'opencode-session-id',
)

export const OPENCODE_SEED_BAKED_PIN_PATH = join(
  resolveKortixRuntimeStateDirectory(),
  'opencode-seed-baked-id',
)

export function writePrivateRuntimeStateFile(path: string, value: string): void {
  const directory = dirname(path)
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  chmodSync(directory, 0o700)
  writeFileSync(path, value, { encoding: 'utf8', mode: 0o600 })
  chmodSync(path, 0o600)
}
