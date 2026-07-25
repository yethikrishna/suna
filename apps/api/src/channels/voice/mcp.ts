/**
 * The voice MCP — how a Kortix agent spawns and talks to a voice agent.
 *
 * JSON-RPC 2.0 over streamable HTTP, mounted at /v1/mcp/voice and registered in
 * the project's opencode config. Served from the API rather than shipped as a
 * sandbox binary on purpose: the tool surface can then change with an API deploy
 * instead of a snapshot rebake, which is the slow and risky half of any change
 * here (in-flight sandboxes keep whatever was baked into their image).
 *
 * THE INVARIANT: every tool returns in milliseconds.
 *
 * The agent loop is single-threaded. A tool that waits — on a call, on a turn,
 * on a stream — wedges the whole session: it cannot reason, answer, or do
 * anything else until the tool returns. So `voice_spawn` hands back a call id
 * immediately and the call runs on its own; `voice_read` returns whatever is new
 * since a cursor and returns now, empty if nothing. There is deliberately no
 * follow/tail/stream tool, and adding one would break the agent. `run_command`
 * is the one bounded exception — it waits, but only up to a short hard cap (see
 * run-command.ts), never indefinitely.
 */
import { createRoute, z } from '@hono/zod-openapi';
import { errors, json, makeOpenApiApp } from '../../openapi';
import {
  availableVoices,
  endCall,
  isCallLive,
  promptVoiceAgent,
  readTurns,
} from './runtime';
import { runCommandInSandbox } from './run-command';

type JsonRpcId = string | number | null;

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: Record<string, unknown>;
}

/** The `voice_spawn` action surface — what mechanism to start the call with.
 *  Mirrors the `kortix_voice` channel connector's catalog (executor/channels.ts)
 *  1:1; `spawn_room` is the only one implemented. */
const VOICE_SPAWN_ACTIONS = ['spawn_room', 'join_gmeet', 'join_zoom'] as const;
type VoiceSpawnAction = (typeof VOICE_SPAWN_ACTIONS)[number];
const DEFAULT_VOICE_SPAWN_ACTION: VoiceSpawnAction = 'spawn_room';

export interface VoiceMcpContext {
  projectId: string;
  sessionId: string;
  /**
   * Starts a live call bound to this session via the chosen `action` and
   * returns a join link. Routes through the executor gateway (connector
   * policies/approvals/audit) — `action`s other than `spawn_room` are
   * declared but not implemented and reject with a clear, actionable error.
   */
  spawn(input: {
    action?: string | null;
    voice?: string | null;
    meetingUrl?: string | null;
  }): Promise<{ callId: string; joinUrl: string }>;
}

const PROTOCOL_VERSION = '2025-06-18';

function toolDefinitions() {
  const { voices, default: defaultVoice } = availableVoices();
  return [
    {
      name: 'voice_spawn',
      description:
        'Start a live call bound to THIS session and return a join link. `action` picks ' +
        'the mechanism — "spawn_room" (default, the only one implemented) creates a ' +
        'Kortix voice room; you cannot open a browser yourself, so send the link to the ' +
        'person you want to talk to (post it in chat, read it aloud if you have another ' +
        'channel, etc.) and they open it to join. "join_gmeet" / "join_zoom" are declared ' +
        'for a future join-an-existing-meeting mechanism and are NOT implemented yet — ' +
        'calling them returns a clear error telling you to use spawn_room instead. The ' +
        'call runs in the background once started — check in with voice_read. Returns ' +
        'immediately.',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: [...VOICE_SPAWN_ACTIONS],
            description: `Which mechanism to start the call with. Defaults to ${DEFAULT_VOICE_SPAWN_ACTION} — the only one implemented today.`,
          },
          voice: {
            type: 'string',
            enum: voices,
            description: `Speaking voice (spawn_room only). Defaults to ${defaultVoice}.`,
          },
          meeting_url: {
            type: 'string',
            description:
              'Meeting URL for join_gmeet/join_zoom (accepted for forward compatibility — those actions are not implemented yet).',
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
    {
      name: 'voice_read',
      description:
        'Read what has been said in a call since `cursor`. Returns immediately, empty if nothing is new. Pass the returned cursor back next time. This is how you follow a conversation without blocking.',
      inputSchema: {
        type: 'object',
        properties: {
          call_id: { type: 'string' },
          cursor: { type: 'integer', minimum: 0, default: 0 },
        },
        required: ['call_id'],
        additionalProperties: false,
      },
    },
    {
      name: 'send_prompt',
      description:
        'Say something into a live call. Use this to volunteer information, answer what someone asked, or steer the conversation. It is spoken aloud in your own voice.',
      inputSchema: {
        type: 'object',
        properties: {
          call_id: { type: 'string' },
          text: { type: 'string', description: 'Plain spoken language — no markdown or URLs.' },
        },
        required: ['call_id', 'text'],
        additionalProperties: false,
      },
    },
    {
      name: 'run_command',
      description:
        'Run a shell command in the sandbox behind this call and return its output. Unrestricted — use with the same care as a real terminal. Bounded by a short timeout, so a long-running command will report timed_out with whatever output arrived before the cutoff.',
      inputSchema: {
        type: 'object',
        properties: {
          call_id: { type: 'string' },
          command: { type: 'string', description: 'Shell command, run via `bash -lc`.' },
        },
        required: ['call_id', 'command'],
        additionalProperties: false,
      },
    },
    {
      name: 'voice_end',
      description: 'Leave the call and end it.',
      inputSchema: {
        type: 'object',
        properties: { call_id: { type: 'string' } },
        required: ['call_id'],
        additionalProperties: false,
      },
    },
  ];
}

function ok(id: JsonRpcId, value: unknown) {
  return { jsonrpc: '2.0', id, result: value };
}

function fail(id: JsonRpcId, code: number, message: string) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

function toolText(text: string, structured?: unknown) {
  return {
    content: [{ type: 'text', text }],
    ...(structured === undefined ? {} : { structuredContent: structured }),
  };
}

function toolError(message: string) {
  return { isError: true, ...toolText(message) };
}

async function callTool(
  ctx: VoiceMcpContext,
  name: unknown,
  rawArgs: unknown,
): Promise<Record<string, unknown>> {
  const args = rawArgs && typeof rawArgs === 'object' ? (rawArgs as Record<string, unknown>) : {};

  switch (name) {
    case 'voice_spawn': {
      const action = typeof args.action === 'string' && args.action.trim() ? args.action.trim() : null;
      const voice = typeof args.voice === 'string' ? args.voice : null;
      const meetingUrl = typeof args.meeting_url === 'string' ? args.meeting_url : null;
      const { callId, joinUrl } = await ctx.spawn({ action, voice, meetingUrl });
      return toolText(
        `Call started. call_id=${callId}. Send this link to the person joining — they open it in a browser: ${joinUrl}. The call runs in the background — poll voice_read with the cursor it returns.`,
        { call_id: callId, join_url: joinUrl, cursor: 0 },
      );
    }

    case 'voice_read': {
      const callId = String(args.call_id ?? '').trim();
      if (!callId) return toolError('call_id is required');
      const cursor = Number.isInteger(args.cursor) ? (args.cursor as number) : 0;
      const page = await readTurns(callId, cursor);
      const rendered = page.turns
        .map((t) => `${t.role === 'agent' ? 'you' : (t.speaker ?? 'someone')}: ${t.text}`)
        .join('\n');
      return toolText(rendered || '(nothing new)', {
        turns: page.turns,
        cursor: page.cursor,
        live: await isCallLive(callId),
      });
    }

    case 'send_prompt': {
      const callId = String(args.call_id ?? '').trim();
      const text = String(args.text ?? '').trim();
      if (!callId || !text) return toolError('call_id and text are required');
      const result = await promptVoiceAgent(callId, text);
      if (!result.delivered) return toolError(`call ${callId}: ${result.reason}`);
      return toolText('Sent to the call.', { call_id: callId });
    }

    case 'run_command': {
      const callId = String(args.call_id ?? '').trim();
      const command = String(args.command ?? '').trim();
      if (!callId || !command) return toolError('call_id and command are required');
      // The call id IS the session id, and the sandbox belongs to the session —
      // so the command target comes from the MCP context, not a call lookup.
      if (callId !== ctx.sessionId) return toolError(`call ${callId} is not this session's call`);
      try {
        const result = await runCommandInSandbox(ctx.sessionId, command);
        return toolText(result.stdout || '(no output)', {
          call_id: callId,
          stdout: result.stdout,
          stderr: result.stderr,
          exit_code: result.exitCode,
          timed_out: result.timedOut,
        });
      } catch (err) {
        return toolError(err instanceof Error ? err.message : String(err));
      }
    }

    case 'voice_end': {
      const callId = String(args.call_id ?? '').trim();
      if (!callId) return toolError('call_id is required');
      const ended = await endCall(callId);
      return ended ? toolText('Call ended.') : toolError(`call ${callId} is not live`);
    }

    default:
      return toolError(`Unknown tool: ${String(name)}`);
  }
}

export async function handleVoiceMcp(
  ctx: VoiceMcpContext,
  req: JsonRpcRequest,
): Promise<Record<string, unknown> | null> {
  const id = req.id ?? null;

  switch (req.method) {
    case 'initialize':
      return ok(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: 'kortix-voice', version: '1.0.0' },
      });

    case 'ping':
      return ok(id, {});

    case 'notifications/initialized':
      return null; // notification — no response

    case 'tools/list':
      return ok(id, { tools: toolDefinitions() });

    case 'tools/call': {
      const params = req.params ?? {};
      try {
        return ok(id, await callTool(ctx, params.name, params.arguments));
      } catch (err) {
        // Surface as a tool error, not a protocol error: the agent can read and
        // react to the former, while the latter usually just aborts the turn.
        return ok(id, toolError(err instanceof Error ? err.message : String(err)));
      }
    }

    default:
      return fail(id, -32601, `Method not found: ${req.method ?? '(none)'}`);
  }
}

export const voiceMcpApp = makeOpenApiApp();

voiceMcpApp.openapi(
  createRoute({
    method: 'post',
    path: '/',
    tags: ['channels'],
    summary: 'Voice MCP (JSON-RPC over streamable HTTP)',
    request: { body: { content: { 'application/json': { schema: z.any() } } } },
    responses: {
      200: json(z.any(), 'JSON-RPC response'),
      ...errors(400, 401, 404),
    },
  }),
  async (c: any) => {
    const ctx = c.get('voiceMcpContext') as VoiceMcpContext | undefined;
    if (!ctx) return c.json({ error: 'Unauthorized' }, 401);

    let body: JsonRpcRequest;
    try {
      body = (await c.req.json()) as JsonRpcRequest;
    } catch {
      return c.json(fail(null, -32700, 'Parse error'), 400);
    }

    const res = await handleVoiceMcp(ctx, body);
    if (res === null) return c.body(null, 202);
    return c.json(res);
  },
);
