import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

export const RELAY_TIMESTAMP_HEADER = 'x-kortix-relay-timestamp'
export const RELAY_NONCE_HEADER = 'x-kortix-relay-nonce'
export const RELAY_SIGNATURE_HEADER = 'x-kortix-relay-signature'
const MAX_CLOCK_SKEW_MS = 60_000

function canonical(method: string, target: string, timestamp: string, nonce: string): string {
  return `${method.toUpperCase()}\n${target}\n${timestamp}\n${nonce}`
}

function signature(key: string, method: string, target: string, timestamp: string, nonce: string): string {
  return createHmac('sha256', key).update(canonical(method, target, timestamp, nonce)).digest('hex')
}

export function createRelayAuthorization(input: { key: string; method: string; target: string; now?: number; nonce?: string }): Headers {
  const timestamp = String(input.now ?? Date.now())
  const nonce = input.nonce ?? randomUUID()
  return new Headers({
    [RELAY_TIMESTAMP_HEADER]: timestamp,
    [RELAY_NONCE_HEADER]: nonce,
    [RELAY_SIGNATURE_HEADER]: signature(input.key, input.method, input.target, timestamp, nonce),
  })
}

export class RelayReplayGuard {
  private readonly seen = new Map<string, number>()

  accept(nonce: string, now: number): boolean {
    for (const [value, expires] of this.seen) if (expires < now) this.seen.delete(value)
    if (this.seen.has(nonce)) return false
    this.seen.set(nonce, now + MAX_CLOCK_SKEW_MS)
    return true
  }
}

export function verifyRelayAuthorization(input: { key: string; method: string; target: string; headers: Headers; guard: RelayReplayGuard; now?: number }): { ok: true } | { ok: false; reason: 'missing' | 'expired' | 'signature' | 'replay' } {
  const timestamp = input.headers.get(RELAY_TIMESTAMP_HEADER)
  const nonce = input.headers.get(RELAY_NONCE_HEADER)
  const supplied = input.headers.get(RELAY_SIGNATURE_HEADER)
  if (!timestamp || !nonce || !supplied) return { ok: false, reason: 'missing' }
  const parsed = Number(timestamp)
  const now = input.now ?? Date.now()
  if (!Number.isSafeInteger(parsed) || Math.abs(now - parsed) > MAX_CLOCK_SKEW_MS) return { ok: false, reason: 'expired' }
  const expected = Buffer.from(signature(input.key, input.method, input.target, timestamp, nonce), 'hex')
  const actual = Buffer.from(supplied, 'hex')
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return { ok: false, reason: 'signature' }
  if (!input.guard.accept(nonce, now)) return { ok: false, reason: 'replay' }
  return { ok: true }
}
