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

/** Must match VOICE_SAMPLE_RATE in apps/api. Constructing the AudioContext at
 *  this rate makes the browser resample the mic for us, so the provider always
 *  receives audio at the rate it expects. */
const SAMPLE_RATE = 24_000;
/** ~20ms of capture per message. Small enough to stay responsive, large enough
 *  that we are not sending a websocket frame every render quantum. */
const CAPTURE_FRAME = 480;
/** ~2s of playback buffer — absorbs burst delivery without adding latency. */
const RING_SAMPLES = 48_000;

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
    // The API told us its public base when it minted this URL. Never infer it
    // from window.location — that is the WEB host, which is a different origin
    // from the API in every real deployment.
    const apiBase = (
      new URLSearchParams(window.location.search).get('api') ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      window.location.origin
    ).replace(/\/+$/, '');
    const wsUrl = `${apiBase.replace(/^http/, 'ws')}/v1/voice/bridge/${token}`;

    let cancelled = false;
    let ws: WebSocket | null = null;
    let ctx: AudioContext | null = null;
    let stream: MediaStream | null = null;
    let reconnects = 0;
    let player: AudioWorkletNode | null = null;
    let speakingTimer: ReturnType<typeof setTimeout> | null = null;

    /** Audio graph is built ONCE. Only the socket reconnects. */
    async function setupAudio(): Promise<void> {
      ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
      if (ctx.state === 'suspended') void ctx.resume().catch(() => {});

      stream = await navigator.mediaDevices.getUserMedia({
        // Recall does not feed the bot its own output (measured), so leaving the
        // browser's processing off keeps the model's own VAD working on clean,
        // unmangled room audio rather than something AGC has been chewing on.
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });

      connectSocket();
      await buildGraph();
    }

    function connectSocket(): void {
      ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        if (!cancelled) {
          setPhase('listening');
          reconnects = 0;
        }
      };

      ws.onmessage = (ev) => {
        // Text frames are control, binary is audio.
        if (typeof ev.data === 'string') {
          // Barge-in: drop what is queued. Without this, playback stays behind by
          // the length of the abandoned reply and the delay compounds each time.
          if (ev.data.includes('flush')) player?.port.postMessage('flush');
          return;
        }
        if (!(ev.data instanceof ArrayBuffer) || !player) return;
        player.port.postMessage(pcm16ToFloat(ev.data));
        if (!cancelled) {
          setPhase('speaking');
          if (speakingTimer) clearTimeout(speakingTimer);
          speakingTimer = setTimeout(() => !cancelled && setPhase('listening'), 700);
        }
      };

      ws.onclose = () => {
        if (cancelled) return;
        // Reconnect the SOCKET ONLY — never rebuild the audio graph. Doing that
        // races the existing getUserMedia for the mic and yields a live-looking
        // but silent capture chain.
        if (reconnects < 5) {
          reconnects++;
          setPhase('reconnecting');
          setTimeout(() => connectSocket(), 1000 * reconnects);
        } else {
          setPhase('failed');
          setError('lost connection to Kortix');
        }
      };
    }

    async function buildGraph(): Promise<void> {
      if (!ctx || !stream) return;
      const source = ctx.createMediaStreamSource(stream);

      // Both directions run on the audio thread, in ONE worklet module.
      //
      // Capture batches to ~20ms. A worklet's process() fires every 128 samples,
      // which at 24kHz is every 5.3ms — sending that raw meant ~188 websocket
      // frames AND ~188 base64 JSON events per second to the provider. That
      // flood is what made the audio jittery, not the meeting platform.
      //
      // Playback is a ring buffer, not one AudioBuffer per chunk. The provider
      // bursts a reply as many small deltas; scheduling each as its own node put
      // a seam at every boundary. A ring buffer emits one continuous stream and
      // absorbs irregular arrival, which is what makes speech sound like speech.
      const workletSrc = `
        const FRAME = ${CAPTURE_FRAME};
        class Cap extends AudioWorkletProcessor {
          constructor() { super(); this.buf = new Float32Array(FRAME); this.n = 0; }
          process(inputs) {
            const ch = inputs[0] && inputs[0][0];
            if (!ch) return true;
            for (let i = 0; i < ch.length; i++) {
              this.buf[this.n++] = ch[i];
              if (this.n === FRAME) { this.port.postMessage(this.buf.slice(0)); this.n = 0; }
            }
            return true;
          }
        }
        registerProcessor('cap', Cap);

        class Play extends AudioWorkletProcessor {
          constructor() {
            super();
            this.ring = new Float32Array(${RING_SAMPLES});
            this.r = 0; this.w = 0;
            this.port.onmessage = (e) => {
              if (e.data === 'flush') { this.r = this.w = 0; return; }
              const d = e.data;
              for (let i = 0; i < d.length; i++) {
                this.ring[this.w] = d[i];
                this.w = (this.w + 1) % this.ring.length;
              }
            };
          }
          process(_i, outputs) {
            const out = outputs[0][0];
            for (let i = 0; i < out.length; i++) {
              // Underrun writes silence rather than stalling — a gap is far less
              // audible than a stutter, and the ring refills on the next delta.
              out[i] = this.r === this.w ? 0 : this.ring[this.r];
              if (this.r !== this.w) this.r = (this.r + 1) % this.ring.length;
            }
            return true;
          }
        }
        registerProcessor('play', Play);
      `;
      const blobUrl = URL.createObjectURL(new Blob([workletSrc], { type: 'application/javascript' }));
      await ctx.audioWorklet.addModule(blobUrl);
      URL.revokeObjectURL(blobUrl);

      const capture = new AudioWorkletNode(ctx, 'cap');
      source.connect(capture);
      // A worklet with no downstream connection is not guaranteed to be pulled;
      // a muted sink keeps it running without feeding the room back to itself.
      const mute = ctx.createGain();
      mute.gain.value = 0;
      capture.connect(mute).connect(ctx.destination);

      player = new AudioWorkletNode(ctx, 'play', { outputChannelCount: [1] });
      player.connect(ctx.destination);

      let levelTick = 0;
      capture.port.onmessage = (e: MessageEvent<Float32Array>) => {
        const input = e.data;
        if (++levelTick % 4 === 0) {
          let peak = 0;
          for (let i = 0; i < input.length; i++) peak = Math.max(peak, Math.abs(input[i]!));
          if (!cancelled) setLevel(peak);
        }
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(floatToPcm16(input));
      };
    }

    setupAudio().catch((e) => {
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
    let timer: ReturnType<typeof setInterval> | null = null;
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
    };
    // Recall captures at 15fps; 10fps here is indistinguishable in the call and
    // leaves the main thread alone.
    timer = setInterval(draw, 100);
    draw();
    return () => {
      if (timer) clearInterval(timer);
    };
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
