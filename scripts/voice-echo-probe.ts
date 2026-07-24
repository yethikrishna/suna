#!/usr/bin/env bun
/**
 * Gate 0 runner: send a Recall bot into a meeting rendering the echo probe page.
 *
 * The voice channel design assumes we can stream a page's audio into a call and
 * separately capture meeting audio. It falls apart if the captured audio also
 * contains the bot's own output — server_vad would hear the agent and interrupt
 * itself forever. This spawns the experiment that answers that.
 *
 * Usage:
 *   bun scripts/voice-echo-probe.ts \
 *     --meeting https://meet.google.com/abc-defg-hij \
 *     --page    https://<tunnel>/voice-probe \
 *     --sink    https://<tunnel-api>
 *
 *   --aec        capture WITH browser echo cancellation (default: off, to see raw truth)
 *   --leave <id> remove a bot when you're done
 *
 * Needs RECALL_API_KEY (and optionally RECALL_BASE_URL) in the environment; run
 * it under dotenvx like the rest of the stack.
 *
 * Delete this script once the echo question is settled.
 */

const DEFAULT_BASE = 'https://us-west-2.recall.ai/api/v1';

interface Args {
  meeting?: string;
  page?: string;
  sink?: string;
  aec: boolean;
  leave?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { aec: false };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === '--aec') args.aec = true;
    else if (flag === '--meeting' && value) (args.meeting = value), i++;
    else if (flag === '--page' && value) (args.page = value), i++;
    else if (flag === '--sink' && value) (args.sink = value), i++;
    else if (flag === '--leave' && value) (args.leave = value), i++;
  }
  return args;
}

function requireKey(): string {
  const key = process.env.RECALL_API_KEY;
  if (!key) {
    console.error('RECALL_API_KEY is not set. Run under dotenvx, e.g.');
    console.error('  dotenvx run -f apps/api/.env.dev -- bun scripts/voice-echo-probe.ts ...');
    process.exit(1);
  }
  return key;
}

function baseUrl(): string {
  return (process.env.RECALL_BASE_URL || DEFAULT_BASE).replace(/\/+$/, '');
}

async function recall(path: string, key: string, body?: unknown) {
  const res = await fetch(`${baseUrl()}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Token ${key}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* keep raw text for the error message */
  }
  return { ok: res.ok, status: res.status, data: parsed as any };
}

/**
 * Recall documents two different shapes for this — `camera.kind='webpage'` with a
 * nested `config` on create-bot, and `camera.webpage.url` on the standalone
 * endpoint. Try both and report which one the API actually accepts; the real
 * implementation needs that answer too.
 */
function outputMediaVariants(pageUrl: string) {
  return [
    { label: 'camera.kind+config', value: { camera: { kind: 'webpage', config: { url: pageUrl } } } },
    { label: 'camera.webpage.url', value: { camera: { webpage: { url: pageUrl } } } },
  ];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const key = requireKey();

  if (args.leave) {
    const res = await recall(`/bot/${encodeURIComponent(args.leave)}/leave_call/`, key, {});
    console.log(res.ok ? `left: ${args.leave}` : `leave failed (${res.status}):`, res.data);
    return;
  }

  if (!args.meeting || !args.page) {
    console.error('Required: --meeting <url> --page <public probe page url>');
    console.error('Optional: --sink <public api base url> --aec');
    process.exit(1);
  }

  const runId = `echo-${Date.now()}`;
  const pageUrl = new URL(args.page);
  pageUrl.searchParams.set('run', runId);
  if (args.aec) pageUrl.searchParams.set('aec', '1');
  if (args.sink) pageUrl.searchParams.set('sink', args.sink.replace(/\/+$/, ''));

  console.log(`run:     ${runId}`);
  console.log(`page:    ${pageUrl.toString()}`);
  console.log(`aec:     ${args.aec ? 'on' : 'off (raw truth)'}`);
  console.log('');

  for (const variant of outputMediaVariants(pageUrl.toString())) {
    const res = await recall('/bot/', key, {
      meeting_url: args.meeting,
      bot_name: 'Kortix echo probe',
      output_media: variant.value,
    });

    if (res.ok) {
      const botId = res.data?.id ?? '(unknown)';
      console.log(`joined with output_media shape "${variant.label}"`);
      console.log(`bot id:  ${botId}`);
      console.log('');
      console.log('Watch the bot\'s video in the meeting for the live verdict, and the API');
      console.log('logs for [voice-probe] lines. Let it run ~60s, then:');
      console.log(`  bun scripts/voice-echo-probe.ts --leave ${botId}`);
      return;
    }

    console.log(`shape "${variant.label}" rejected (${res.status}):`, JSON.stringify(res.data));
  }

  console.error('');
  console.error('Both output_media shapes were rejected — check the Recall API version.');
  process.exit(1);
}

void main();
