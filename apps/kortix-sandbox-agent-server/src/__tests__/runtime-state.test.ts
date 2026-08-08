import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  DEFAULT_KORTIX_RUNTIME_STATE_DIRECTORY,
  OPENCODE_SEED_BAKED_PIN_PATH,
  OPENCODE_SESSION_PIN_PATH,
  resolveKortixRuntimeStateDirectory,
  resolveOpenCodeAuditSpoolPath,
  writePrivateRuntimeStateFile,
} from '../runtime-state'

describe('sandbox runtime state paths', () => {
  test('keeps every default under the kortix-owned home directory', () => {
    expect(DEFAULT_KORTIX_RUNTIME_STATE_DIRECTORY).toBe('/home/kortix/.local/state/kortix')
    expect(OPENCODE_SESSION_PIN_PATH).toBe(
      '/home/kortix/.local/state/kortix/opencode-session-id',
    )
    expect(OPENCODE_SEED_BAKED_PIN_PATH).toBe(
      '/home/kortix/.local/state/kortix/opencode-seed-baked-id',
    )
    expect(resolveOpenCodeAuditSpoolPath({})).toBe(
      '/home/kortix/.local/state/kortix/opencode-audit-spool.json',
    )
  })

  test('supports one shared state-directory override', () => {
    const env = { KORTIX_RUNTIME_STATE_DIR: '/tmp/kortix-runtime-test' }
    expect(resolveKortixRuntimeStateDirectory(env)).toBe('/tmp/kortix-runtime-test')
    expect(resolveOpenCodeAuditSpoolPath(env)).toBe(
      '/tmp/kortix-runtime-test/opencode-audit-spool.json',
    )
  })

  test('keeps the legacy spool-specific override authoritative', () => {
    expect(
      resolveOpenCodeAuditSpoolPath({
        KORTIX_RUNTIME_STATE_DIR: '/tmp/ignored',
        KORTIX_AUDIT_SPOOL_PATH: '/tmp/explicit-spool.json',
      }),
    ).toBe('/tmp/explicit-spool.json')
  })

  test('writes state with a private directory and private file mode', () => {
    const root = mkdtempSync(join(tmpdir(), 'kortix-runtime-state-'))
    const path = join(root, 'nested', 'pin')
    try {
      writePrivateRuntimeStateFile(path, 'ses_private')
      expect(readFileSync(path, 'utf8')).toBe('ses_private')
      expect(statSync(join(root, 'nested')).mode & 0o777).toBe(0o700)
      expect(statSync(path).mode & 0o777).toBe(0o600)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
