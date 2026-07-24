/**
 * Gate 0 report sink for the voice echo probe.
 *
 * The probe page (apps/web `/voice-probe`) runs inside a Recall meeting bot and
 * has nowhere to log — this collects its findings. Two routes, no auth, both
 * dead unless VOICE_PROBE_ENABLED is set: the probe runs in a third-party
 * browser we can't hand a credential to, and it's a throwaway experiment, so the
 * operator switch is the whole security model. Never enable in production.
 *
 * Delete this file once the echo question is settled.
 */
import { createRoute, z } from '@hono/zod-openapi';
import { config } from '../config';
import { errors, json, makeOpenApiApp } from '../openapi';

export const voiceProbeApp = makeOpenApiApp();

const verdictSchema = z.object({
  onMean: z.number(),
  offMean: z.number(),
  ratio: z.number(),
  samples: z.number(),
  /** The probe confirmed its own oscillator was producing signal. False = the run proves nothing. */
  toneVerified: z.boolean(),
});

const reportSchema = z.object({
  run: z.string(),
  aec: z.boolean(),
  sampleRate: z.number(),
  toneHz: z.number(),
  verdict: verdictSchema,
  latency: z.object({
    api: z.number().nullable(),
    xai: z.number().nullable(),
  }),
});

/** Ratio of in-band energy (tone on vs off) above which the bot is hearing itself. */
const ECHO_RATIO_THRESHOLD = 3;

voiceProbeApp.openapi(
  createRoute({
    method: 'get',
    path: '/ping',
    tags: ['channels'],
    summary: 'Voice probe latency ping (Gate 0 experiment)',
    responses: { 200: json(z.object({ ok: z.boolean() }), 'Pong'), ...errors(404) },
  }),
  async (c: any) => {
    if (!config.VOICE_PROBE_ENABLED) return c.json({ error: 'Not found' }, 404);
    return c.json({ ok: true });
  },
);

voiceProbeApp.openapi(
  createRoute({
    method: 'post',
    path: '/report',
    tags: ['channels'],
    summary: 'Voice probe echo/latency report (Gate 0 experiment)',
    request: { body: { content: { 'application/json': { schema: reportSchema } } } },
    responses: {
      200: json(z.object({ ok: z.boolean(), echo: z.boolean() }), 'Recorded'),
      ...errors(400, 404),
    },
  }),
  async (c: any) => {
    if (!config.VOICE_PROBE_ENABLED) return c.json({ error: 'Not found' }, 404);

    let body: z.infer<typeof reportSchema>;
    try {
      body = reportSchema.parse(await c.req.json());
    } catch {
      return c.json({ error: 'Invalid report' }, 400);
    }

    // A silent probe (blocked AudioContext) looks identical to a clean result, so
    // an unverified tone is reported as INVALID rather than as "no echo".
    const echo = body.verdict.toneVerified && body.verdict.ratio > ECHO_RATIO_THRESHOLD;
    const outcome = !body.verdict.toneVerified ? 'INVALID(no-tone)' : echo ? 'YES' : 'no';

    // Console is the intended output — an operator is watching this run live.
    console.log(
      `[voice-probe] run=${body.run} aec=${body.aec} rate=${body.sampleRate} ` +
        `echo=${outcome} ratio=${body.verdict.ratio.toFixed(2)} ` +
        `on=${body.verdict.onMean.toExponential(2)} off=${body.verdict.offMean.toExponential(2)} ` +
        `n=${body.verdict.samples} api=${body.latency.api ?? 'n/a'}ms xai=${body.latency.xai ?? 'n/a'}ms`,
    );

    return c.json({ ok: true, echo });
  },
);
