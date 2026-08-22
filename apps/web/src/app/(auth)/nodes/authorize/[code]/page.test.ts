import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

test('compute-node authorization uses the SDK and remains independent from Agent Tunnel', () => {
  const source = readFileSync(join(import.meta.dir, 'page.tsx'), 'utf8')
  expect(source).toContain("from '@kortix/sdk'")
  expect(source).toContain('getComputeNodeDeviceAuth')
  expect(source).toContain('approveComputeNodeDeviceAuth')
  expect(source).toContain('denyComputeNodeDeviceAuth')
  expect(source).not.toContain('/tunnel/')
  expect(source).not.toContain('fetch(')
})
