/**
 * The realtime voice provider seam.
 *
 * Everything above this interface is provider-agnostic on purpose. Grok is the
 * first adapter, not the architecture: the realtime-voice field moves fast, the
 * models differ mainly in latency/reasoning/price rather than in shape, and we
 * want to swap or A/B the "voice seat" without touching the MCP, the transcript,
 * or the audio bridge.
 *
 * Two things are deliberately NOT in this interface:
 *
 *  - Anything about Recall or meetings. A provider knows about audio frames and
 *    turns; it has no idea where the audio came from.
 *  - Blocking calls. `ask` returns immediately and results arrive out of band,
 *    because a Kortix turn takes 30s-10min and a live conversation cannot wait.
 */

/** PCM s16le. Sample rate is fixed per session by `VoiceSessionOpts.sampleRate`. */
export type PcmFrame = Buffer;

export interface VoiceToolCall {
  name: string;
  args: Record<string, unknown>;
  callId: string;
}

export interface VoiceTranscriptTurn {
  role: 'user' | 'agent';
  text: string;
  /** False for interim/partial results — only final turns are persisted. */
  final: boolean;
}

export interface VoiceToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface VoiceSessionOpts {
  /** Provider voice id. Free-form: validated by the provider, not by us. */
  voice: string;
  instructions: string;
  tools: VoiceToolSpec[];
  /** Audio sample rate for BOTH directions, in Hz. */
  sampleRate: number;
  /** Resume a prior conversation after a reconnect, when the provider supports it. */
  resumeFrom?: string | null;
}

export interface VoiceSession {
  /** Provider-side conversation id, for resumption. Null until the session is up. */
  readonly conversationId: string | null;

  /** Feed captured room audio to the model. */
  pushAudio(pcm: PcmFrame): void;

  /** Speak something unprompted — how Kortix reaches into a live conversation. */
  say(text: string): void;

  /** Answer a tool call the model made. */
  respondToTool(callId: string, output: unknown): void;

  onAudio(cb: (pcm: PcmFrame) => void): void;
  onTranscript(cb: (turn: VoiceTranscriptTurn) => void): void;
  onToolCall(cb: (call: VoiceToolCall) => void): void;
  onClose(cb: (info: { code: number; reason: string }) => void): void;

  close(): Promise<void>;
}

export interface VoiceProvider {
  readonly id: string;
  /** Voice ids this provider accepts, for validation and for surfacing choices. */
  readonly voices: readonly string[];
  readonly defaultVoice: string;
  connect(opts: VoiceSessionOpts): Promise<VoiceSession>;
}
