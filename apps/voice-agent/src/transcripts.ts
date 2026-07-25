/**
 * Posts each finalized turn of the conversation back to Kortix, mirroring
 * what the old in-process `appendTurn()` wrote to `voice_call_turns`.
 *
 * `conversation_item_added` fires once per committed chat item, for both the
 * user's and the agent's side, after each is finalized into history — one
 * subscription covers both roles, and there is no separate "interim agent
 * text" event to worry about (the agent side streams via TTS/audio until the
 * turn commits). See the LiveKit API reference notes on
 * `AgentSessionEventTypes.ConversationItemAdded` for the source of this.
 */
import { voice } from '@livekit/agents';
import type { CallContext } from './call-context';
import { postTranscriptTurn } from './kortix-client';

/**
 * Content parts are NOT all plain strings. LiveKit delivers structured parts
 * (`{ type: 'text', text }`), and an earlier version only handled the string
 * case — so every real turn extracted to '', hit the empty-text guard, and was
 * silently dropped. The only rows that survived came from `session.say()`,
 * which happens to pass a raw string. Handle both shapes.
 */
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
