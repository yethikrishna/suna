/**
 * The voice runtime — where a live call actually lives.
 *
 * A call IS a LiveKit room — there is no call record anywhere. The room carries
 * the actual audio (browser mic <-> the /voice/[token] page <-> the
 * apps/voice-agent worker doing STT/LLM/TTS); this file never touches audio.
 * What it owns is the two hand-offs either side of that conversation:
 *
 *   worker ──POST /voice/prompt──► askKortix ──► continueSession   (send_prompt)
 *   Kortix turn ──► promptVoiceAgent ──► room data channel ──► worker  (say)
 *
 * The worker is a SEPARATE PROCESS (apps/voice-agent, not part of apps/api),
 * dispatched into the room by name and bootstrapped entirely from the room's
 * metadata — see `VoiceRoomMetadata` below and apps/voice-agent/README.md's
 * "The apps/api contract this app expects", which this file (plus routes.ts's
 * `/voice/{prompt,run-command,turns}` routes) implements.
 *
 * The single most important property, unchanged from the realtime-provider
 * version this replaces: `askKortix` (the old `ask_kortix`, now the worker's
 * `send_prompt` tool) answers in milliseconds and NEVER waits for the agent
 * turn. A Kortix turn runs 30s-10min; a conversation that blocks that long is
 * broken. The answer comes back later as unsolicited speech, driven by
 * answer-watch.ts — see its header for why the API watches for the answer
 * instead of the sandbox relaying it.
 *
 * NOTHING here is kept in memory. A call's identity is its session id, its room
 * name derives from that, its liveness is whatever LiveKit says right now, and
 * its transcript is in Postgres. That is what makes the worker's `/voice/*`
 * callbacks work regardless of which API instance they land on — they used to
 * have to hit the one process that happened to run `voice_spawn`.
 */
import { and, asc, eq, gt } from 'drizzle-orm';
import { voiceCallTurns } from '@kortix/db';
import { continueSession } from '../../projects/session-lifecycle';
import { config } from '../../config';
import { db } from '../../shared/db';
import {
  createRoom,
  deleteRoom,
  KORTIX_REPLY_TOPIC,
  roomHasAgent,
  roomNameForCall,
  sendRoomData,
} from './livekit';
import { speakAnswerWhenReady } from './answer-watch';
import { mintCallApiToken } from './worker-token';

/**
 * apps/voice-agent's TTS is hardcoded to `openai.TTS({ voice: 'alloy' })`
 * today (it does not yet read a voice choice from room metadata) — this list
 * exists for the MCP tool's UX (voice_spawn's `voice` enum) ahead of that
 * wiring, not because anything downstream currently honors it.
 */
const VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'] as const;
const DEFAULT_VOICE: (typeof VOICES)[number] = 'alloy';

export function availableVoices(): { voices: readonly string[]; default: string } {
  return { voices: VOICES, default: DEFAULT_VOICE };
}

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

  // Already staffed → reuse. Otherwise (re)build the room and dispatch a worker.
  // Liveness is asked of LiveKit rather than remembered, so a second
  // `voice_spawn` in the same session can no longer hand back a link to a room
  // the worker left — which it did every time, since callId IS the session id.
  if (await roomHasAgent(room)) return call;

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

function buildAskPrompt(request: string, callId: string): string {
  return [
    `[Live voice call ${callId}] Someone in the call asked: "${request}"`,
    '',
    'You are on a live call. Whatever you report back gets spoken aloud to the room,',
    'so answer in plain spoken language — no markdown, no bullet lists, no raw URLs.',
    'Keep it to a couple of sentences unless more was explicitly asked for.',
    '',
    'The conversation continues while you work; you are not holding the line.',
  ].join('\n');
}

/**
 * The mirror of the old `ask_kortix` tool-call handler, now driven by the
 * worker's `POST /voice/prompt` (routes.ts) instead of an in-process SDK
 * callback. Answers FIRST, then delivers — the caller (the HTTP route)
 * returns immediately after this resolves, well before `continueSession` has
 * done anything at all.
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
          "I couldn't reach the agent session just now, so that request didn't go through.",
        );
      }
    })
    .catch((err) => console.error('[voice] ask_kortix delivery failed', err));

  return { ok: true };
}

export async function appendTurn(
  call: Pick<VoiceCall, 'callId' | 'projectId' | 'sessionId'>,
  role: 'user' | 'agent',
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
 */
export async function promptVoiceAgent(
  callId: string,
  text: string,
): Promise<{ delivered: boolean; reason?: string }> {
  const room = roomNameForCall(callId);
  if (!(await roomHasAgent(room))) {
    return { delivered: false, reason: 'no voice agent is connected to the call' };
  }
  await sendRoomData(room, KORTIX_REPLY_TOPIC, { type: 'kortix_reply', call_id: callId, text });
  return { delivered: true };
}
