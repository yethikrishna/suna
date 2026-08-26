/**
 * kortix-worker (spike) — the harness, and only the harness.
 *
 * What makes this a worker rather than "an agent running on a box":
 *
 *   toolContext: { env: new KortixExecutionEnv(...) }
 *
 * pi-agent-core's built-in bash/read/write/edit tools resolve their filesystem
 * and shell out of that context. Handing them a KortixExecutionEnv instead of
 * NodeExecutionEnv means the agent has no reachable path to this process's own
 * disk through any default tool. That is the harness/environment split, and it
 * is one object, not a rewritten toolset.
 *
 * Two model modes:
 *   faux  — a scripted provider. No credentials, no network. Used by the proof.
 *   real  — a normal provider; KORTIX_GATEWAY_URL sets ModelAuth.baseUrl so
 *           traffic goes through the Kortix LLM gateway rather than direct.
 */
import { createServer } from 'node:http';
import {
  Agent,
  createBashTool,
  createEditTool,
  createReadTool,
  createWriteTool,
} from '@earendil-works/pi-agent-core';
import {
  InMemoryCredentialStore,
  createModels,
  fauxAssistantMessage,
  fauxProvider,
  fauxToolCall,
} from '@earendil-works/pi-ai';
import { KortixExecutionEnv } from './kortix-env.ts';

const BOOT_T0 = Date.now();

/**
 * Seconds since the machine booted, read at the moment we start serving.
 *
 * This is the number the whole project turns on. The in-guest clock the
 * platform already has (`bootMark()` in kortixd) starts at PROCESS start, so
 * it cannot see VM allocation or rootfs restore — the two costs the small
 * image actually removes. Reading /proc/uptime at listen time gives
 * machine-boot -> serving from inside the box, with no dependency on the
 * benchmark host's clock or its latency to the provider.
 */
function vmUptimeMs(): number | null {
  try {
    const raw = require('node:fs').readFileSync('/proc/uptime', 'utf8');
    return Math.round(Number.parseFloat(raw.split(' ')[0]) * 1000);
  } catch { return null; }
}

export interface WorkerConfig {
  port: number;
  envUrl: string;
  envCwd: string;
  envToken?: string;
  envHeaders?: Record<string, string>;
  systemPrompt: string;
  modelMode: 'faux' | 'real';
  providerId?: string;
  modelId?: string;
  apiKey?: string;
  gatewayUrl?: string;
}

export function configFromEnv(): WorkerConfig {
  const mode = (process.env.KORTIX_MODEL_MODE ?? 'faux') as 'faux' | 'real';
  return {
    port: Number(process.env.PORT ?? 8080),
    envUrl: process.env.KORTIX_ENV_URL ?? 'http://127.0.0.1:8100',
    envCwd: process.env.KORTIX_ENV_CWD ?? '/workspace',
    envToken: process.env.KORTIX_ENV_TOKEN,
    envHeaders: process.env.KORTIX_ENV_HEADERS ? JSON.parse(process.env.KORTIX_ENV_HEADERS) : undefined,
    systemPrompt:
      process.env.KORTIX_SYSTEM_PROMPT ??
      'You are a Kortix agent. All file and shell work happens in the environment, never locally.',
    modelMode: mode,
    providerId: process.env.KORTIX_PROVIDER ?? 'anthropic',
    modelId: process.env.KORTIX_MODEL,
    apiKey: process.env.KORTIX_API_KEY,
    gatewayUrl: process.env.KORTIX_GATEWAY_URL,
  };
}

/**
 * Bind an AgentHarnessTool (5-arg execute, takes a context) down to a plain
 * AgentTool (4-arg execute) by closing over the context.
 *
 * pi-agent-core ships two tool shapes. `createBashTool()` and friends are
 * AgentHarnessTools: they take `{ env }` as a 5th argument so the harness can
 * resolve a fresh context per turn. `Agent` takes plain AgentTools. Binding
 * here is what pins EVERY built-in tool to the Kortix environment for the
 * lifetime of the process — there is no per-call opportunity to substitute a
 * local filesystem.
 */
function bindTool(tool: any, context: object) {
  return {
    ...tool,
    execute: (toolCallId: string, params: any, signal?: AbortSignal, onUpdate?: any) =>
      tool.execute(toolCallId, params, signal, onUpdate, context),
  };
}

export async function buildHarness(cfg: WorkerConfig) {
  const env = new KortixExecutionEnv({ baseUrl: cfg.envUrl, cwd: cfg.envCwd, token: cfg.envToken, headers: cfg.envHeaders });

  const credentials = new InMemoryCredentialStore();
  const models = createModels({ credentials });

  let model: any;
  let faux: ReturnType<typeof fauxProvider> | undefined;

  if (cfg.modelMode === 'faux') {
    faux = fauxProvider({ provider: 'faux', models: [{ id: 'faux-1', name: 'Faux' }] });
    models.setProvider(faux.provider);
    model = faux.getModel();
  } else {
    const { anthropicProvider } = await import('@earendil-works/pi-ai/providers/anthropic');
    const provider = anthropicProvider();
    models.setProvider(provider);
    if (cfg.apiKey) {
      await credentials.modify(provider.id, async () => ({
        type: 'api_key',
        key: cfg.apiKey,
        // KORTIX_GATEWAY_URL is the entire gateway integration: ModelAuth.baseUrl.
        ...(cfg.gatewayUrl ? { env: { baseUrl: cfg.gatewayUrl } } : {}),
      }));
    }
    const list = models.getModels(provider.id);
    model = cfg.modelId ? models.getModel(provider.id, cfg.modelId) : list[0];
    if (!model) throw new Error(`no model resolved for provider ${provider.id}`);
  }

  // THE SEAM. One context object, bound into every built-in tool.
  const toolContext = { env };
  const tools = [createBashTool(), createReadTool(), createWriteTool(), createEditTool()]
    .map((t) => bindTool(t, toolContext));

  const agent = new Agent({
    streamFn: (m: any, ctx: any, opts: any) => models.streamSimple(m, ctx, opts),
    toolExecution: 'sequential',
    initialState: {
      systemPrompt: cfg.systemPrompt,
      model,
      thinkingLevel: 'off',
      tools,
      messages: [],
    } as any,
  });

  return { agent, env, faux, models };
}

let LISTEN_UPTIME_MS: number | null = null;
/** Process start -> listening. Captured ONCE at listen; reporting
 *  `Date.now() - BOOT_T0` at request time measures process AGE, not boot. */
let LISTEN_MS: number | null = null;

export async function startWorker(cfg = configFromEnv()) {
  const { agent, env, faux } = await buildHarness(cfg);
  const listeners = new Set<(chunk: string) => void>();

  agent.subscribe((event: any) => {
    const line = `data: ${JSON.stringify(event)}\n\n`;
    for (const l of listeners) l(line);
  });

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');

    if (url.pathname === '/health') {
      const body = JSON.stringify({
        ok: true,
        bootMs: LISTEN_MS,
        processAgeMs: Date.now() - BOOT_T0,
        vmUptimeAtListenMs: LISTEN_UPTIME_MS,
        vmUptimeNowMs: vmUptimeMs(),
        modelMode: cfg.modelMode,
        environment: { url: cfg.envUrl, cwd: cfg.envCwd, rpcCalls: env.calls.length },
      });
      res.writeHead(200, { 'content-type': 'application/json' }).end(body);
      return;
    }

    if (url.pathname === '/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      const send = (c: string) => res.write(c);
      listeners.add(send);
      req.on('close', () => listeners.delete(send));
      return;
    }

    if (url.pathname === '/prompt' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', async () => {
        try {
          const { text, script } = JSON.parse(body || '{}');
          // The faux provider is scripted per prompt so a test can drive an
          // exact tool call without a model in the loop. Compact wire form:
          //   [{ "tool": "write", "args": {...} }, { "text": "done" }]
          if (faux && Array.isArray(script)) {
            faux.setResponses(
              script.map((step: any) =>
                step.tool
                  ? fauxAssistantMessage([fauxToolCall(step.tool, step.args ?? {})], { stopReason: 'toolUse' })
                  : fauxAssistantMessage(String(step.text ?? ''), { stopReason: 'stop' }),
              ),
            );
          }
          await agent.prompt(String(text ?? ''));
          const result = { messages: agent.state.messages.length };
          const payload = JSON.stringify({ ok: true, result, rpcCalls: env.calls.map((c) => c.op) });
          res.writeHead(200, { 'content-type': 'application/json' }).end(payload);
        } catch (e: any) {
          res.writeHead(500, { 'content-type': 'application/json' })
             .end(JSON.stringify({ ok: false, error: String(e?.message ?? e) }));
        }
      });
      return;
    }

    // Streaming turn. The benchmark measures time-to-first-token off the first
    // chunk that carries assistant text, which is what a user actually waits
    // for — not when the turn finishes.
    if (url.pathname === '/turn' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', async () => {
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
        const { text, script } = JSON.parse(body || '{}');
        if (faux && Array.isArray(script)) {
          faux.setResponses(
            script.map((step: any) =>
              step.tool
                ? fauxAssistantMessage([fauxToolCall(step.tool, step.args ?? {})], { stopReason: 'toolUse' })
                : fauxAssistantMessage(String(step.text ?? ''), { stopReason: 'stop' }),
            ),
          );
        }
        const unsub = agent.subscribe((event: any) => {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        });
        try {
          await agent.prompt(String(text ?? ''));
          res.write(`event: done\ndata: ${JSON.stringify({ rpcCalls: env.calls.map((c) => c.op) })}\n\n`);
        } catch (e: any) {
          res.write(`event: error\ndata: ${JSON.stringify({ error: String(e?.message ?? e) })}\n\n`);
        } finally {
          unsub();
          res.end();
        }
      });
      return;
    }

    if (url.pathname === '/interrupt' && req.method === 'POST') {
      agent.abort();
      res.writeHead(200, { 'content-type': 'application/json' }).end('{"ok":true}');
      return;
    }

    res.writeHead(404).end();
  });

  await new Promise<void>((r) => server.listen(cfg.port, '0.0.0.0', r));
  LISTEN_UPTIME_MS = vmUptimeMs();
  LISTEN_MS = Date.now() - BOOT_T0;
  const port = (server.address() as any).port;
  console.log(JSON.stringify({ msg: 'worker listening', port, bootMs: LISTEN_MS, vmUptimeAtListenMs: LISTEN_UPTIME_MS, modelMode: cfg.modelMode, env: cfg.envUrl }));
  return { server, agent, env, port, close: () => new Promise<void>((r) => server.close(() => r())) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startWorker().catch((e) => { console.error(e); process.exit(1); });
}
