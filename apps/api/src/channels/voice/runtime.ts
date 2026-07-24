/**
 * The voice runtime — where a live call actually lives.
 *
 * Holds one provider session per call, in process, and wires the two systems
 * together:
 *
 *   room audio ──► provider ──► room audio        (the conversation)
 *                     │
 *                     ├── transcript ──► voice_call_turns   (both sides read it)
 *                     └── ask_kortix  ──► continueSession   (fire-and-forget)
 *
 * The single most important property: `ask_kortix` answers the model in
 * milliseconds and NEVER waits for the agent turn. A Kortix turn runs 30s-10min;
 * a conversation that blocks that long is broken. Progress comes back later as
 * unsolicited speech via `say()`, driven by the turn-relay.
 *
 * State is per-process and deliberately not in Postgres: a call is pinned to
 * whichever API instance holds its WebSocket, and if that instance dies the call
 * is over anyway. Only the transcript is durable.
 */
import { and, asc, eq, gt } from 'drizzle-orm';
import { voiceCallTurns } from '@kortix/db';
import { continueSession } from '../../projects/session-lifecycle';
import { db } from '../../shared/db';
import { grokVoiceProvider } from './providers/grok';
import type { VoiceProvider, VoiceSession, VoiceToolCall } from './provider';

/**
 * 24kHz — the realtime provider's native/default rate. Recall's page context
 * happens to run at 44.1kHz, but the browser resamples for us when the
 * AudioContext is constructed at this rate, and matching the provider's default
 * means we never depend on getting a rate-negotiation field exactly right.
 */
export const VOICE_SAMPLE_RATE = 24_000;

const provider: VoiceProvider = grokVoiceProvider;

export interface VoiceCall {
  callId: string;
  projectId: string;
  sessionId: string;
  botId: string | null;
  voice: string;
  session: VoiceSession;
  startedAt: number;
  /** Set when the audio bridge page is connected; audio is dropped until then. */
  sendToRoom: ((pcm: Buffer) => void) | null;
  /** Tells the page to drop queued playback after a barge-in. */
  interruptRoom: (() => void) | null;
  closed: boolean;
}

const calls = new Map<string, VoiceCall>();

export function getCall(callId: string): VoiceCall | undefined {
  return calls.get(callId);
}

export function listCallsForSession(sessionId: string): VoiceCall[] {
  return [...calls.values()].filter((c) => c.sessionId === sessionId && !c.closed);
}

export function availableVoices(): { voices: readonly string[]; default: string } {
  return { voices: provider.voices, default: provider.defaultVoice };
}

function buildInstructions(botName: string): string {
  return [
    `You are ${botName}, a participant in a live meeting. You are the voice of a Kortix agent`,
    'that has real tools, memory of this project, and the ability to take real actions.',
    '',
    'How to talk:',
    '- Short spoken sentences. This is a conversation, not a document.',
    '- Never read markdown, URLs, file paths, or code aloud. If the answer contains one,',
    '  say so out loud and call post_meeting_chat to drop the text into the chat.',
    '- Only speak when addressed or when a turn genuinely calls for it. Do not narrate.',
    '',
    'When to hand off:',
    '- For anything needing real information, project files, connectors, or actions,',
    '  call ask_kortix. You do NOT have access to any of that yourself, and guessing',
    '  is worse than delegating.',
    '- ask_kortix is ASYNCHRONOUS and can take minutes. The moment you call it, say so',
    '  briefly ("let me check that") and then stop talking. Do not invent an answer',
    '  while you wait. Progress and results arrive as system messages — speak each one',
    '  naturally, in your own words, when it arrives.',
    '- Small talk, greetings, and clarifying what someone meant do not need ask_kortix.',
  ].join('\n');
}

const TOOLS = [
  {
    name: 'ask_kortix',
    description:
      'Hand a request to the Kortix agent for this project. Use for anything needing real information, project files, connectors, or actions. Asynchronous: returns immediately, results arrive later as system messages you should speak.',
    parameters: {
      type: 'object',
      properties: {
        request: {
          type: 'string',
          description: "What was asked, in the speaker's own words, plus who asked it.",
        },
      },
      required: ['request'],
    },
  },
  {
    name: 'post_meeting_chat',
    description:
      'Post text into the meeting chat. Use for links, code, or file paths that should not be read aloud. Always say out loud that you are doing it.',
    parameters: {
      type: 'object',
      properties: { message: { type: 'string' } },
      required: ['message'],
    },
  },
];

export interface StartCallInput {
  callId: string;
  projectId: string;
  sessionId: string;
  botId: string | null;
  botName: string;
  voice?: string | null;
  /** Posts a message into the meeting chat; supplied by the caller so the runtime
   *  stays free of any Recall coupling. */
  postChat?: (message: string) => Promise<void>;
}

export async function startCall(input: StartCallInput): Promise<VoiceCall> {
  const existing = calls.get(input.callId);
  if (existing && !existing.closed) return existing;

  const voice =
    input.voice && provider.voices.includes(input.voice) ? input.voice : provider.defaultVoice;

  const session = await provider.connect({
    voice,
    instructions: buildInstructions(input.botName),
    tools: TOOLS,
    sampleRate: VOICE_SAMPLE_RATE,
  });

  const call: VoiceCall = {
    callId: input.callId,
    projectId: input.projectId,
    sessionId: input.sessionId,
    botId: input.botId,
    voice,
    session,
    startedAt: Date.now(),
    sendToRoom: null,
    interruptRoom: null,
    closed: false,
  };
  calls.set(input.callId, call);

  session.onAudio((pcm) => {
    // Before the bridge page connects there is nowhere to put audio. Dropping is
    // correct — buffering would replay stale speech into the room on connect.
    call.sendToRoom?.(pcm);
  });

  session.onInterrupt(() => call.interruptRoom?.());

  session.onTranscript((turn) => {
    if (!turn.final) return; // only final turns are worth persisting
    void appendTurn(call, turn.role, turn.text).catch((err) =>
      console.error('[voice] transcript write failed', err),
    );
  });

  session.onToolCall((toolCall) => {
    void handleToolCall(call, toolCall, input.postChat).catch((err) => {
      console.error('[voice] tool call failed', err);
      // Always answer, even on failure: an unanswered call leaves the model
      // believing work is still in flight, and it will wait instead of talking.
      call.session.respondToTool(toolCall.callId, { error: 'internal error' });
    });
  });

  session.onClose(() => {
    call.closed = true;
  });

  return call;
}

async function handleToolCall(
  call: VoiceCall,
  toolCall: VoiceToolCall,
  postChat?: (message: string) => Promise<void>,
): Promise<void> {
  if (toolCall.name === 'ask_kortix') {
    const request = String(toolCall.args.request ?? '').trim();
    if (!request) {
      call.session.respondToTool(toolCall.callId, { error: 'empty request' });
      return;
    }

    // Answer FIRST, then deliver. The model must never wait on an agent turn.
    call.session.respondToTool(toolCall.callId, { status: 'started' });

    void continueSession({
      source: 'voice',
      sessionId: call.sessionId,
      text: buildAskPrompt(request, call.callId),
      userId: null,
    })
      .then((outcome) => {
        if (outcome !== 'delivered') {
          console.error('[voice] ask_kortix not delivered', { outcome, sessionId: call.sessionId });
          // The conversation would otherwise hang on a promise nobody kept.
          call.session.say(
            "I couldn't reach the agent session just now, so that request didn't go through.",
          );
        }
      })
      .catch((err) => console.error('[voice] ask_kortix delivery failed', err));
    return;
  }

  if (toolCall.name === 'post_meeting_chat') {
    const message = String(toolCall.args.message ?? '').trim();
    if (!message || !postChat) {
      call.session.respondToTool(toolCall.callId, { error: 'chat unavailable' });
      return;
    }
    await postChat(message);
    call.session.respondToTool(toolCall.callId, { status: 'posted' });
    return;
  }

  call.session.respondToTool(toolCall.callId, { error: `unknown tool ${toolCall.name}` });
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
  const call = calls.get(callId);
  if (!call) return false;
  call.closed = true;
  await call.session.close();
  calls.delete(callId);
  return true;
}

/** Kortix prompting the voice agent — the mirror of ask_kortix. */
export function promptVoiceAgent(callId: string, text: string): boolean {
  const call = calls.get(callId);
  if (!call || call.closed) return false;
  call.session.say(text);
  return true;
}
