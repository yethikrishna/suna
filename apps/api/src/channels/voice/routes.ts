/**
 * Mount point for the voice MCP.
 *
 * Auth reuses the executor's project-principal resolution rather than inventing
 * a second path: the caller is an in-sandbox agent holding a session-scoped
 * credential, which is exactly what the executor already knows how to identify.
 * That also means `voice_spawn` joins the meeting through the executor gateway,
 * so connector policies, approvals, and the audit trail all apply — a direct
 * Recall call from here would quietly bypass every one of them.
 */
import { createRoute, z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { dbExecutorRouterDeps } from '../../executor/db-deps';
import { handleCall } from '../../executor/gateway';
import { VOICE_CHANNEL_CONNECTOR_SLUG } from '../../executor/channels';
import { errors, json, makeOpenApiApp } from '../../openapi';
import { resolveProjectBotName } from '../voice-identity';
import { handleVoiceMcp, type VoiceMcpContext } from './mcp';
import { startCall } from './runtime';

export const voiceMcpRoutes = makeOpenApiApp();

async function buildContext(c: Context, projectId: string): Promise<VoiceMcpContext | null> {
  const principal = await dbExecutorRouterDeps.resolveProjectPrincipal(c, projectId);
  if (!principal?.sessionId) return null;

  const sessionId = principal.sessionId;

  return {
    projectId,
    sessionId,
    async spawn({ meetingUrl, voice }) {
      const botName = await resolveProjectBotName(projectId);

      // The call id IS the session id: one live call per session, and it is what
      // binds the conversation to the thread that spawned it. The bridge token
      // minted at join time carries the same value.
      const callId = sessionId;

      // Start the provider session BEFORE joining. If the bot arrives first it
      // renders a bridge page whose call does not exist yet, and the page's
      // socket is rejected with nothing to retry against.
      await startCall({
        callId,
        projectId,
        sessionId,
        botId: null,
        botName,
        voice,
        postChat: async (message: string) => {
          const call = (await import('./runtime')).getCall(callId);
          if (!call?.botId) return;
          await handleCall(dbExecutorRouterDeps.makeGatewayDeps(principal), {
            projectId,
            accountId: principal.accountId,
            subject: principal.subject,
            sessionId,
            connectorSlug: VOICE_CHANNEL_CONNECTOR_SLUG,
            actionPath: 'send_chat_message',
            args: { id: call.botId, message },
          });
        },
      });

      const result = await handleCall(dbExecutorRouterDeps.makeGatewayDeps(principal), {
        projectId,
        accountId: principal.accountId,
        subject: principal.subject,
        sessionId,
        connectorSlug: VOICE_CHANNEL_CONNECTOR_SLUG,
        actionPath: 'join_meeting',
        args: { meeting_url: meetingUrl },
      });

      if (result.status !== 'ok') {
        // Surface the gateway's own reason (policy denial, missing connector,
        // pending approval) rather than a generic failure — the agent can act on
        // "connector_not_found" and cannot act on "join failed".
        const detail = (result as { reason?: string }).reason ?? result.status;
        throw new Error(`could not join the meeting: ${detail}`);
      }

      const botId =
        result.data && typeof result.data === 'object'
          ? ((result.data as { id?: string }).id ?? null)
          : null;

      const call = (await import('./runtime')).getCall(callId);
      if (call) call.botId = botId;

      return { callId, botId };
    },
  };
}

voiceMcpRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/{projectId}/mcp/voice',
    tags: ['channels'],
    summary: 'POST /:projectId/mcp/voice — voice MCP (JSON-RPC)',
    request: {
      params: z.object({ projectId: z.string() }),
      body: { content: { 'application/json': { schema: z.any() } } },
    },
    responses: {
      200: json(z.any(), 'JSON-RPC response'),
      ...errors(400, 401, 404),
    },
  }),
  async (c: any) => {
    const projectId = c.req.param('projectId');
    const ctx = await buildContext(c, projectId);
    if (!ctx) return c.json({ error: 'Unauthorized' }, 401);

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, 400);
    }

    const res = await handleVoiceMcp(ctx, body as Record<string, unknown>);
    if (res === null) return c.body(null, 202);
    return c.json(res);
  },
);
