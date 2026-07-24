import { describe, expect, test } from 'bun:test';
import {
  mintVoiceBridgeToken,
  resolveVoiceBridgeToken,
  voiceBridgeUrl,
} from '../channels/voice-bridge-token';
import { encryptProjectSecret } from '../projects/secrets';

const PROJECT_A = '11111111-1111-4111-8111-111111111111';
const PROJECT_B = '22222222-2222-4222-8222-222222222222';

describe('voice bridge token', () => {
  test('round-trips the call it was minted for', () => {
    const { token } = mintVoiceBridgeToken(PROJECT_A, 'call-abc');
    const resolved = resolveVoiceBridgeToken(token);
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.projectId).toBe(PROJECT_A);
    expect(resolved.callId).toBe('call-abc');
  });

  test('is scoped to one project — another project cannot decrypt it', () => {
    // The envelope is encrypted with the PROJECT's key, so a token lifted from
    // one project is inert in another. This is the main containment property:
    // the token rides in a URL loaded by a browser we do not control.
    const { token } = mintVoiceBridgeToken(PROJECT_A, 'call-abc');
    const decoded = Buffer.from(token.slice('kvr_'.length), 'base64url').toString('utf8');
    const envelope = decoded.slice(decoded.indexOf('.') + 1);
    const forged = `kvr_${Buffer.from(`${PROJECT_B}.${envelope}`, 'utf8').toString('base64url')}`;

    const resolved = resolveVoiceBridgeToken(forged);
    expect(resolved.ok).toBe(false);
    if (resolved.ok) return;
    expect(resolved.status).toBe(404);
  });

  test('minting clamps a nonsense TTL rather than producing a dead-on-arrival token', () => {
    const { token, expiresAt } = mintVoiceBridgeToken(PROJECT_A, 'call-abc', {
      expiresInMinutes: -1,
    });
    expect(expiresAt).toBeGreaterThan(Date.now());
    expect(resolveVoiceBridgeToken(token).ok).toBe(true);
  });

  test('an expired token is 410, not 404 — the page can tell the difference', () => {
    // Hand-built, because mint() refuses to produce one (see the clamp above).
    const payload = {
      exp: Date.now() - 1_000,
      nonce: 'n',
      pid: PROJECT_A,
      call: 'call-abc',
    };
    const envelope = encryptProjectSecret(PROJECT_A, JSON.stringify(payload));
    const token = `kvr_${Buffer.from(`${PROJECT_A}.${envelope}`, 'utf8').toString('base64url')}`;

    const resolved = resolveVoiceBridgeToken(token);
    expect(resolved.ok).toBe(false);
    if (resolved.ok) return;
    // 410 not 404: expiry is recoverable (rejoin), a bad token is not.
    expect(resolved.status).toBe(410);
  });

  test('tampered ciphertext is indistinguishable from a token that never existed', () => {
    const { token } = mintVoiceBridgeToken(PROJECT_A, 'call-abc');
    const mangled = `${token.slice(0, -4)}AAAA`;
    const resolved = resolveVoiceBridgeToken(mangled);
    expect(resolved.ok).toBe(false);
    if (resolved.ok) return;
    // 404 on purpose: never leak whether a token merely decrypted.
    expect(resolved.status).toBe(404);
  });

  test.each([
    ['garbage', 'not-a-token'],
    ['wrong prefix', 'ksl_abc'],
    ['empty', ''],
  ])('rejects %s', (_label, value) => {
    const resolved = resolveVoiceBridgeToken(value);
    expect(resolved.ok).toBe(false);
  });

  test('rejects a non-canonical base64url spelling of a valid token', () => {
    // Padding changes the encoding without changing the bytes; accepting it
    // would give one call several distinct-looking tokens.
    const { token } = mintVoiceBridgeToken(PROJECT_A, 'call-abc');
    const resolved = resolveVoiceBridgeToken(`${token}=`);
    expect(resolved.ok).toBe(false);
  });

  test('builds a bridge URL without doubling the slash', () => {
    expect(voiceBridgeUrl('https://app.example.com/', 'kvr_x')).toBe(
      'https://app.example.com/voice/kvr_x',
    );
  });
});
