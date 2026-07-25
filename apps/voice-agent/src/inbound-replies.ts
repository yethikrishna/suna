import type { voice } from '@livekit/agents';
/**
 * The other direction: Kortix speaking INTO the call once a `send_prompt`
 * hand-off finishes. Mirrors the old in-process `promptVoiceAgent()` /
 * `call.session.say()` path, but across a process boundary this time.
 *
 * The contract this expects from apps/api (see README.md): once
 * `continueSession()` resolves for a hand-off started by `send_prompt`,
 * apps/api sends a LiveKit data message into this call's room —
 * `RoomServiceClient.sendData(roomName, utf8(JSON.stringify({ type:
 * 'kortix_reply', call_id, text })), DataPacket_Kind.RELIABLE, { topic:
 * 'kortix' })` (verified to exist: livekit-server-sdk@2.17.0's
 * `RoomServiceClient.sendData`). This worker just needs to listen for it —
 * LiveKit already delivers data messages to every participant in the room,
 * agent included, with no separate subscription step required.
 */
import { type Room, RoomEvent } from '@livekit/rtc-node';
import type { CallContext } from './call-context';

const REPLY_TOPIC = 'kortix';

interface KortixReplyPayload {
  type?: unknown;
  call_id?: unknown;
  text?: unknown;
}

function parsePayload(raw: Uint8Array): KortixReplyPayload | null {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(raw));
    return parsed && typeof parsed === 'object' ? (parsed as KortixReplyPayload) : null;
  } catch {
    return null;
  }
}

export function wireInboundReplies(
  room: Room,
  session: voice.AgentSession<CallContext>,
  ctx: CallContext,
): void {
  room.on(RoomEvent.DataReceived, (payload, _participant, _kind, topic) => {
    if (topic !== REPLY_TOPIC) return;

    const message = parsePayload(payload);
    if (!message || message.type !== 'kortix_reply') return;

    // A worker process can run many calls, but not more than one room per
    // job — this guard only matters if a stray message ever lands on the
    // wrong topic/room pairing upstream.
    if (typeof message.call_id === 'string' && message.call_id !== ctx.callId) return;

    const text = typeof message.text === 'string' ? message.text.trim() : '';
    if (!text) return;

    session.say(text);
  });
}
