/**
 * The voice runtime — where a live call actually lives.
 *
 * A call IS a LiveKit room — there is no call record anywhere. The room carries
 * the actual audio (browser mic <-> the /voice/[token] page <-> the
 * apps/voice-agent worker doing STT/LLM/TTS); this file never touches audio.
 * What it owns is the two hand-offs either side of that conversation:
 *
 *   worker ──ask_kortix (MCP)──► askKortix ──► continueSession   (send_prompt)
 *   Kortix turn ──► promptVoiceAgent ──► room data channel ──► worker  (say)
 *
 * The worker is a SEPARATE PROCESS (apps/voice-agent, not part of apps/api),
 * dispatched into the room by name and bootstrapped entirely from the room's
 * metadata — see `VoiceRoomMetadata` below and apps/voice-agent/README.md's
 * "The apps/api contract this app expects", which this file (plus the voice
 * MCP — mcp.ts / routes.ts) implements.
 *
 * The single most important property, unchanged from the realtime-provider
 * version this replaces: `askKortix` (the MCP's `ask_kortix` tool, called by
 * the worker's own `send_prompt` tool) answers in milliseconds and NEVER
 * waits for the agent turn. A Kortix turn runs 30s-10min; a conversation that
 * blocks that long is broken. The answer comes back later as unsolicited
 * speech, driven by answer-watch.ts — see its header for why the API watches
 * for the answer instead of the sandbox relaying it.
 *
 * NOTHING here is kept in memory. A call's identity is its session id, its room
 * name derives from that, its liveness is whatever LiveKit says right now, and
 * its transcript is in Postgres. That is what makes the worker's voice MCP
 * calls work regardless of which API instance they land on — they used to
 * have to hit the one process that happened to run `voice_spawn`.
 */
import { and, asc, eq, gt } from 'drizzle-orm';
import { projectSessions, voiceCallTurns } from '@kortix/db';
import { continueSession } from '../../projects/session-lifecycle';
import { config } from '../../config';
import { db } from '../../shared/db';
import {
  createRoom,
  deleteRoom,
  KORTIX_REPLY_TOPIC,
  roomCallbackUrl,
  roomHasAgent,
  roomNameForCall,
  sendRoomData,
} from './livekit';
import { speakAnswerWhenReady } from './answer-watch';
import { revokeJoinLinksForCall } from './join-links';
import { KORTIX_SPEAKER, type KortixUtterance, kortixSay } from './utterance';
import { mintCallApiToken } from './worker-token';

/**
 * apps/voice-agent's TTS is hardcoded to `openai.TTS({ voice: 'alloy' })`
 * today (it does not yet read a voice choice from room metadata) — this list
 * is just `startCall`'s input validation ahead of that wiring, not because
 * anything downstream currently honors a non-default choice.
 */
const VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'] as const;
const DEFAULT_VOICE: (typeof VOICES)[number] = 'alloy';

export interface VoiceCall {
  callId: string;
  projectId: string;
  sessionId: string;
  voice: string;
  /** LiveKit room name — `roomNameForCall(callId)`. */
  room: string;
  startedAt: number;
  closed: boolean;
}

/**
 * Whether a call is live, asked of the only thing that actually knows: LiveKit.
 *
 * There is deliberately NO in-process call registry. There used to be, and every
 * fact it held was either already in the caller's hands or derivable — `callId`
 * IS the session id, `room` is `voice-${callId}`, and liveness is whether a
 * worker is in that room. What the Map added was a second, wrong answer: it
 * outlived calls the worker had already left (so `voice_spawn` reported a live
 * call and handed out a link to an empty room), it 404'd `/voice/prompt` with
 * "call not found" for requests whose URL already named the project and session,
 * and being per-process it could only ever be right on a single API pod.
 */
export async function isCallLive(callId: string): Promise<boolean> {
  return roomHasAgent(roomNameForCall(callId));
}

/**
 * Everything apps/voice-agent needs to bootstrap a freshly dispatched job,
 * carried in the LiveKit room's metadata so the worker never has to call back
 * into the API just to learn who it's talking to. Field names and shape are
 * fixed by that app's `call-context.ts` (`RoomMetadataShape`) — snake_case,
 * NOT this codebase's usual camelCase, because the contract is owned jointly
 * with a consumer this file cannot rename.
 */
export interface VoiceRoomMetadata {
  project_id: string;
  session_id: string;
  call_id: string;
  kortix_api_url: string;
  kortix_api_token: string;
  bot_name: string;
}

export interface StartCallInput {
  callId: string;
  projectId: string;
  sessionId: string;
  botName: string;
  voice?: string | null;
}

export async function startCall(input: StartCallInput): Promise<VoiceCall> {
  const voice =
    input.voice && (VOICES as readonly string[]).includes(input.voice) ? input.voice : DEFAULT_VOICE;
  const room = roomNameForCall(input.callId);

  const call: VoiceCall = {
    callId: input.callId,
    projectId: input.projectId,
    sessionId: input.sessionId,
    voice,
    room,
    startedAt: Date.now(),
    closed: false,
  };

  // Already staffed AND still pointed at this API → reuse. Otherwise (re)build
  // the room and dispatch a worker.
  //
  // Liveness is asked of LiveKit rather than remembered, so a second
  // `voice_spawn` in the same session can no longer hand back a link to a room
  // the worker left — which it did every time, since callId IS the session id.
  //
  // The metadata check matters just as much: a room outlives the process that
  // made it (emptyTimeout is 30min), and its metadata carries the callback URL
  // and per-call token the worker authenticates with. Reusing a live room whose
  // metadata names a DEAD api url gives you an agent that joins, greets, listens
  // — and then answers every real request with "I couldn't reach Kortix",
  // because its hand-off is POSTing into the void. Rebuilding is cheap; a call
  // that cannot reach Kortix is worthless.
  if ((await roomHasAgent(room)) && (await roomCallbackUrl(room)) === config.KORTIX_URL) {
    return call;
  }

  const metadata: VoiceRoomMetadata = {
    project_id: input.projectId,
    session_id: input.sessionId,
    call_id: input.callId,
    kortix_api_url: config.KORTIX_URL,
    kortix_api_token: mintCallApiToken(input.callId),
    bot_name: input.botName,
  };

  // Create the room, dispatched to the worker, BEFORE anything tries to join
  // it — same ordering the old code used for the provider connect: if the bot
  // arrives first it must find somewhere real to join.
  await createRoom(room, JSON.stringify(metadata));

  return call;
}

/**
 * Prepended to EVERY inbound voice turn, so it stays short — the cost of a
 * word here is paid once per thing anyone says in the call.
 *
 * The skill pointer is the important line, and it mirrors what Slack and Teams
 * already do (channels/slack/session.ts, channels/teams/session.ts): the full
 * surface — the `kortix_voice` connector's actions, one-call-per-session, the
 * cursor loop, how a human gets a join link — lives in the `kortix-voice`
 * skill, not in this prompt. Without the pointer the agent only ever learned
 * the tone rules below and had no idea it could read the room or speak into it
 * unprompted, which is exactly how it behaved.
 */
const TURN_INSTRUCTIONS = [
  'How to work:',
  '- First, load the `kortix-voice` skill via the `skill` tool — the canonical reference for',
  '  working a live call (the `kortix_voice` connector: read_transcript, send_prompt, end_call).',
  '- Whatever you report back is SPOKEN ALOUD, so answer in plain spoken language — no markdown,',
  '  no bullet lists, no raw URLs, no code. A couple of sentences unless more was asked for.',
  '- You can also talk into the call yourself at any time with `send_prompt`, and read what is',
  '  being said with `read_transcript` (cursor-paged, returns immediately, never blocks).',
  '- Nothing blocks: the conversation continues while you work, and you are not holding the line.',
].join('\n');

export function buildAskPrompt(request: string, callId: string): string {
  return [
    `[Live voice call ${callId}] Someone in the call asked: "${request}"`,
    '',
    TURN_INSTRUCTIONS,
  ].join('\n');
}

/**
 * The mirror of the old `ask_kortix` tool-call handler, now driven by the
 * worker's `ask_kortix` MCP tool call (mcp.ts / routes.ts) instead of an
 * in-process SDK callback. Answers FIRST, then delivers — the caller (the
 * MCP route) returns immediately after this resolves, well before
 * `continueSession` has done anything at all.
 */
export function askKortix(call: VoiceCall, request: string): { ok: true } | { ok: false; error: string } {
  const trimmed = request.trim();
  if (!trimmed) return { ok: false, error: 'empty request' };

  // Start watching BEFORE the prompt is delivered: the watcher's first act is
  // to record which assistant turn was already the newest, and it must do that
  // while that is still true, or a fast turn could complete between delivery and
  // baseline and then look like pre-existing history.
  speakAnswerWhenReady(call.callId, call.sessionId);

  void continueSession({
    source: 'voice',
    sessionId: call.sessionId,
    text: buildAskPrompt(trimmed, call.callId),
    userId: null,
  })
    .then((outcome) => {
      if (outcome !== 'delivered') {
        console.error('[voice] ask_kortix not delivered', { outcome, sessionId: call.sessionId });
        // The conversation would otherwise hang on a promise nobody kept.
        void promptVoiceAgent(
          call.callId,
          kortixSay("I couldn't reach the agent session just now, so that request didn't go through."),
          { projectId: call.projectId },
        );
      }
    })
    .catch((err) => console.error('[voice] ask_kortix delivery failed', err));

  return { ok: true };
}

export async function appendTurn(
  call: Pick<VoiceCall, 'callId' | 'projectId' | 'sessionId'>,
  // 'tool' = a record of an ask_kortix/run_command call the worker made
  // through the voice MCP (mcp.ts's callTool) — not spoken, but part of what
  // "what did the voice agent DO" needs to show.
  role: 'user' | 'agent' | 'tool',
  text: string,
  speaker?: string | null,
): Promise<void> {
  const clean = text.trim();
  if (!clean) return;
  await db.insert(voiceCallTurns).values({
    callId: call.callId,
    projectId: call.projectId,
    sessionId: call.sessionId,
    role,
    speaker: speaker ?? null,
    text: clean,
  });
}

export interface TranscriptPage {
  turns: Array<{ cursor: number; role: string; speaker: string | null; text: string; at: string }>;
  cursor: number;
}

/**
 * Everything after `cursor`, in order. Returns immediately — empty when nothing
 * is new. This is the whole point: the agent checks in, it never listens.
 */
export async function readTurns(
  callId: string,
  cursor: number,
  limit = 200,
): Promise<TranscriptPage> {
  const rows = await db
    .select()
    .from(voiceCallTurns)
    .where(and(eq(voiceCallTurns.callId, callId), gt(voiceCallTurns.cursor, cursor)))
    .orderBy(asc(voiceCallTurns.cursor))
    .limit(limit);

  return {
    turns: rows.map((r) => ({
      cursor: r.cursor,
      role: r.role,
      speaker: r.speaker,
      text: r.text,
      at: r.createdAt.toISOString(),
    })),
    // Hold the caller's cursor when nothing arrived, so an idle poll is a no-op.
    cursor: rows.length > 0 ? rows[rows.length - 1]!.cursor : cursor,
  };
}

export async function endCall(callId: string): Promise<boolean> {
  await deleteRoom(roomNameForCall(callId));
  // A join link outliving the call it points at is a link to an empty room —
  // revoke it here rather than waiting out its TTL, same reasoning as the
  // room's own emptyTimeout/departureTimeout: the call ending is what really
  // ends it. Best-effort like `deleteRoom` above: a revoke failure must not
  // stop `end_call` from reporting the call as ended, since the room is
  // already gone either way.
  await revokeJoinLinksForCall(callId).catch((err) =>
    console.error('[voice] revokeJoinLinksForCall failed', err),
  );
  return true;
}

/**
 * Kortix prompting the voice agent — the mirror of `askKortix`. Rides the
 * LiveKit room data channel (RELIABLE) rather than a new HTTP callback: the
 * worker is already paying for that connection to do STT/TTS, so this needs
 * no new transport, and unlike an HTTP POST from here TO the worker, it
 * doesn't require knowing which machine the worker process is on. Topic and
 * payload shape are fixed by apps/voice-agent's `inbound-replies.ts` — see
 * `KORTIX_REPLY_TOPIC`'s doc comment.
 *
 * Fire-and-forget, so callers (turn.ts) never block a turn on it — but it does
 * confirm a worker is actually in the room first. Nothing acks the data message,
 * so this is not a delivery receipt; it rules out the failure that actually
 * happens, which is speaking into a room whose agent has left. Without that
 * check `send_prompt` answered "Said." for prompts nobody ever heard — the worst
 * shape of failure for an agent-facing tool, because the caller has no reason to
 * doubt it.
 *
 * Takes a `KortixUtterance` (utterance.ts), never a bare string, for one
 * reason: the wire needs the INSTRUCTION and the transcript needs the PAYLOAD,
 * and a signature that only carries the instruction is a signature where
 * recording the utterance is impossible without re-deriving it from a prompt.
 * That is exactly how everything Kortix said into a call went unrecorded.
 */
export async function promptVoiceAgent(
  callId: string,
  utterance: KortixUtterance,
  opts: { projectId?: string | null } = {},
): Promise<{ delivered: boolean; reason?: string }> {
  const room = roomNameForCall(callId);
  if (!(await roomHasAgent(room))) {
    return { delivered: false, reason: 'no voice agent is connected to the call' };
  }
  await sendRoomData(room, KORTIX_REPLY_TOPIC, {
    type: 'kortix_reply',
    call_id: callId,
    text: utterance.instruction,
  });
  // Record HERE, at the moment the room is given something to hear — not when
  // the worker echoes it back. See `recordKortixUtterance`.
  await recordKortixUtterance(callId, utterance, opts.projectId ?? null);
  return { delivered: true };
}

/**
 * Writes the transcript line for something Kortix just put into the call.
 *
 * WHY SERVER-SIDE. The worker does record the agent side of the conversation,
 * from `AgentSessionEventTypes.ConversationItemAdded`
 * (apps/voice-agent/src/transcripts.ts) — but that is a client-side event in a
 * process we do not control, and it was observed NOT firing for a programmatic
 * `generateReply` when nobody else was in the room. The result was the bug this
 * exists to close: the Kortix agent called `send_prompt`, the room heard it, and
 * `voice_call_turns` had no trace of it, so the call page showed a conversation
 * with half the speakers missing. A message the room was given must not be
 * absent from the record because an event in someone else's process did not
 * fire.
 *
 * The honest caveat, stated rather than papered over: this records DELIVERY —
 * the data message reached a room that has a worker in it — not audio. If the
 * worker's session has already closed it drops the message (inbound-replies.ts)
 * and this line will claim something the room never heard. That is strictly
 * better than the alternative, which loses everything the room DID hear, and it
 * is why the two sides are labelled differently: `speaker: 'kortix'` is what
 * Kortix put into the call, the bot's own name is what the voice actually said.
 *
 * Never throws: a transcript write failing must not turn a delivered utterance
 * into a reported failure, which would make an agent re-say things the room
 * already heard.
 */
async function recordKortixUtterance(
  callId: string,
  utterance: KortixUtterance,
  projectId: string | null,
): Promise<void> {
  try {
    const resolved = projectId ?? (await projectIdForSession(callId));
    if (!resolved) {
      console.error('[voice] cannot record kortix utterance — no project for call', { callId });
      return;
    }
    await appendTurn(
      { callId, projectId: resolved, sessionId: callId },
      'agent',
      utterance.transcript,
      KORTIX_SPEAKER,
    );
  } catch (err) {
    console.error('[voice] failed to record kortix utterance', { callId, kind: utterance.kind }, err);
  }
}

/**
 * `project_id` is NOT NULL on voice_call_turns, and most callers into a live
 * call (turn.ts, answer-watch.ts) only ever hold a session id — the call id IS
 * the session id, so the project is one indexed lookup away rather than
 * something every caller has to thread through.
 */
async function projectIdForSession(sessionId: string): Promise<string | null> {
  const [row] = await db
    .select({ projectId: projectSessions.projectId })
    .from(projectSessions)
    .where(eq(projectSessions.sessionId, sessionId))
    .limit(1);
  return row?.projectId ?? null;
}
