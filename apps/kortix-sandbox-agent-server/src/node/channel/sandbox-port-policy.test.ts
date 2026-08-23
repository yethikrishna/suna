import { describe, expect, test } from 'bun:test'
import { sandboxRelayPortPolicy } from '../../main'

describe('sandbox compute-node relay port policy', () => {
  const policy = sandboxRelayPortPolicy(
    { servicePort: 8000, opencodeStandbyPort: 4097 },
    {
      KORTIX_EGRESS_SHIM_PORT: '14318',
      KORTIX_LLM_PROXY_PORT: '14319',
      KORTIX_CONNECTORS_PROXY_PORT: '14320',
    },
  )

  test('allows the daemon and arbitrary user-started preview ports', () => {
    expect(policy.has(8000)).toBe(true)
    expect(policy.has(3000)).toBe(true)
    expect(policy.has(5173)).toBe(true)
  })

  test('blocks credential-bearing helpers and the inactive OpenCode port', () => {
    expect(policy.has(14318)).toBe(false)
    expect(policy.has(14319)).toBe(false)
    expect(policy.has(14320)).toBe(false)
    expect(policy.has(4097)).toBe(false)
  })

  test('rejects invalid TCP ports', () => {
    expect(policy.has(0)).toBe(false)
    expect(policy.has(65_536)).toBe(false)
    expect(policy.has(3000.5)).toBe(false)
  })
})
