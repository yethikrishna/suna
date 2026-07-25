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
import { ServerOptions, cli, defineAgent, inference, voice } from '@livekit/agents';
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
      // LiveKit Inference, not the OpenAI plugin. Two reasons, both learned the
      // hard way:
      //  - It needs NO extra vendor key; the LiveKit credential covers STT.
      //  - The OpenAI STT plugin never emitted user transcription events, so
      //    UserInputTranscribed never fired and the human half of every
      //    conversation was missing from voice_call_turns while the agent was
      //    demonstrably hearing and answering. Deepgram Flux does its own
      //    endpointing and emits transcripts server-side.
      stt: new inference.STT({ model: 'deepgram/flux-general-en' }),
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

    // --- TEMP DIAGNOSTIC INSTRUMENTATION (does the agent hear anything?) ---
    // Three official per-instance Agent hooks (NOT AgentSessionEventTypes —
    // see the "never enumerate" gotcha; these are documented override points
    // on the Agent class itself, one method each, and each delegates to the
    // real default implementation so behavior is unchanged):
    //  - sttNode: taps the AudioFrame stream that RoomIO feeds INTO the STT.
    //    If this never logs a frame, remote audio is not reaching the STT
    //    stage at all (transport/subscription problem, not an STT problem).
    //  - llmNode: logs the exact chat context content the LLM is about to see,
    //    right before the real call. If sttNode gets frames but this never
    //    fires, the deaf point is STT-or-turn-detection, not the LLM.
    //  - onUserTurnCompleted: the single most authoritative signal — the SDK
    //    only calls this with a committed final transcript once its own turn
    //    detector believes the user finished speaking. This is what
    //    `session.history` / ConversationItemAdded ultimately derive from.
    const originalSttNode = agent.sttNode.bind(agent);
    agent.sttNode = async (audio, modelSettings) => {
      let frameCount = 0;
      const tapped = (async function* () {
        for await (const frame of audio as AsyncIterable<{ sampleRate: number; samplesPerChannel: number }>) {
          frameCount++;
          if (frameCount === 1) {
            console.log(
              `[voice-debug] STT_INPUT first frame sampleRate=${frame.sampleRate} samplesPerChannel=${frame.samplesPerChannel}`,
            );
          }
          if (frameCount % 100 === 0) {
            console.log(`[voice-debug] STT_INPUT frames=${frameCount}`);
          }
          yield frame;
        }
        console.log(`[voice-debug] STT_INPUT stream ended, total frames=${frameCount}`);
      })();
      return originalSttNode(tapped as typeof audio, modelSettings);
    };

    const originalLlmNode = agent.llmNode.bind(agent);
    agent.llmNode = async (chatCtx, toolCtx, modelSettings) => {
      const items = (chatCtx as { items?: readonly unknown[] }).items ?? [];
      const lastUser = [...items]
        .reverse()
        .find((i) => (i as { type?: string; role?: string }).type === 'message' && (i as { role?: string }).role === 'user');
      console.log('[voice-debug] LLM_INVOKED', {
        itemCount: items.length,
        lastUserContent: lastUser ? (lastUser as { content?: unknown }).content : null,
      });
      return originalLlmNode(chatCtx, toolCtx, modelSettings);
    };

    const originalOnUserTurnCompleted = agent.onUserTurnCompleted.bind(agent);
    agent.onUserTurnCompleted = async (chatCtx, newMessage) => {
      console.log('[voice-debug] USER_TURN_COMPLETED', { content: newMessage.content });
      return originalOnUserTurnCompleted(chatCtx, newMessage);
    };
    // --- END TEMP DIAGNOSTIC INSTRUMENTATION ---

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
