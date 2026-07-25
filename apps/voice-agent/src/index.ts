/**
 * The LiveKit agent worker — the voice of a Kortix agent inside a live
 * meeting. STT -> LLM -> TTS pipeline (all OpenAI today; see the stt note) with
 * silero VAD driving turn detection, per the LiveKit agents-js 1.5.5 API
 * (see README.md for exactly how this was verified against the pinned
 * package versions rather than docs/memory).
 *
 * Run with `bun run src/index.ts dev` against a local LiveKit server — see
 * README.md.
 */
import { fileURLToPath } from 'node:url';
import { ServerOptions, type VAD, cli, defineAgent, voice } from '@livekit/agents';
import * as openai from '@livekit/agents-plugin-openai';
import * as silero from '@livekit/agents-plugin-silero';
import { type CallContext, resolveCallContext } from './call-context';
import { wireInboundReplies } from './inbound-replies';
import { buildInstructions } from './instructions';
import { buildTools } from './tools';
import { wireTranscripts } from './transcripts';

/**
 * Per-worker-process data. VAD loads an ONNX model — load it once here, not
 * per job. Typed against the core `VAD` base class, not `silero.VAD`:
 * `silero.VAD.load()` itself resolves to `Promise<VAD>` (the base class),
 * per the plugin's own `dist/vad.d.ts`.
 */
interface ProcessUserData {
  vad: VAD;
}

export default defineAgent<ProcessUserData>({
  prewarm: async (proc) => {
    proc.userData.vad = await silero.VAD.load();
  },

  entry: async (ctx) => {
    const vad = ctx.proc.userData.vad;

    // Read call identity + Kortix credentials from the room BEFORE connecting
    // — `ctx.job.room` is a snapshot of the room's server-side state at
    // dispatch time (name + metadata), available immediately, whereas
    // `ctx.room` (the live rtc-node Room) only populates those fields once
    // `ctx.connect()` has actually joined. See call-context.ts for why this
    // has to be per-job room metadata and not a process-wide env var.
    const callContext: CallContext = resolveCallContext(ctx.job.room?.name, ctx.job.room?.metadata);

    const { send_prompt, run_command } = buildTools();

    const session = new voice.AgentSession<CallContext>({
      // OpenAI STT rather than Deepgram: the whole pipeline then runs on ONE
      // credential we already hold, instead of requiring a second vendor key
      // just to say a sentence. Swap back to deepgram.STT (nova-3 is faster and
      // cheaper for high call volume) once a DEEPGRAM_API_KEY is provisioned.
      stt: new openai.STT({ model: 'gpt-4o-mini-transcribe' }),
      llm: new openai.LLM({ model: 'gpt-4.1-mini' }),
      tts: new openai.TTS({ model: 'gpt-4o-mini-tts', voice: 'alloy' }),
      vad,
      // Explicit, rather than relying on AgentSession's auto-provisioned
      // bundled inference.VAD + inference.TurnDetector: this pins the
      // standalone silero plugin loaded above and keeps turn detection local
      // instead of adding a network hop to LiveKit's inference gateway.
      turnHandling: { turnDetection: 'vad' },
      userData: callContext,
    });

    wireTranscripts(session, callContext);

    const agent = voice.Agent.create<CallContext>({
      instructions: buildInstructions(callContext.botName),
      // Array form, not an object map: both tools were created with an
      // explicit `name` (a named `FunctionTool`), and the object-map form is
      // only for anonymous tools whose name comes from the object key.
      tools: [send_prompt, run_command],
    });

    await session.start({ agent, room: ctx.room });
    await ctx.connect();

    // Only wireable once connected — needs the live rtc-node Room to listen
    // for data messages on.
    wireInboundReplies(ctx.room, session, callContext);

    session.generateReply({
      instructions:
        'Greet the room in one short, natural sentence. Do not mention tools or being an AI.',
    });
  },
});

cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url) }));
