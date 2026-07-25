'use client';

/**
 * The voice room page.
 *
 * A human opens this link directly in their own browser — `voice_spawn` mints
 * the token and hands out the URL, nothing renders it on their behalf. It used
 * to be a raw WebSocket pipe that hand-rolled PCM framing, a ring buffer and
 * reconnect logic; all of that is gone now that the room itself is a LiveKit
 * room. This page's only job is to join it: publish the mic, play whatever the
 * agent publishes back, and render a status surface. Jitter buffering,
 * packet-loss concealment, Opus encode/decode and reconnects are LiveKit's
 * problem now, not ours.
 *
 * It is deliberately dumb. The STT/LLM/TTS pipeline, the transcript, and anything
 * that can prompt a session all live server-side (the LiveKit agent worker), because
 * this code runs in a browser with its token visible in the URL. That token is a
 * room-scoped LiveKit access token and nothing else — it authorises joining one
 * room as one participant, not calling the Kortix API.
 *
 * Live-tested 2026-07-25 in a real Google Meet-adjacent call (this page open in
 * its own tab, no third-party meeting bot involved): no audible self-echo and
 * barge-in worked, with no explicit echoCancellation/noiseSuppression/
 * autoGainControl constraints set — see the plain `setMicrophoneEnabled(true)`
 * call below. If a browser/OS combination ever does produce audible self-echo,
 * this is where a half-duplex mute or explicit AEC constraints would go.
 *
 * There's no third-party UI to lean on here, so the page also draws call state
 * itself — a simple audio-level visual. It is the only diagnostic surface the
 * person on the call has, so it stays even though it's cosmetic (nothing here
 * publishes a video track into the room).
 */

import { useEffect, useRef, useState } from 'react';
import {
  ConnectionState,
  Room,
  RoomEvent,
  Track,
  type Participant,
  type RemoteTrack,
} from 'livekit-client';

type Phase = 'connecting' | 'listening' | 'speaking' | 'failed';

export default function VoiceBridgePage() {
  const [phase, setPhase] = useState<Phase>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [needsGesture, setNeedsGesture] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContainerRef = useRef<HTMLDivElement | null>(null);
  // The draw loop below (a plain interval, see the comment on it) reads room
  // state directly off this ref rather than through React state — polling avoids
  // subscribing the render tree to every audio-level tick LiveKit emits.
  const roomRef = useRef<Room | null>(null);

  useEffect(() => {
    const token = window.location.pathname.split('/').filter(Boolean).pop() ?? '';
    // The API mints the LiveKit access token AND tells us which LiveKit deployment
    // issued it, the same way it used to tell us its own base via `?api=`. Never
    // infer this from window.location or from an API base — the web origin, the
    // Kortix API and the LiveKit server are three different hosts in every real
    // deployment (and the LiveKit URL is a `ws(s)://`, not `http(s)://`, to begin
    // with).
    const livekitUrl = (
      new URLSearchParams(window.location.search).get('url') ||
      process.env.NEXT_PUBLIC_LIVEKIT_URL ||
      ''
    ).trim();

    let cancelled = false;
    let unblockListener: (() => void) | null = null;
    const room = new Room();
    roomRef.current = room;
    // Elements handed back by `track.attach()` are plain DOM nodes LiveKit does
    // not track for us — we own removing them on unmount/unsubscribe.
    const attachedEls: HTMLMediaElement[] = [];

    async function join(): Promise<void> {
      if (!token || !livekitUrl) {
        throw new Error('missing LiveKit room token or server URL');
      }

      room
        .on(RoomEvent.Connected, () => {
          if (!cancelled) setPhase('listening');
        })
        .on(RoomEvent.Reconnecting, () => {
          if (!cancelled) setPhase('connecting');
        })
        .on(RoomEvent.Reconnected, () => {
          if (!cancelled) setPhase('listening');
        })
        .on(RoomEvent.Disconnected, () => {
          if (cancelled) return;
          setPhase('failed');
          setError('lost connection to Kortix');
        })
        // LiveKit already computes per-participant speech activity for us on
        // every audio-level tick — no hand-rolled peak meter over raw samples
        // needed, unlike the old bridge's capture worklet.
        .on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
          if (cancelled || room.state !== ConnectionState.Connected) return;
          const agentTalking = speakers.some((p) => p.identity !== room.localParticipant.identity);
          setPhase(agentTalking ? 'speaking' : 'listening');
        })
        // Output Media just needs a real <audio>/<video> element playing in the
        // DOM to produce sound. `track.attach()` gives us that element with
        // LiveKit's jitter buffer, PLC and Opus decode already wired behind it —
        // there is nothing left here for us to buffer or schedule by hand.
        .on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
          if (track.kind !== Track.Kind.Audio) return;
          const el = track.attach();
          el.style.display = 'none';
          audioContainerRef.current?.appendChild(el);
          attachedEls.push(el);
        })
        .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
          for (const el of track.detach()) el.remove();
        });

      room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
        // Browsers refuse programmatic audio until a user gesture. Without this
        // the agent speaks, LiveKit delivers it, and the page plays NOTHING —
        // which looks exactly like a dead agent. Surface it instead of hiding it.
        if (!cancelled) setNeedsGesture(!room.canPlaybackAudio);
      });

      await room.connect(livekitUrl, token);

      // Succeeds outright in some browsers; most need the click handler below
      // (autoplay policies block programmatic audio until a user gesture).
      try {
        await room.startAudio();
      } catch {
        if (!cancelled) setNeedsGesture(true);
      }
      const unblock = () => {
        void room.startAudio().then(() => !cancelled && setNeedsGesture(false)).catch(() => {});
      };
      window.addEventListener('click', unblock);
      window.addEventListener('keydown', unblock);
      unblockListener = unblock;
      // No echoCancellation/noiseSuppression/autoGainControl flags to fight with
      // here — LiveKit's default capture settings are what its own client-side
      // processing expects, and live-testing (see file header) found no audible
      // self-echo to cancel in the first place.
      await room.localParticipant.setMicrophoneEnabled(true);
    }

    join().catch((e) => {
      if (cancelled) return;
      setPhase('failed');
      setError(e instanceof Error ? e.message : String(e));
    });

    return () => {
      cancelled = true;
      if (unblockListener) {
        window.removeEventListener('click', unblockListener);
        window.removeEventListener('keydown', unblockListener);
      }
      for (const el of attachedEls) el.remove();
      void room.disconnect();
      roomRef.current = null;
    };
  }, []);

  // The audio-level visual — a purely cosmetic canvas, not a published video
  // track. Draw on a plain interval, NEVER requestAnimationFrame: a 60fps
  // gradient competed with audio on the main thread and was one of the causes
  // of choppy audio in an earlier version of this page.
  useEffect(() => {
    const canvas = canvasRef.current;
    const c = canvas?.getContext('2d');
    if (!canvas || !c) return;
    const draw = () => {
      c.clearRect(0, 0, canvas.width, canvas.height);
      // Read the live audio level straight off whichever participant is talking
      // right now — LiveKit already tracks this per-participant, so there's
      // nothing to compute ourselves.
      const room = roomRef.current;
      let level = 0;
      if (room) {
        const speaker =
          phase === 'speaking'
            ? Array.from(room.remoteParticipants.values()).find((p) => p.isSpeaking)
            : room.localParticipant;
        level = speaker?.audioLevel ?? 0;
      }
      const r = 60 + level * 260;
      const grad = c.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        0,
        canvas.width / 2,
        canvas.height / 2,
        Math.max(r, 1),
      );
      const hue = phase === 'speaking' ? '#34d399' : phase === 'failed' ? '#f87171' : '#60a5fa';
      grad.addColorStop(0, hue);
      grad.addColorStop(1, 'transparent');
      c.fillStyle = grad;
      c.beginPath();
      c.arc(canvas.width / 2, canvas.height / 2, Math.max(r, 1), 0, Math.PI * 2);
      c.fill();
    };
    // 10fps is indistinguishable to the eye here and leaves the main thread
    // alone for audio.
    const timer = setInterval(draw, 100);
    draw();
    return () => clearInterval(timer);
  }, [phase]);

  // A blocked-autoplay page looks identical to a dead agent: it says
  // 'listening' forever while speech it already received goes unplayed.
  const label =
    needsGesture
      ? 'click anywhere to enable audio'
      : phase === 'speaking'
      ? 'speaking'
      : phase === 'listening'
        ? 'listening'
        : phase === 'failed'
          ? 'voice unavailable'
          : 'connecting…';

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black">
      <canvas ref={canvasRef} width={1280} height={720} className="absolute inset-0 h-full w-full" />
      {/* Remote audio plays through elements parked here — invisible, audio-only. */}
      <div ref={audioContainerRef} style={{ display: 'none' }} />
      <div className="relative flex flex-col items-center gap-4">
        <div className="font-mono text-6xl font-bold tracking-tight text-white">Kortix</div>
        <div className="font-mono text-3xl text-neutral-300">{label}</div>
        {error && <div className="max-w-2xl text-center font-mono text-xl text-red-400">{error}</div>}
      </div>
    </div>
  );
}
