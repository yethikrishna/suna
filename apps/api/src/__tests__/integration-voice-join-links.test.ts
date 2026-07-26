/**
 * Integration test (real local DB) for join-links.ts — the short, ungessable
 * `voice_spawn` join link that replaced embedding a ~300-char LiveKit JWT
 * directly in a URL. `voice_join_links` has no FK to projects/sessions (see
 * the migration's expand/contract checklist), so this needs no seeded
 * project row — synthetic ids are enough.
 */
import { describe, expect, test, afterAll } from 'bun:test';
import { eq } from 'drizzle-orm';
import { voiceJoinLinks } from '@kortix/db';
import { db } from '../shared/db';
import { looksLikeJoinLinkToken, mintJoinLink, resolveJoinLink, revokeJoinLinksForCall } from '../channels/voice/join-links';

const mintedCallIds: string[] = [];

function callId(): string {
  const id = `voice-join-link-test-${crypto.randomUUID()}`;
  mintedCallIds.push(id);
  return id;
}

afterAll(async () => {
  for (const id of mintedCallIds) {
    await db.delete(voiceJoinLinks).where(eq(voiceJoinLinks.callId, id));
  }
});

describe('mintJoinLink / resolveJoinLink', () => {
  test('mints a token that looks like our scheme and resolves back to the same call', async () => {
    const id = callId();
    const projectId = crypto.randomUUID();
    const { token, expiresAt } = await mintJoinLink({ callId: id, projectId });

    expect(looksLikeJoinLinkToken(token)).toBe(true);
    expect(token.length).toBeGreaterThan(30);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

    const resolved = await resolveJoinLink(token);
    expect(resolved).toEqual({ ok: true, callId: id, projectId });
  });

  test('two links minted for the same call are independently resolvable and independently random', async () => {
    const id = callId();
    const projectId = crypto.randomUUID();
    const a = await mintJoinLink({ callId: id, projectId });
    const b = await mintJoinLink({ callId: id, projectId });

    expect(a.token).not.toBe(b.token);
    expect(await resolveJoinLink(a.token)).toEqual({ ok: true, callId: id, projectId });
    expect(await resolveJoinLink(b.token)).toEqual({ ok: true, callId: id, projectId });
  });

  test('an unknown token 404s without a DB round trip leaking which reason', async () => {
    const resolved = await resolveJoinLink('vjl_this-was-never-minted');
    expect(resolved).toEqual({ ok: false, status: 404, error: 'Invalid or unknown link' });
  });

  test('a token missing the scheme prefix is rejected as unknown, never looked up', async () => {
    const id = callId();
    const projectId = crypto.randomUUID();
    const { token } = await mintJoinLink({ callId: id, projectId });
    const withoutPrefix = token.replace(/^vjl_/, '');

    const resolved = await resolveJoinLink(withoutPrefix);
    expect(resolved.ok).toBe(false);
    if (resolved.ok) return;
    expect(resolved.status).toBe(404);
  });

  test('null/empty/undefined tokens are unknown, not a crash', async () => {
    expect((await resolveJoinLink(null)).ok).toBe(false);
    expect((await resolveJoinLink(undefined)).ok).toBe(false);
    expect((await resolveJoinLink('')).ok).toBe(false);
  });

  test('an expired link 410s instead of resolving', async () => {
    const id = callId();
    const projectId = crypto.randomUUID();
    const { token } = await mintJoinLink({ callId: id, projectId, ttlSeconds: -1 });

    const resolved = await resolveJoinLink(token);
    expect(resolved).toEqual({ ok: false, status: 410, error: 'This link has expired' });
  });
});

describe('revokeJoinLinksForCall', () => {
  test('revokes every link for a call — a resolve afterwards 410s', async () => {
    const id = callId();
    const projectId = crypto.randomUUID();
    const a = await mintJoinLink({ callId: id, projectId });
    const b = await mintJoinLink({ callId: id, projectId });

    await revokeJoinLinksForCall(id);

    expect(await resolveJoinLink(a.token)).toEqual({ ok: false, status: 410, error: 'This call has ended' });
    expect(await resolveJoinLink(b.token)).toEqual({ ok: false, status: 410, error: 'This call has ended' });
  });

  test('never touches links for a different call', async () => {
    const endedCallId = callId();
    const liveCallId = callId();
    const projectId = crypto.randomUUID();
    const ended = await mintJoinLink({ callId: endedCallId, projectId });
    const live = await mintJoinLink({ callId: liveCallId, projectId });

    await revokeJoinLinksForCall(endedCallId);

    expect((await resolveJoinLink(ended.token)).ok).toBe(false);
    expect(await resolveJoinLink(live.token)).toEqual({ ok: true, callId: liveCallId, projectId });
  });

  test('is idempotent — revoking an already-revoked call does not throw', async () => {
    const id = callId();
    const projectId = crypto.randomUUID();
    await mintJoinLink({ callId: id, projectId });

    await revokeJoinLinksForCall(id);
    await expect(revokeJoinLinksForCall(id)).resolves.toBeUndefined();
  });
});

describe('looksLikeJoinLinkToken', () => {
  test('true only for our prefix — used to route legacy raw-JWT links without a DB round trip', () => {
    expect(looksLikeJoinLinkToken('vjl_abc123')).toBe(true);
    expect(looksLikeJoinLinkToken('eyJhbGciOiJIUzI1NiJ9.raw.jwt')).toBe(false);
    expect(looksLikeJoinLinkToken('')).toBe(false);
  });
});
