// Anonymous resolve step for a `voice_spawn` join link — `/v1/public/voice-join/:token`
// (apps/api/src/channels/voice/public-join-routes.ts). Backs the logged-out
// `(public)/voice/[token]` page: the URL now carries a short, ungessable id
// rather than the raw LiveKit access token, so the page exchanges it here for
// a freshly-minted token + the LiveKit server URL.
//
// Deliberately NOT built on `backendApi` (platform/api-client.ts) for the same
// reason `public-session-shares.ts` isn't: that client's authenticated fetch
// path synthesizes a failure for a visitor with no token WITHOUT ever making
// the network call. This route is genuinely public — no Authorization header,
// no `configureKortix()` call required — mirroring `getPublicShareUrlForToken`'s
// and `getPublicSessionShare`'s stance.

import { getBackendUrl } from '../../session/server-store/url-helpers';

export class PublicVoiceJoinError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'PublicVoiceJoinError';
  }
}

export interface PublicVoiceJoinInfo {
  call_id: string;
  /** The LiveKit server's `ws(s)://` URL — never assume it shares an origin
   *  with either the API or the frontend that served this page. */
  url: string;
  /** A freshly-minted, room-scoped LiveKit access token — not the join
   *  link's own token. */
  token: string;
}

function publicVoiceJoinUrl(token: string): string {
  return `${getBackendUrl()}/public/voice-join/${encodeURIComponent(token)}`;
}

/** Resolves a short `voice_spawn` join-link token into a live LiveKit
 *  session's server URL + a fresh access token. Throws `PublicVoiceJoinError`
 *  (404 unknown, 410 expired/revoked) on anything but 200. */
export async function getPublicVoiceJoin(token: string): Promise<PublicVoiceJoinInfo> {
  const res = await fetch(publicVoiceJoinUrl(token), { method: 'GET', headers: { Accept: 'application/json' } });
  const text = await res.text().catch(() => '');
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // Non-JSON body — fall through to the generic error message below.
  }
  if (!res.ok) {
    const message =
      (body && typeof body === 'object' && 'error' in body && typeof (body as { error?: unknown }).error === 'string'
        ? (body as { error: string }).error
        : null) || res.statusText || `HTTP ${res.status}`;
    throw new PublicVoiceJoinError(message, res.status);
  }
  return body as PublicVoiceJoinInfo;
}
