/**
 * xAI Grok Voice Agent adapter (`wss://api.x.ai/v1/realtime`).
 *
 * The WebSocket lives here, server-side, rather than in the browser page Recall
 * renders. That page runs in third-party infrastructure we do not control, and
 * measured ~3.3s to reach api.x.ai from inside it versus ~0.5s from a normal
 * host. Keeping the socket here also means the API key never leaves our process
 * and reconnects are ours to drive.
 *
 * Protocol notes that are easy to get wrong:
 *  - xAI renamed OpenAI's input-transcription event and changed its semantics:
 *    `conversation.item.input_audio_transcription.updated` carries the CUMULATIVE
 *    transcript, not a delta. Treating it as a delta duplicates every syllable.
 *  - Audio rides as base64 in JSON by default. We use it rather than the binary
 *    transport because it keeps one ordered stream for audio and control events;
 *    at 24kHz mono the overhead is not what costs us latency.
 */
import { config } from '../../../config';
import type {
  PcmFrame,
  VoiceProvider,
  VoiceSession,
  VoiceSessionOpts,
  VoiceToolCall,
  VoiceTranscriptTurn,
} from '../provider';

const MODEL = 'grok-voice-latest';
const VOICES = ['eve', 'ara', 'rex', 'sal', 'leo'] as const;

/**
 * Turn detection. Kept at xAI's documented default rather than tuned down:
 * Gate 0 showed Recall does not feed the bot its own audio, so we do not need a
 * conservative threshold to avoid self-interruption, but a lower one would make
 * the agent trip over background noise in a room full of people.
 */
const TURN_DETECTION = {
  type: 'server_vad',
  threshold: 0.85,
  prefix_padding_ms: 333,
  silence_duration_ms: 600,
} as const;

interface GrokEvent {
  type: string;
  [key: string]: unknown;
}

class GrokVoiceSession implements VoiceSession {
  private ws: WebSocket;
  private audioCbs: Array<(pcm: PcmFrame) => void> = [];
  private transcriptCbs: Array<(t: VoiceTranscriptTurn) => void> = [];
  private toolCbs: Array<(c: VoiceToolCall) => void> = [];
  private closeCbs: Array<(i: { code: number; reason: string }) => void> = [];
  private interruptCbs: Array<() => void> = [];
  /** Last cumulative user transcript, so we can emit only what is new. */
  private lastUserTranscript = '';
  private agentTextBuffer = '';
  conversationId: string | null = null;

  constructor(ws: WebSocket, private readonly opts: VoiceSessionOpts) {
    this.ws = ws;
    ws.addEventListener('message', (ev) => this.onMessage(ev));
    ws.addEventListener('close', (ev) => {
      for (const cb of this.closeCbs) cb({ code: ev.code, reason: ev.reason });
    });
  }

  private send(payload: Record<string, unknown>): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(payload));
  }

  configure(): void {
    // Deliberately minimal. An earlier version also sent `audio` (format +
    // sample rate), `reasoning`, and `resumption`; the server rejected the whole
    // event with "8 validation errors" and SILENTLY fell back to defaults — no
    // voice, no instructions, and critically no tools, so ask_kortix did not
    // exist. A rejected session.update is not partially applied.
    //
    // The audio block is not needed anyway: the provider's default is PCM at
    // VOICE_SAMPLE_RATE, which is exactly what the bridge sends.
    this.send({
      type: 'session.update',
      session: {
        voice: this.opts.voice,
        instructions: this.opts.instructions,
        turn_detection: TURN_DETECTION,
        tools: this.opts.tools.map((t) => ({
          type: 'function',
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        })),
      },
    });
  }

  private onMessage(ev: MessageEvent): void {
    let e: GrokEvent;
    try {
      e = JSON.parse(typeof ev.data === 'string' ? ev.data : '') as GrokEvent;
    } catch {
      return; // non-JSON frame; nothing actionable
    }

    // A rejected session.update is silent otherwise: the socket stays open and
    // the model answers on defaults, so it looks like it works while having no
    // tools and no instructions. Always surface it.
    if (e.type === 'error') {
      console.error(`[voice] provider rejected an event: ${JSON.stringify(e).slice(0, 1500)}`);
    } else if (process.env.VOICE_DEBUG) {
      console.log(`  [grok] ${e.type}`);
    }
    if (e.type === 'session.updated') console.log('[voice] session config accepted');

    switch (e.type) {
      case 'conversation.created': {
        const conv = e.conversation as { id?: string } | undefined;
        this.conversationId = conv?.id ?? null;
        break;
      }

      case 'input_audio_buffer.speech_started': {
        // Barge-in. Anything already queued downstream is stale — if it is not
        // dropped, playback runs behind by the length of the abandoned reply and
        // the delay compounds with every interruption.
        for (const cb of this.interruptCbs) cb();
        break;
      }

      case 'response.output_audio.delta': {
        const b64 = typeof e.delta === 'string' ? e.delta : '';
        if (b64) {
          const pcm = Buffer.from(b64, 'base64');
          for (const cb of this.audioCbs) cb(pcm);
        }
        break;
      }

      case 'conversation.item.input_audio_transcription.updated': {
        // CUMULATIVE, not a delta (xAI diverges from OpenAI here). Emit the
        // suffix so downstream sees each word once.
        const full = typeof e.transcript === 'string' ? e.transcript : '';
        if (full.startsWith(this.lastUserTranscript)) {
          const delta = full.slice(this.lastUserTranscript.length).trim();
          if (delta) this.emitTranscript({ role: 'user', text: delta, final: false });
        } else if (full) {
          this.emitTranscript({ role: 'user', text: full, final: false });
        }
        this.lastUserTranscript = full;
        break;
      }

      case 'conversation.item.input_audio_transcription.completed': {
        const full = typeof e.transcript === 'string' ? e.transcript : this.lastUserTranscript;
        if (full.trim()) this.emitTranscript({ role: 'user', text: full.trim(), final: true });
        this.lastUserTranscript = '';
        break;
      }

      case 'response.text.delta':
      case 'response.output_audio_transcript.delta': {
        // Spoken output arrives as an audio-transcript delta, not a text delta —
        // listening only for the latter left every agent turn blank.
        if (typeof e.delta === 'string') this.agentTextBuffer += e.delta;
        break;
      }

      case 'response.done': {
        const text = this.agentTextBuffer.trim();
        this.agentTextBuffer = '';
        if (text) this.emitTranscript({ role: 'agent', text, final: true });
        break;
      }

      case 'response.function_call_arguments.done': {
        const name = typeof e.name === 'string' ? e.name : '';
        const callId = typeof e.call_id === 'string' ? e.call_id : '';
        if (!name || !callId) break;
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(typeof e.arguments === 'string' ? e.arguments : '{}');
        } catch {
          // Malformed arguments still deserve a tool response, or the model
          // waits forever on a call it believes is in flight.
        }
        for (const cb of this.toolCbs) cb({ name, args, callId });
        break;
      }
    }
  }

  private emitTranscript(turn: VoiceTranscriptTurn): void {
    for (const cb of this.transcriptCbs) cb(turn);
  }

  pushAudio(pcm: PcmFrame): void {
    this.send({ type: 'input_audio_buffer.append', audio: pcm.toString('base64') });
  }

  say(text: string): void {
    // An unsolicited assistant turn, not a tool result: this is Kortix reaching
    // into a conversation it is not otherwise part of.
    this.send({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'system',
        content: [{ type: 'input_text', text }],
      },
    });
    this.send({ type: 'response.create' });
  }

  respondToTool(callId: string, output: unknown): void {
    this.send({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output: typeof output === 'string' ? output : JSON.stringify(output),
      },
    });
    this.send({ type: 'response.create' });
  }

  onAudio(cb: (pcm: PcmFrame) => void): void {
    this.audioCbs.push(cb);
  }
  onTranscript(cb: (t: VoiceTranscriptTurn) => void): void {
    this.transcriptCbs.push(cb);
  }
  onToolCall(cb: (c: VoiceToolCall) => void): void {
    this.toolCbs.push(cb);
  }
  onInterrupt(cb: () => void): void {
    this.interruptCbs.push(cb);
  }
  onClose(cb: (i: { code: number; reason: string }) => void): void {
    this.closeCbs.push(cb);
  }

  async close(): Promise<void> {
    try {
      this.ws.close();
    } catch {
      // already gone
    }
  }
}

export const grokVoiceProvider: VoiceProvider = {
  id: 'grok',
  voices: VOICES,
  defaultVoice: 'eve',

  async connect(opts: VoiceSessionOpts): Promise<VoiceSession> {
    if (!config.XAI_API_KEY) {
      throw new Error('XAI_API_KEY is not configured — the voice channel cannot start a call.');
    }

    const url = new URL('/v1/realtime', config.XAI_API_URL.replace(/^http/, 'ws'));
    url.searchParams.set('model', MODEL);
    if (opts.resumeFrom) url.searchParams.set('conversation_id', opts.resumeFrom);

    const ws = new WebSocket(url.toString(), {
      headers: { Authorization: `Bearer ${config.XAI_API_KEY}` },
    } as unknown as string[]);

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('voice provider connect timed out')), 15_000);
      ws.addEventListener('open', () => {
        clearTimeout(timer);
        resolve();
      });
      ws.addEventListener('error', () => {
        clearTimeout(timer);
        reject(new Error('voice provider connection failed'));
      });
    });

    const session = new GrokVoiceSession(ws, opts);
    session.configure();
    return session;
  },
};
