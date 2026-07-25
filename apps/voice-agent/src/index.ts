/**
 * The LiveKit agent worker — the voice of a Kortix agent inside a live
 * meeting. STT -> LLM -> TTS pipeline (all OpenAI today; see the stt note) with
 * hosted turn detection, per the LiveKit agents-js 1.5.5 API
 * (see README.md for exactly how this was verified against the pinned
 * package versions rather than docs/memory).
 *
 * Run with `bun run src/index.ts dev` against a local LiveKit server — see
 * README.md.
 */
import { fileURLToPath } from 'node:url';
import { ServerOptions, type VAD, cli, defineAgent, voice } from '@livekit/agents';
import * as openai from '@livekit/agents-plugin-openai';
import { type CallContext, resolveCallContext } from './call-context';
import { wireInboundReplies } from './inbound-replies';
import { buildInstructions } from './instructions';
import { buildTools } from './tools';
import { wireTranscripts } from './transcripts';

// No prewarm: there is no local model to load any more. Turn detection is
// hosted (see the AgentSession comment below), so nothing here has to keep up
// with realtime audio on whatever host the worker happens to land on.

export default defineAgent({
  entry: async (ctx) => {

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
      // Turn detection is LiveKit's hosted VAD + TurnDetector, NOT a local
      // silero plugin. Running silero in-process was the original choice — one
      // less network hop — but its inference has to keep up with realtime, and
      // on a busy host it simply does not: 152 "VAD inference slower than
      // realtime" warnings and, more damningly, userTurnCompleted stayed at 0
      // across every run. The agent never heard a single word, while still
      // greeting on join, so it looked alive the whole time.
      //
      // A hosted detector cannot be starved by whatever else the machine is
      // doing, which matters far more here than saving a round trip.
      // AgentSession auto-provisions it when no vad/turnDetection is pinned.
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
