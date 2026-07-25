'use client';

/**
 * The voice room page.
 *
 * A human opens this link directly in their own browser — `voice_spawn` mints
 * the token and hands out the URL, nothing renders it on their behalf. It used
 * to be a raw WebSocket pipe that hand-rolled PCM framing, a ring buffer and
 * reconnect logic; all of that is gone now that the room itself is a LiveKit
 * room. This page's only job is to join it: publish the mic, play whatever the
 * agent publishes back, and render the call — live transcript, who's in the
 * room, who's talking, and real controls. Jitter buffering, packet-loss
 * concealment, Opus encode/decode and reconnects are LiveKit's problem now,
 * not ours.
 *
 * The STT/LLM/TTS pipeline lives server-side (the LiveKit agent worker); this
 * page only *subscribes* to what it publishes — the transcription stream and
 * the audio track — because this code runs in a browser with its token
 * visible in the URL. That token is a room-scoped LiveKit access token and
 * nothing else — it authorises joining one room as one participant, not
 * calling the Kortix API.
 *
 * Live-tested 2026-07-25 in a real Google Meet-adjacent call (this page open in
 * its own tab, no third-party meeting bot involved): no audible self-echo and
 * barge-in worked, with no explicit echoCancellation/noiseSuppression/
 * autoGainControl constraints set — see the plain `setMicrophoneEnabled(true)`
 * call below. If a browser/OS combination ever does produce audible self-echo,
 * this is where a half-duplex mute or explicit AEC constraints would go.
 *
 * Audio only — the agent never publishes a video track, so this page never
 * renders one either. Presence is shown as avatar tiles, not blank camera
 * rects standing in for a video call that isn't happening.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ConnectionState,
  DisconnectReason,
  Room,
  RoomEvent,
  Track,
  type Participant,
  type RemoteTrack,
  type TranscriptionSegment,
} from 'livekit-client';

import { AudioGestureOverlay, ConnectingScreen, EndedScreen, ReconnectingBanner } from './_components/connection-states';
import { CallControls } from './_components/call-controls';
import { PresenceRail } from './_components/presence-rail';
import { RoomHeader } from './_components/room-header';
import { TranscriptFeed } from './_components/transcript-feed';
import type { ConnectionPhase, PresenceEntry, TranscriptEntry } from './_components/types';

export default function VoiceBridgePage() {
  const [phase, setPhase] = useState<ConnectionPhase>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [roster, setRoster] = useState<PresenceEntry[]>([]);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);

  const audioContainerRef = useRef<HTMLDivElement | null>(null);
  const roomRef = useRef<Room | null>(null);
  const transcriptMapRef = useRef<Map<string, TranscriptEntry>>(new Map());

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

    const syncRoster = () => {
      if (cancelled || room.state !== ConnectionState.Connected) return;
      const local = room.localParticipant;
      const list: PresenceEntry[] = [
        {
          identity: local.identity,
          name: 'You',
          isLocal: true,
          isAgent: false,
          micEnabled: local.isMicrophoneEnabled,
          speaking: local.isSpeaking,
        },
        ...Array.from(room.remoteParticipants.values()).map((p) => ({
          identity: p.identity,
          name: p.isAgent ? p.name || 'Kortix' : p.name || p.identity,
          isLocal: false,
          isAgent: p.isAgent,
          micEnabled: p.isMicrophoneEnabled,
          speaking: p.isSpeaking,
        })),
      ];
      setRoster(list);
      setMicEnabled(local.isMicrophoneEnabled);
    };

    const upsertTranscript = (
      segments: TranscriptionSegment[],
      participant: Participant | undefined,
    ) => {
      if (cancelled) return;
      const isLocal = participant ? participant.identity === room.localParticipant.identity : false;
      const isAgent = participant?.isAgent ?? false;
      const name = isLocal ? 'You' : isAgent ? participant?.name || 'Kortix' : participant?.name || participant?.identity || 'Guest';
      for (const segment of segments) {
        transcriptMapRef.current.set(segment.id, {
          id: segment.id,
          identity: participant?.identity ?? segment.id,
          name,
          isLocal,
          isAgent,
          text: segment.text,
          final: segment.final,
          firstReceivedTime: segment.firstReceivedTime,
          lastReceivedTime: segment.lastReceivedTime,
        });
      }
      setTranscript(
        Array.from(transcriptMapRef.current.values()).sort(
          (a, b) => a.firstReceivedTime - b.firstReceivedTime,
        ),
      );
    };

    async function join(): Promise<void> {
      if (!token || !livekitUrl) {
        throw new Error('missing LiveKit room token or server URL');
      }

      room
        .on(RoomEvent.Connected, () => {
          if (cancelled) return;
          setPhase('connected');
          syncRoster();
        })
        .on(RoomEvent.Reconnecting, () => {
          if (!cancelled) setPhase('reconnecting');
        })
        .on(RoomEvent.Reconnected, () => {
          if (cancelled) return;
          setPhase('connected');
          syncRoster();
        })
        .on(RoomEvent.Disconnected, (reason) => {
          if (cancelled) return;
          if (reason === DisconnectReason.CLIENT_INITIATED) {
            setPhase('left');
          } else {
            setPhase('failed');
            setError('lost connection to Kortix');
          }
        })
        .on(RoomEvent.ParticipantConnected, syncRoster)
        .on(RoomEvent.ParticipantDisconnected, syncRoster)
        .on(RoomEvent.ParticipantNameChanged, syncRoster)
        .on(RoomEvent.TrackMuted, syncRoster)
        .on(RoomEvent.TrackUnmuted, syncRoster)
        // LiveKit already computes per-participant speech activity for us on
        // every audio-level tick — no hand-rolled peak meter over raw samples
        // needed, unlike the old bridge's capture worklet. `isSpeaking` on
        // each Participant is kept in lockstep with this event, so a single
        // roster resync picks up who's talking right now.
        .on(RoomEvent.ActiveSpeakersChanged, syncRoster)
        // The live, two-directional transcript — both the human's speech and
        // the agent's replies arrive here as the LiveKit Agents SDK publishes
        // them, attributed to whichever participant/track produced them.
        .on(RoomEvent.TranscriptionReceived, upsertTranscript)
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
      syncRoster();
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

  const toggleMic = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    void room.localParticipant
      .setMicrophoneEnabled(!room.localParticipant.isMicrophoneEnabled)
      .then(() => setMicEnabled(room.localParticipant.isMicrophoneEnabled))
      .catch(() => {});
  }, []);

  const leave = useCallback(() => {
    void roomRef.current?.disconnect();
  }, []);

  if (phase === 'connecting') return <ConnectingScreen />;
  if (phase === 'failed' || phase === 'left') {
    return <EndedScreen reason={phase} message={error} />;
  }

  return (
    <div className="bg-background flex h-dvh min-h-screen flex-col">
      <RoomHeader phase={phase} />
      {/* Remote audio plays through elements parked here — invisible, audio-only. */}
      <div ref={audioContainerRef} style={{ display: 'none' }} />
      <div className="mx-auto flex w-full min-h-0 max-w-2xl flex-1 flex-col gap-4 overflow-hidden px-4 py-4 sm:py-6">
        {phase === 'reconnecting' && <ReconnectingBanner />}
        <PresenceRail roster={roster} />
        <TranscriptFeed entries={transcript} className="min-h-0 flex-1" />
      </div>
      <CallControls micEnabled={micEnabled} onToggleMic={toggleMic} onLeave={leave} />
      {needsGesture && <AudioGestureOverlay />}
    </div>
  );
}
