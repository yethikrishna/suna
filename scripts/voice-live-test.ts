#!/usr/bin/env bun
/**
 * Live end-to-end test for the voice channel, minus the sandbox.
 *
 * The full agent path (opencode -> MCP -> spawn) needs a snapshot rebake to ship
 * the voice MCP config into a sandbox. Everything BELOW that is testable today,
 * and it is the part that can actually be wrong: the provider session, the audio
 * bridge, Recall's output_media, turn-taking, and the ask_kortix hand-off.
 *
 * This drives the same runtime the MCP would, in-process, against a real
 * meeting. If you can hold a conversation with it, the channel works.
 *
 * Usage:
 *   dotenvx run -f apps/api/.env -- bun scripts/voice-live-test.ts \
 *     --meeting https://meet.google.com/abc-defg-hij \
 *     --web     https://<web-tunnel>            \
 *     --api     https://<api-tunnel>            \
 *     [--session <real session id>] [--voice eve]
 *
 * --session makes ask_kortix deliver into a REAL Kortix session. Without it the
 * hand-off still runs and is expected to report 'no-session' — which is itself
 * worth seeing, since that path is what keeps the call from hanging when the
 * session is gone.
 */

import { attachBridge } from '../apps/api/src/channels/voice/bridge';
import { mintVoiceBridgeToken, voiceBridgeUrl } from '../apps/api/src/channels/voice-bridge-token';
import { startCall, endCall, readTurns, promptVoiceAgent, getCall } from '../apps/api/src/channels/voice/runtime';

interface Args {
  noBot?: boolean;
  meeting?: string;
  web?: string;
  api?: string;
  session?: string;
  voice?: string;
  project?: string;
}

function parseArgs(argv: string[]): Args {
  const a: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const f = argv[i];
    const v = argv[i + 1];
    if (f === '--no-bot') a.noBot = true;
    else if (f === '--meeting' && v) (a.meeting = v), i++;
    else if (f === '--web' && v) (a.web = v), i++;
    else if (f === '--api' && v) (a.api = v), i++;
    else if (f === '--session' && v) (a.session = v), i++;
    else if (f === '--voice' && v) (a.voice = v), i++;
    else if (f === '--project' && v) (a.project = v), i++;
  }
  return a;
}

async function recall(path: string, body?: unknown) {
  const key = process.env.RECALL_API_KEY;
  const base = (process.env.RECALL_BASE_URL || 'https://us-west-2.recall.ai/api/v1').replace(/\/+$/, '');
  const res = await fetch(`${base}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Token ${key}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data: any = text;
  try {
    data = JSON.parse(text);
  } catch {
    /* keep raw */
  }
  return { ok: res.ok, status: res.status, data };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.web || !args.api || (!args.meeting && !args.noBot)) {
    console.error('Required: --web <base> --api <base> and either --meeting <url> or --no-bot');
    process.exit(1);
  }
  if (!process.env.XAI_API_KEY) {
    console.error('XAI_API_KEY missing — run under dotenvx.');
    process.exit(1);
  }

  // A stable, obviously-fake project id keeps the bridge token self-consistent
  // without needing a real project row; the token is only ever checked against
  // itself and the live call registry.
  const projectId = args.project ?? '00000000-0000-4000-8000-000000000000';
  const sessionId = args.session ?? `livetest-${Date.now()}`;
  const callId = sessionId;

  console.log(`project: ${projectId}`);
  console.log(`session: ${sessionId}${args.session ? '' : '  (synthetic — ask_kortix will report no-session)'}`);
  console.log('');

  console.log('1/4  opening the provider session…');
  const call = await startCall({
    callId,
    projectId,
    sessionId,
    botId: null,
    botName: 'Kortix',
    voice: args.voice ?? null,
    postChat: async (message) => {
      const c = getCall(callId);
      if (!c?.botId) return;
      await recall(`/bot/${encodeURIComponent(c.botId)}/send_chat_message/`, { message });
    },
  });
  console.log(`     up. voice=${call.voice}`);

  // Serve the audio bridge from THIS process. The call registry is in-memory, so
  // the socket has to be answered by whoever holds the provider session — the
  // running API is a different process and would (correctly) reject the page.
  const port = Number(process.env.VOICE_TEST_PORT || 15710);
  Bun.serve({
    port,
    fetch(req, server) {
      const url = new URL(req.url);
      if (!url.pathname.startsWith('/v1/voice/bridge/')) return new Response('not found', { status: 404 });
      const t = url.pathname.slice('/v1/voice/bridge/'.length);
      return server.upgrade(req, { data: { token: t } })
        ? undefined
        : new Response('upgrade failed', { status: 500 });
    },
    websocket: {
      idleTimeout: 0,
      open(ws: any) {
        const attached = attachBridge(ws.data.token, ws);
        if (!attached.ok) {
          console.error(`  [bridge] rejected: ${attached.status} ${attached.error}`);
          ws.close(1008, attached.error ?? 'rejected');
          return;
        }
        let up = 0;
        ws.data.onAudio = (pcm: Buffer) => {
          up++;
          if (up % 100 === 0) console.log(`  [bridge] ${up} frames up (room -> model)`);
          attached.onAudio?.(pcm);
        };
        ws.data.detach = attached.detach;
        console.log('  [bridge] page connected — audio flowing');

        const c = getCall(callId);
        if (c) {
          let down = 0;
          const orig = c.sendToRoom;
          c.sendToRoom = (pcm: Buffer) => {
            down++;
            if (down === 1 || down % 100 === 0) console.log(`  [bridge] ${down} frames down (model -> room)`);
            orig?.(pcm);
          };
        }
      },
      message(ws: any, msg: string | Buffer) {
        if (typeof msg !== 'string') ws.data.onAudio?.(Buffer.from(msg));
      },
      close(ws: any) {
        ws.data.detach?.();
        console.log('  [bridge] page disconnected');
      },
    },
  });
  let botId: string | undefined;
  console.log(`     bridge listening on :${port} (expose it as ${args.api})`);

  const { token } = mintVoiceBridgeToken(projectId, callId);
  const pageUrl = voiceBridgeUrl(args.web, token, args.api);
  console.log(`2/4  bridge page: ${pageUrl.slice(0, 90)}…`);

  if (args.noBot) {
    // Isolation mode: same provider session, same bridge, no Recall and no
    // tunnel. Whatever latency remains here is the floor the design can hit.
    console.log('');
    console.log('3/4  NO-BOT mode — open this in your browser (headphones on):');
    console.log('');
    console.log(`     ${pageUrl}`);
    console.log('');
    console.log('4/4  live. Talk to it. Ctrl-C to stop.');
    console.log('');
  } else {
  console.log('3/4  sending the bot into the meeting…');
  const joined = await recall('/bot/', {
    meeting_url: args.meeting,
    bot_name: 'Kortix',
    output_media: { camera: { kind: 'webpage', config: { url: pageUrl } } },
  });
  if (!joined.ok) {
    console.error(`     join failed (${joined.status}):`, JSON.stringify(joined.data).slice(0, 400));
    await endCall(callId);
    process.exit(1);
  }
  botId = joined.data?.id as string;
  call.botId = botId;
  console.log(`     bot ${botId} — ADMIT IT in the meeting.`);
  console.log('');
  console.log('4/4  live. Talk to it. Transcript below; Ctrl-C to hang up.');
  console.log('     (say "what can you do" — small talk it answers itself;');
  console.log('      ask for real work and it will call ask_kortix)');
  console.log('');
  }

  let cursor = 0;
  const poll = setInterval(async () => {
    try {
      const page = await readTurns(callId, cursor);
      for (const t of page.turns) {
        console.log(`  ${t.role === 'agent' ? '🔊 kortix' : '🗣  human '}: ${t.text}`);
      }
      cursor = page.cursor;
    } catch (err) {
      console.error('  [poll error]', err instanceof Error ? err.message : err);
    }
  }, 1500);

  // Wait for the PAGE, not a timer. Agent audio produced before the bridge
  // attaches is dropped on the floor (there is nowhere to put it), so an intro
  // on a fixed delay races the connection and is silently lost.
  let introduced = false;
  const introWatch = setInterval(() => {
    const c = getCall(callId);
    if (introduced || !c?.sendToRoom) return;
    introduced = true;
    clearInterval(introWatch);
    setTimeout(() => {
      const said = promptVoiceAgent(
        callId,
        'Say exactly this out loud now, then stop: "Hey, Kortix here. I can hear you — just talk normally."',
      );
      console.log(said ? '  [kortix -> call] intro spoken' : '  [kortix -> call] call not live');
    }, 800);
  }, 250);

  const shutdown = async () => {
    clearInterval(poll);
    console.log('\nhanging up…');
    if (!args.noBot && botId) await recall(`/bot/${encodeURIComponent(botId)}/leave_call/`, {});
    await endCall(callId);
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

void main();
