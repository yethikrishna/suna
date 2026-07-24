/**
 * Bridge tokens — the credential the audio page carries.
 *
 * That page is rendered by Recall, inside a browser we do not control, with the
 * token sitting in its URL. So the token is deliberately the weakest thing that
 * still works: it authorises relaying audio for ONE call and nothing else. It
 * cannot prompt a session, cannot read a transcript, and never touches the
 * realtime provider's credentials — those stay server-side, which is the whole
 * reason the provider WebSocket lives in the API rather than in the page.
 *
 * Mechanically this is the setup-link pattern (see ../setup-links/token.ts):
 * STATELESS, no table. The token is an AEAD envelope encrypted with the
 * PROJECT's key, so one project's token can't be decrypted by another and a
 * tampered token simply fails to decrypt — indistinguishable from one that never
 * existed, so we never leak which.
 *
 * Wire format: `kvr_<base64url(projectId "." envelope)>`. projectId rides
 * outside only to pick the decryption key; `payload.pid` is cross-checked
 * against it on resolve.
 */
import { randomBytes } from 'node:crypto';
import { decryptProjectSecret, encryptProjectSecret } from '../projects/secrets';

const TOKEN_PREFIX = 'kvr_';
/** Comfortably past Recall's max call length; the call ending is what really ends it. */
const DEFAULT_TTL_MINUTES = 6 * 60;

export interface VoiceBridgePayload {
  exp: number;
  nonce: string;
  /** projectId sealed inside the envelope; cross-checked against the outer id. */
  pid: string;
  /** The voice call this page relays audio for. Scope is exactly this. */
  call: string;
}

export function mintVoiceBridgeToken(
  projectId: string,
  callId: string,
  opts?: { expiresInMinutes?: number | null },
): { token: string; expiresAt: number } {
  const minutes =
    typeof opts?.expiresInMinutes === 'number' && Number.isFinite(opts.expiresInMinutes)
      ? Math.max(1, Math.floor(opts.expiresInMinutes))
      : DEFAULT_TTL_MINUTES;
  const exp = Date.now() + minutes * 60_000;
  const payload: VoiceBridgePayload = {
    exp,
    nonce: randomBytes(9).toString('base64url'),
    pid: projectId,
    call: callId,
  };
  const envelope = encryptProjectSecret(projectId, JSON.stringify(payload));
  const token = TOKEN_PREFIX + Buffer.from(`${projectId}.${envelope}`, 'utf8').toString('base64url');
  return { token, expiresAt: exp };
}

export type ResolvedVoiceBridge =
  | { ok: true; projectId: string; callId: string; payload: VoiceBridgePayload }
  | { ok: false; status: 404 | 410; error: string };

export function resolveVoiceBridgeToken(token: string | undefined | null): ResolvedVoiceBridge {
  if (!token || !token.startsWith(TOKEN_PREFIX)) {
    return { ok: false, status: 404, error: 'Invalid or unknown bridge token' };
  }

  let projectId: string;
  let envelope: string;
  try {
    // Reject non-canonical base64url spellings before decrypting the envelope.
    const encoded = token.slice(TOKEN_PREFIX.length);
    const decodedBytes = Buffer.from(encoded, 'base64url');
    if (decodedBytes.toString('base64url') !== encoded) {
      return { ok: false, status: 404, error: 'Invalid or unknown bridge token' };
    }
    const decoded = decodedBytes.toString('utf8');
    const dot = decoded.indexOf('.');
    if (dot <= 0) return { ok: false, status: 404, error: 'Invalid or unknown bridge token' };
    projectId = decoded.slice(0, dot);
    envelope = decoded.slice(dot + 1);
  } catch {
    return { ok: false, status: 404, error: 'Invalid or unknown bridge token' };
  }

  let payload: VoiceBridgePayload;
  try {
    payload = JSON.parse(decryptProjectSecret(projectId, envelope)) as VoiceBridgePayload;
  } catch {
    // Wrong project key, tampered ciphertext, or garbage → indistinguishable
    // from "never existed". Don't leak which.
    return { ok: false, status: 404, error: 'Invalid or unknown bridge token' };
  }

  if (payload.pid !== projectId) {
    return { ok: false, status: 404, error: 'Invalid or unknown bridge token' };
  }
  if (typeof payload.exp !== 'number' || Date.now() > payload.exp) {
    return { ok: false, status: 410, error: 'This voice bridge has expired' };
  }
  if (!payload.call) {
    return { ok: false, status: 404, error: 'Invalid or unknown bridge token' };
  }

  return { ok: true, projectId, callId: payload.call, payload };
}

/**
 * The page is served by the web app but must open its audio socket against the
 * API, which is a different host in every real deployment (and in local dev).
 * The API knows its own public base and the page cannot guess it, so it is
 * passed explicitly rather than inferred from window.location.
 */
export function voiceBridgeUrl(frontendUrl: string, token: string, apiBaseUrl?: string): string {
  const base = `${frontendUrl.replace(/\/+$/, '')}/voice/${token}`;
  if (!apiBaseUrl) return base;
  return `${base}?api=${encodeURIComponent(apiBaseUrl.replace(/\/+$/, ''))}`;
}
