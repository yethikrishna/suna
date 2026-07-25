/**
 * Posts each finalized turn of the conversation back to Kortix, mirroring
 * what the old in-process `appendTurn()` wrote to `voice_call_turns`.
 *
 * `conversation_item_added` fires once per committed chat item, for both the
 * user's and the agent's side, after each is finalized into history — one
 * subscription covers both roles, and there is no separate "interim agent
 * text" event to worry about (the agent side streams via TTS/audio until the
 * turn commits).
 *
 * VERIFIED against @livekit/agents@1.5.5's own source (not docs/memory —
 * see node_modules/.pnpm/@livekit+agents@1.5.5.../src/voice/agent_activity.ts):
 * for the STT->LLM->TTS pipeline this worker uses (not a RealtimeModel),
 * `AgentActivity.pipelineReplyTask` calls
 * `this.agentSession._conversationItemAdded(newMessage)` for the USER's
 * ChatMessage (role: 'user', content: the STT transcript) right alongside
 * the equivalent call for the assistant's reply — both roles go through the
 * exact same event, confirmed live by instrumenting every AgentSessionEventTypes
 * member during a real call: a `conversation_item_added` role:'user' item is
 * what a committed user turn looks like on the wire, there is no separate
 * event to wire up for it.
 *
 * `item.content`'s type (`ChatContent = ImageContent | AudioContent |
 * Instructions | string`, per llm/chat_context.ts) never actually includes a
 * `{ type: 'text', text }` object for either role in this SDK version — every
 * `ChatMessage.create()` call site in agent_activity.ts passes a plain
 * string, which the constructor wraps as `[string]`. That object shape only
 * exists internally in llm/provider_format/openai.ts, for building the wire
 * request to the OpenAI API — it never appears in a ConversationItemAdded
 * item. `extractText`'s object-part branch below is therefore not what makes
 * user turns land; it's a harmless no-op guard kept in case a future SDK
 * version (or a different LLM provider's content parts) changes that.
 */
import { voice } from '@livekit/agents';
import type { CallContext } from './call-context';
import { postTranscriptTurn } from './kortix-client';

function extractText(content: readonly unknown[]): string {
  return content
    .map((part) => {
      if (typeof part === 'string') return part;
      if (part && typeof part === 'object') {
        const t = (part as { text?: unknown }).text;
        if (typeof t === 'string') return t;
      }
      return '';
    })
    .join('')
    .trim();
}

export function wireTranscripts(session: voice.AgentSession<CallContext>, ctx: CallContext): void {
  session.on(voice.AgentSessionEventTypes.ConversationItemAdded, (ev) => {
    const item = ev.item;
    if (item.type !== 'message') return; // skip agent-handoff items — no such thing here anyway

    const role = item.role === 'user' ? 'user' : item.role === 'assistant' ? 'agent' : null;
    if (!role) return; // system/developer messages are not part of the spoken transcript

    const text = extractText(item.content);
    if (!text) return;

    // Fire-and-forget: a transcript write must never delay or interrupt the
    // live conversation (see kortix-client.ts's postTranscriptTurn doc).
    void postTranscriptTurn(ctx, role, text);
  });
}
