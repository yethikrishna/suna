/**
 * GET /v1/public/voice-join/:token — the anonymous resolve step behind every
 * `voice_spawn` join link.
 *
 * Genuinely public: no Authorization header, no session/PAT, no Supabase
 * cookie. The whole point of a voice join link is handing it to someone
 * outside the account (see apps/web/src/middleware.ts's PUBLIC_ROUTES entry
 * for `/voice`, which this route backs) — requiring login here would defeat
 * that. The token itself, not an authenticated identity, IS the access
 * control: 256 bits of `crypto.randomBytes` (join-links.ts's `mintJoinLink`),
 * unguessable, expiring, and revoked the moment its call ends.
 *
 * Deliberately mints a FRESH LiveKit access token on every resolve rather
 * than storing one: the join link can outlive a single page load (a refresh,
 * a dropped connection, a second device), and a short-lived join link handing
 * back a token whose own TTL is independent of it — see livekit.ts's
 * `mintAccessToken`'s DEFAULT_TOKEN_TTL_SECONDS — means an open tab that sat
 * idle for a while still gets a token that works when it finally connects.
 */
import { createRoute, z } from '@hono/zod-openapi';
import { errors, json, makeOpenApiApp } from '../../openapi';
import { createVoiceJoinLinkRateLimitMiddleware } from '../../shared/rate-limit';
import { config } from '../../config';
import { mintAccessToken, roomNameForCall } from './livekit';
import { resolveJoinLink } from './join-links';

export const voiceJoinPublicApp = makeOpenApiApp();

voiceJoinPublicApp.use('/:token', createVoiceJoinLinkRateLimitMiddleware());

voiceJoinPublicApp.openapi(
  createRoute({
    method: 'get',
    path: '/{token}',
    tags: ['voice'],
    summary: 'GET /public/voice-join/:token — anonymous resolve of a voice join link',
    request: { params: z.object({ token: z.string() }) },
    responses: {
      200: json(
        z.object({ call_id: z.string(), url: z.string(), token: z.string() }),
        'LiveKit server URL + a freshly-minted access token for this call',
      ),
      ...errors(404, 410),
    },
  }),
  async (c: any) => {
    const token = c.req.param('token');
    const resolved = await resolveJoinLink(token);
    if (!resolved.ok) return c.json({ error: resolved.error }, resolved.status as any);

    const room = roomNameForCall(resolved.callId);
    const liveKitToken = await mintAccessToken({
      room,
      identity: `human-${resolved.callId}`,
      canPublish: true,
      canSubscribe: true,
    });

    return c.json({ call_id: resolved.callId, url: config.LIVEKIT_URL, token: liveKitToken });
  },
);
