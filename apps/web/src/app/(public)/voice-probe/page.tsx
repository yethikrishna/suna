'use client';

/**
 * Gate 0 probe for the realtime voice channel.
 *
 * Recall's Output Media renders this page inside the meeting bot and streams the
 * page's audio into the call. The page simultaneously captures "meeting audio"
 * via getUserMedia. The open question the whole voice design rests on: does that
 * captured stream contain the bot's OWN output? If it does, xAI's server_vad
 * hears the agent speaking and self-interrupts forever.
 *
 * Method: emit a pulsed narrowband tone (3 kHz, 1s on / 3s off) and measure the
 * energy in that exact FFT bin of the captured stream, split by whether the tone
 * was on or off. A large on/off ratio means our own audio is coming back.
 *
 * Browser audio processing is DISABLED by default (?aec=1 to re-enable) because
 * echoCancellation would suppress the very thing we are trying to detect and
 * hand us a false negative. Run it both ways: aec=0 answers "is the echo there",
 * aec=1 answers "would the browser save us anyway".
 *
 * Also times the two network hops the topology decision depends on: this page →
 * our API, and this page → api.x.ai.
 */

import { useEffect, useRef, useState } from 'react';

const TONE_HZ = 3000;
const TONE_ON_MS = 1000;
const TONE_CYCLE_MS = 4000;
const SAMPLE_INTERVAL_MS = 100;
const REPORT_INTERVAL_MS = 5000;
const TONE_GAIN = 0.2;
/** Bins either side of the tone bin to include — covers FFT leakage and resampling drift. */
const BIN_HALFWIDTH = 2;

interface Sample {
  t: number;
  toneOn: boolean;
  toneEnergy: number;
  rms: number;
}

interface Verdict {
  onMean: number;
  offMean: number;
  ratio: number;
  samples: number;
}

function summarize(samples: Sample[]): Verdict | null {
  const on = samples.filter((s) => s.toneOn);
  const off = samples.filter((s) => !s.toneOn);
  if (on.length < 5 || off.length < 5) return null;
  const mean = (xs: Sample[]) => xs.reduce((a, s) => a + s.toneEnergy, 0) / xs.length;
  const onMean = mean(on);
  const offMean = mean(off);
  return {
    onMean,
    offMean,
    // Guard the divide: a silent room gives offMean ~0.
    ratio: offMean > 0.0001 ? onMean / offMean : onMean > 0.0001 ? Infinity : 1,
    samples: samples.length,
  };
}

/** Time a websocket handshake. Resolves on open OR on error — both mean the TCP+TLS round trip completed. */
function timeWebSocket(url: string, timeoutMs = 8000): Promise<number | null> {
  return new Promise((resolve) => {
    const started = performance.now();
    let settled = false;
    const done = (v: number | null) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    try {
      const ws = new WebSocket(url);
      ws.onopen = () => {
        done(performance.now() - started);
        ws.close();
      };
      ws.onerror = () => done(performance.now() - started);
      setTimeout(() => done(null), timeoutMs);
    } catch {
      done(null);
    }
  });
}

async function timeHttp(url: string): Promise<number | null> {
  const started = performance.now();
  try {
    await fetch(url, { method: 'GET', cache: 'no-store' });
    return performance.now() - started;
  } catch {
    return null;
  }
}

export default function VoiceProbePage() {
  const [status, setStatus] = useState('starting');
  const [error, setError] = useState<string | null>(null);
  const [toneOn, setToneOn] = useState(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [latency, setLatency] = useState<{ api: number | null; xai: number | null } | null>(null);
  const [reported, setReported] = useState(0);
  const samplesRef = useRef<Sample[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sink = (params.get('sink') || process.env.NEXT_PUBLIC_BACKEND_URL || '').replace(/\/+$/, '');
    const runId = params.get('run') || `run-${Date.now()}`;
    const aec = params.get('aec') === '1';

    let cancelled = false;
    const cleanups: Array<() => void> = [];

    async function run() {
      const ctx = new AudioContext();
      cleanups.push(() => void ctx.close().catch(() => {}));
      // Headless Chrome usually autoplays, but resume() is free insurance.
      if (ctx.state === 'suspended') await ctx.resume().catch(() => {});

      // --- Emit the pulsed tone into the page's audio output (what Recall streams out).
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = TONE_HZ;
      gain.gain.value = 0;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      cleanups.push(() => osc.stop());

      let isOn = false;
      const toneTimer = setInterval(() => {
        const phase = Date.now() % TONE_CYCLE_MS;
        const next = phase < TONE_ON_MS;
        if (next !== isOn) {
          isOn = next;
          gain.gain.setTargetAtTime(next ? TONE_GAIN : 0, ctx.currentTime, 0.01);
          if (!cancelled) setToneOn(next);
        }
      }, 50);
      cleanups.push(() => clearInterval(toneTimer));

      // --- Capture "meeting audio". Processing off by default: echoCancellation would
      // cancel exactly the signal we are trying to detect.
      setStatus('requesting microphone');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: aec,
          noiseSuppression: aec,
          autoGainControl: aec,
        },
      });
      cleanups.push(() => stream.getTracks().forEach((t) => t.stop()));

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0;
      source.connect(analyser);

      const freq = new Float32Array(analyser.frequencyBinCount);
      const time = new Float32Array(analyser.fftSize);
      const binWidth = ctx.sampleRate / analyser.fftSize;
      const toneBin = Math.round(TONE_HZ / binWidth);

      setStatus(`listening (aec=${aec ? 'on' : 'off'}, ${Math.round(ctx.sampleRate)}Hz)`);

      const sampleTimer = setInterval(() => {
        analyser.getFloatFrequencyData(freq);
        analyser.getFloatTimeDomainData(time);

        // Peak magnitude across the tone bin ± leakage, converted out of dB.
        let peakDb = -Infinity;
        for (let b = toneBin - BIN_HALFWIDTH; b <= toneBin + BIN_HALFWIDTH; b++) {
          if (b >= 0 && b < freq.length && freq[b]! > peakDb) peakDb = freq[b]!;
        }
        const toneEnergy = peakDb === -Infinity ? 0 : 10 ** (peakDb / 20);

        let sumSq = 0;
        for (let i = 0; i < time.length; i++) sumSq += time[i]! * time[i]!;
        const rms = Math.sqrt(sumSq / time.length);

        samplesRef.current.push({ t: Date.now(), toneOn: isOn, toneEnergy, rms });
        if (samplesRef.current.length > 6000) samplesRef.current.splice(0, 1000);
        if (!cancelled) setVerdict(summarize(samplesRef.current));
      }, SAMPLE_INTERVAL_MS);
      cleanups.push(() => clearInterval(sampleTimer));

      // --- Topology latency: this page (inside Recall's browser) to both endpoints.
      const [api, xai] = await Promise.all([
        sink ? timeHttp(`${sink}/v1/webhooks/voice-probe/ping`) : Promise.resolve(null),
        timeWebSocket('wss://api.x.ai/v1/realtime'),
      ]);
      if (!cancelled) setLatency({ api, xai });

      // --- Ship results.
      const reportTimer = setInterval(() => {
        const v = summarize(samplesRef.current);
        if (!sink || !v) return;
        void fetch(`${sink}/v1/webhooks/voice-probe/report`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            run: runId,
            aec,
            sampleRate: ctx.sampleRate,
            toneHz: TONE_HZ,
            verdict: v,
            latency: { api, xai },
          }),
        })
          .then(() => !cancelled && setReported((n) => n + 1))
          .catch(() => {});
      }, REPORT_INTERVAL_MS);
      cleanups.push(() => clearInterval(reportTimer));
    }

    run().catch((e) => {
      if (!cancelled) {
        setError(e instanceof Error ? e.message : String(e));
        setStatus('failed');
      }
    });

    return () => {
      cancelled = true;
      cleanups.forEach((fn) => {
        try {
          fn();
        } catch {
          /* teardown is best-effort */
        }
      });
    };
  }, []);

  // Output Media always renders a video track, so make it readable at a glance —
  // this is how you diagnose a stuck probe without digging through logs.
  const echoing = verdict != null && verdict.ratio > 3;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-black p-12 font-mono text-white">
      <div className="text-5xl font-bold tracking-tight">Voice echo probe</div>

      <div className="flex items-center gap-4 text-3xl">
        <span
          className={`inline-block h-8 w-8 rounded-full ${toneOn ? 'bg-emerald-400' : 'bg-neutral-700'}`}
        />
        <span>{toneOn ? `tone ${TONE_HZ}Hz ON` : 'silent'}</span>
      </div>

      <div className="text-2xl text-neutral-400">{status}</div>
      {error && <div className="max-w-3xl text-center text-2xl text-red-400">{error}</div>}

      {verdict && (
        <div className="flex flex-col items-center gap-3">
          <div className={`text-6xl font-bold ${echoing ? 'text-red-400' : 'text-emerald-400'}`}>
            {echoing ? 'ECHO DETECTED' : 'no echo'}
          </div>
          <div className="text-2xl text-neutral-300">
            on {verdict.onMean.toExponential(2)} / off {verdict.offMean.toExponential(2)} = ratio{' '}
            {verdict.ratio === Infinity ? '∞' : verdict.ratio.toFixed(1)}x
          </div>
          <div className="text-xl text-neutral-500">{verdict.samples} samples</div>
        </div>
      )}

      {latency && (
        <div className="text-xl text-neutral-400">
          api {latency.api == null ? 'n/a' : `${Math.round(latency.api)}ms`} · x.ai{' '}
          {latency.xai == null ? 'n/a' : `${Math.round(latency.xai)}ms`}
        </div>
      )}

      <div className="text-lg text-neutral-600">{reported} reports sent</div>
    </div>
  );
}
