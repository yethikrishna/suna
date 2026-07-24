'use client';

/**
 * The audio bridge page.
 *
 * Recall renders this inside the meeting bot and streams whatever it plays into
 * the call, while `getUserMedia` hands us the room's audio. So this page is a
 * pipe: room audio up the socket, agent audio down and out the speakers.
 *
 * It is deliberately dumb. The realtime provider WebSocket, the transcript, and
 * anything that can prompt a session all live server-side, because this code
 * runs in a browser inside Recall's infrastructure with its token visible in the
 * URL. That token authorises relaying audio for one call and nothing else.
 *
 * Gate 0 (2026-07-25) measured that Recall's capture does NOT contain the bot's
 * own output, so there is no echo gate here and barge-in works for real. If that
 * ever changes, this is where a half-duplex mute would go.
 *
 * Output Media always renders a video track — audio-only is not possible — so
 * the page also draws call state. It is the only diagnostic surface a stuck bot
 * has, and participants can read it.
 */

import { useEffect, useRef, useState } from 'react';

/** Must match VOICE_SAMPLE_RATE in apps/api. Recall's page context runs at 44.1kHz. */
const SAMPLE_RATE = 44_100;
const FRAME_SAMPLES = 2048;

type Phase = 'starting' | 'listening' | 'speaking' | 'reconnecting' | 'failed';

function floatToPcm16(input: Float32Array): ArrayBuffer {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]!));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out.buffer;
}

function pcm16ToFloat(buf: ArrayBuffer): Float32Array<ArrayBuffer> {
  const view = new Int16Array(buf);
  const out = new Float32Array(new ArrayBuffer(view.length * 4));
  for (let i = 0; i < view.length; i++) out[i] = view[i]! / 0x8000;
  return out;
}

export default function VoiceBridgePage() {
  const [phase, setPhase] = useState<Phase>('starting');
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const token = window.location.pathname.split('/').filter(Boolean).pop() ?? '';
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${
      process.env.NEXT_PUBLIC_BACKEND_HOST || window.location.host
    }/v1/voice/bridge/${token}`;

    let cancelled = false;
    let ws: WebSocket | null = null;
    let ctx: AudioContext | null = null;
    let stream: MediaStream | null = null;
    let reconnects = 0;
    /** Absolute time the next chunk of agent audio should start, for gapless playback. */
    let playHead = 0;

    async function connect(): Promise<void> {
      ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
      if (ctx.state === 'suspended') void ctx.resume().catch(() => {});

      stream = await navigator.mediaDevices.getUserMedia({
        // Recall does not feed the bot its own output (measured), so leaving the
        // browser's processing off keeps the model's own VAD working on clean,
        // unmangled room audio rather than something AGC has been chewing on.
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });

      ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        if (!cancelled) {
          setPhase('listening');
          reconnects = 0;
        }
      };

      ws.onmessage = (ev) => {
        if (!(ev.data instanceof ArrayBuffer) || !ctx) return;
        const samples = pcm16ToFloat(ev.data);
        const buffer = ctx.createBuffer(1, samples.length, SAMPLE_RATE);
        buffer.copyToChannel(samples, 0);
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(ctx.destination);
        // Queue against a running play head so consecutive chunks butt up
        // against each other; scheduling everything at `currentTime` overlaps
        // them and turns speech into garbled mush.
        const now = ctx.currentTime;
        if (playHead < now) playHead = now;
        src.start(playHead);
        playHead += buffer.duration;
        if (!cancelled) {
          setPhase('speaking');
          setTimeout(() => !cancelled && setPhase('listening'), buffer.duration * 1000 + 250);
        }
      };

      ws.onclose = () => {
        if (cancelled) return;
        // The call may simply have ended; retry a few times before giving up so
        // a blip doesn't silently take the agent out of the meeting.
        if (reconnects < 5) {
          reconnects++;
          setPhase('reconnecting');
          setTimeout(() => void connect().catch(() => {}), 1000 * reconnects);
        } else {
          setPhase('failed');
          setError('lost connection to Kortix');
        }
      };

      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(FRAME_SAMPLES, 1, 1);
      source.connect(processor);
      // ScriptProcessor only runs while connected to a destination; a zero gain
      // keeps it pumping without echoing the room back into the room.
      const mute = ctx.createGain();
      mute.gain.value = 0;
      processor.connect(mute).connect(ctx.destination);

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        let peak = 0;
        for (let i = 0; i < input.length; i++) peak = Math.max(peak, Math.abs(input[i]!));
        if (!cancelled) setLevel(peak);
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(floatToPcm16(input));
      };
    }

    connect().catch((e) => {
      if (cancelled) return;
      setPhase('failed');
      setError(e instanceof Error ? e.message : String(e));
    });

    return () => {
      cancelled = true;
      try {
        ws?.close();
      } catch {
        /* best effort */
      }
      stream?.getTracks().forEach((t) => t.stop());
      void ctx?.close().catch(() => {});
    };
  }, []);

  // The required video track. Kept legible at a glance: this is what someone
  // stares at when the bot is in a call and something looks wrong.
  useEffect(() => {
    const canvas = canvasRef.current;
    const c = canvas?.getContext('2d');
    if (!canvas || !c) return;
    let raf = 0;
    const draw = () => {
      c.clearRect(0, 0, canvas.width, canvas.height);
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
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [level, phase]);

  const label =
    phase === 'speaking'
      ? 'speaking'
      : phase === 'listening'
        ? 'listening'
        : phase === 'reconnecting'
          ? 'reconnecting…'
          : phase === 'failed'
            ? 'voice unavailable'
            : 'connecting…';

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black">
      <canvas ref={canvasRef} width={1280} height={720} className="absolute inset-0 h-full w-full" />
      <div className="relative flex flex-col items-center gap-4">
        <div className="font-mono text-6xl font-bold tracking-tight text-white">Kortix</div>
        <div className="font-mono text-3xl text-neutral-300">{label}</div>
        {error && <div className="max-w-2xl text-center font-mono text-xl text-red-400">{error}</div>}
      </div>
    </div>
  );
}
