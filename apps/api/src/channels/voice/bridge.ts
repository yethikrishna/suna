/**
 * The audio bridge — the WebSocket between the Recall-rendered page and the
 * provider session.
 *
 * The page is a dumb pipe by design: room audio up, agent audio down, nothing
 * else. It holds no provider credential and cannot prompt a session, because it
 * runs in a browser inside Recall's infrastructure with its token sitting in a
 * URL. Everything with authority stays on this side of the socket.
 *
 * Frames are raw binary PCM s16le at VOICE_SAMPLE_RATE, in both directions. No
 * envelope, no base64: the page already knows which call it is because the token
 * said so, so per-frame metadata would just be overhead on a 44.1kHz stream.
 */
import { resolveVoiceBridgeToken } from '../voice-bridge-token';
import { getCall } from './runtime';

export interface BridgeSocket {
  send(data: ArrayBufferLike | Uint8Array): void;
  close(code?: number, reason?: string): void;
}

export interface BridgeAttachResult {
  ok: boolean;
  status: number;
  error?: string;
  callId?: string;
}

/**
 * Wire a connected page socket to its call. Returns a handler for inbound audio
 * and a teardown, or an error if the token or call is not usable.
 */
export function attachBridge(
  token: string | undefined | null,
  socket: BridgeSocket,
): BridgeAttachResult & {
  onAudio?: (pcm: Buffer) => void;
  detach?: () => void;
} {
  const resolved = resolveVoiceBridgeToken(token);
  if (!resolved.ok) {
    return { ok: false, status: resolved.status, error: resolved.error };
  }

  const call = getCall(resolved.callId);
  if (!call || call.closed) {
    // The token is valid but the call is gone (ended, or this API instance does
    // not hold it). Distinct from a bad token on purpose — one is a client
    // error, the other is routing.
    return { ok: false, status: 409, error: 'call is not live on this instance' };
  }

  // Agent speech → the room.
  const toRoom = (pcm: Buffer) => {
    try {
      socket.send(pcm);
    } catch {
      // Page went away mid-frame; the close handler does the cleanup.
    }
  };
  call.sendToRoom = toRoom;

  return {
    ok: true,
    status: 200,
    callId: call.callId,
    // Room audio → the model.
    onAudio: (pcm: Buffer) => {
      if (!call.closed) call.session.pushAudio(pcm);
    },
    detach: () => {
      // Only clear if we are still the active page; a reconnect may have already
      // installed a newer sink and we must not unhook it.
      if (call.sendToRoom === toRoom) call.sendToRoom = null;
    },
  };
}
