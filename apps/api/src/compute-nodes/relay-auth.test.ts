import { describe, expect, test } from 'bun:test'
import { createRelayAuthorization, RelayReplayGuard, verifyRelayAuthorization } from './relay-auth'

describe('compute-node internal relay authorization', () => {
  test('authenticates one exact method and target without signing the streaming body', () => {
    const input = { key: 'shared-relay-key', method: 'POST', target: '/v1/internal/node-relay/node-1/8000/events?x=1', now: 1_700_000_000_000, nonce: 'n-1' }
    const headers = createRelayAuthorization(input)
    const guard = new RelayReplayGuard()
    expect(verifyRelayAuthorization({ ...input, headers, guard })).toEqual({ ok: true })
    expect(verifyRelayAuthorization({ ...input, target: '/v1/internal/node-relay/node-2/8000/events?x=1', headers, guard: new RelayReplayGuard() })).toMatchObject({ ok: false, reason: 'signature' })
  })

  test('rejects replay, expiry, missing headers, and a different key', () => {
    const input = { key: 'shared-relay-key', method: 'GET', target: '/v1/internal/node-relay/node-1/8000/', now: 1_700_000_000_000, nonce: 'n-2' }
    const headers = createRelayAuthorization(input)
    const guard = new RelayReplayGuard()
    expect(verifyRelayAuthorization({ ...input, headers, guard })).toEqual({ ok: true })
    expect(verifyRelayAuthorization({ ...input, headers, guard })).toMatchObject({ ok: false, reason: 'replay' })
    expect(verifyRelayAuthorization({ ...input, now: input.now + 61_000, headers, guard: new RelayReplayGuard() })).toMatchObject({ ok: false, reason: 'expired' })
    expect(verifyRelayAuthorization({ ...input, headers: new Headers(), guard: new RelayReplayGuard() })).toMatchObject({ ok: false, reason: 'missing' })
    expect(verifyRelayAuthorization({ ...input, key: 'another-key', headers, guard: new RelayReplayGuard() })).toMatchObject({ ok: false, reason: 'signature' })
  })
})
