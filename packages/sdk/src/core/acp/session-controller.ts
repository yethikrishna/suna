import { buildAcpBridgeEndpoint } from '../session/runtime-transport';
import { createAcpClient, type AcpClient } from './client';
import { applyAcpEnvelope, createAcpProjection, type AcpProjection } from './projection';
import type {
  AcpContentBlock,
  AcpEnvelope,
  AcpJsonRpcId,
  AcpStreamEvent,
  AcpStreamHandle,
} from './types';
import { AcpTransportError } from './types';

export interface AcpSessionClient {
  connect(options: {
    onEvent(event: AcpStreamEvent): void;
    onError?(error: unknown): void;
  }): AcpStreamHandle;
  loadSession(input: {
    sessionId: string;
    cwd: string;
    mcpServers?: unknown[];
  }): Promise<Record<string, unknown>>;
  setSessionConfigOption(
    sessionId: string,
    configId: string,
    value: unknown,
  ): Promise<Record<string, unknown>>;
  prompt(
    sessionId: string,
    prompt: AcpContentBlock[],
  ): Promise<{ stopReason: string; usage?: Record<string, unknown> }>;
  cancel(sessionId: string): Promise<void>;
  respond(id: AcpJsonRpcId, result?: unknown): Promise<void>;
}

export interface AcpSessionControllerSnapshot {
  ready: boolean;
  sending: boolean;
  connection: 'idle' | 'connecting' | 'open' | 'closed' | 'error';
  error: Error | null;
  projection: AcpProjection;
  configOptions: Array<Record<string, unknown>>;
}

export interface AcpSessionControllerOptions {
  sessionId: string;
  runtimeUrl?: string;
  client?: AcpSessionClient;
  cwd?: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function selectedPermissionOption(
  params: Record<string, unknown>,
  reply: 'once' | 'always' | 'reject',
): string | null {
  const options = Array.isArray(params.options) ? params.options.filter(isObject) : [];
  const kinds =
    reply === 'once'
      ? ['allow_once', 'allow']
      : reply === 'always'
        ? ['allow_always', 'always']
        : ['reject_once', 'reject_always', 'reject'];
  for (const kind of kinds) {
    const option = options.find((candidate) => candidate.kind === kind);
    const id = option && asString(option.optionId);
    if (id) return id;
  }
  return null;
}

function questionContent(
  params: Record<string, unknown>,
  answers: string[][],
): Record<string, unknown> {
  const schema = isObject(params.requestedSchema)
    ? params.requestedSchema
    : isObject(params.schema)
      ? params.schema
      : null;
  const properties = schema && isObject(schema.properties) ? Object.keys(schema.properties) : [];
  if (properties.length === 0) return { answers };
  return Object.fromEntries(
    properties.map((key, index) => {
      const answer = answers[index] ?? [];
      return [key, answer.length <= 1 ? (answer[0] ?? '') : answer];
    }),
  );
}

export class AcpSessionController {
  private readonly client: AcpSessionClient;
  private readonly listeners = new Set<() => void>();
  private readonly openRequests = new Map<string, Record<string, unknown>>();
  private stream: AcpStreamHandle | null = null;
  private connecting: Promise<void> | null = null;
  private snapshot: AcpSessionControllerSnapshot;

  constructor(private readonly options: AcpSessionControllerOptions) {
    if (!options.client && !options.runtimeUrl) {
      throw new Error('AcpSessionController requires a runtimeUrl or injected client');
    }
    this.client =
      options.client ??
      createAcpClient({
        endpoint: buildAcpBridgeEndpoint(options.runtimeUrl as string, options.sessionId),
      });
    this.snapshot = {
      ready: false,
      sending: false,
      connection: 'idle',
      error: null,
      projection: createAcpProjection(options.sessionId),
      configOptions: [],
    };
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): AcpSessionControllerSnapshot => this.snapshot;

  async connect(): Promise<void> {
    if (this.snapshot.ready) return;
    if (this.connecting) return this.connecting;
    this.connecting = this.open();
    try {
      await this.connecting;
    } finally {
      this.connecting = null;
    }
  }

  private async open(): Promise<void> {
    this.patch({ connection: 'connecting', error: null });
    if (!this.stream) {
      this.stream = this.client.connect({
        onEvent: (event) => this.onEnvelope(event.envelope),
        onError: (error) => {
          if (!(error instanceof AcpTransportError) || !error.terminal) return;
          this.patch({
            ready: false,
            connection: 'error',
            error: error instanceof Error ? error : new Error(String(error)),
          });
        },
      });
    }
    try {
      await this.stream.ready;
      const loaded = await this.client.loadSession({
        sessionId: this.options.sessionId,
        cwd: this.options.cwd ?? '/workspace',
      });
      const configOptions = Array.isArray(loaded.configOptions)
        ? loaded.configOptions.filter(isObject)
        : [];
      this.patch({
        ready: true,
        connection: 'open',
        configOptions,
        projection: {
          ...this.snapshot.projection,
          configOptions,
        },
      });
    } catch (error) {
      this.patch({
        ready: false,
        connection: 'error',
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  async send(
    prompt: AcpContentBlock[],
    options: { model?: string | null; agent?: string | null } = {},
  ): Promise<void> {
    if (!this.snapshot.ready) await this.connect();
    const text = prompt
      .filter((part): part is Extract<AcpContentBlock, { type: 'text' }> => part.type === 'text')
      .map((part) => part.text)
      .join('');
    if (text) {
      this.onEnvelope({
        jsonrpc: '2.0',
        method: 'session/update',
        params: {
          sessionId: this.options.sessionId,
          update: {
            sessionUpdate: 'user_message_chunk',
            content: { type: 'text', text },
          },
        },
      });
    }
    this.patch({ sending: true, error: null });
    try {
      if (options.model) {
        await this.client.setSessionConfigOption(this.options.sessionId, 'model', options.model);
      }
      if (options.agent) {
        await this.client.setSessionConfigOption(this.options.sessionId, 'mode', options.agent);
      }
      const result = await this.client.prompt(this.options.sessionId, prompt);
      this.onEnvelope({
        jsonrpc: '2.0',
        id: `prompt:${Date.now()}`,
        result,
      });
    } catch (error) {
      this.patch({
        error: error instanceof Error ? error : new Error(String(error)),
        projection: {
          ...this.snapshot.projection,
          status: { type: 'idle' },
        },
      });
      throw error;
    } finally {
      this.patch({ sending: false });
    }
  }

  async cancel(): Promise<void> {
    await this.client.cancel(this.options.sessionId);
    this.patch({
      projection: {
        ...this.snapshot.projection,
        status: { type: 'idle' },
        permissions: [],
        questions: [],
      },
    });
  }

  async runCommand(
    command: string,
    args: string,
    options: { model?: string | null; agent?: string | null } = {},
  ): Promise<void> {
    const normalized = command.replace(/^\/+/, '').toLowerCase();
    if (normalized === 'undo' || normalized === 'redo') {
      throw new Error(`OpenCode ACP does not support /${normalized}`);
    }
    const text = `/${normalized}${args.trim() ? ` ${args.trim()}` : ''}`;
    await this.send([{ type: 'text', text }], options);
  }

  async answerPermission(requestId: string, reply: 'once' | 'always' | 'reject'): Promise<void> {
    const params = this.openRequests.get(requestId) ?? {};
    const optionId = selectedPermissionOption(params, reply);
    if (reply === 'reject' && !optionId) {
      const result = { outcome: { outcome: 'cancelled' } };
      await this.client.respond(requestId, result);
      this.onEnvelope({ jsonrpc: '2.0', id: requestId, result });
      return;
    }
    if (!optionId) {
      throw new Error(`ACP permission request ${requestId} has no compatible ${reply} option`);
    }
    const result = {
      outcome: { outcome: 'selected', optionId },
    };
    await this.client.respond(requestId, result);
    this.onEnvelope({ jsonrpc: '2.0', id: requestId, result });
  }

  async answerQuestion(requestId: string, answers: string[][]): Promise<void> {
    const params = this.openRequests.get(requestId) ?? {};
    const result = {
      action: 'accept',
      content: questionContent(params, answers),
    };
    await this.client.respond(requestId, result);
    this.onEnvelope({ jsonrpc: '2.0', id: requestId, result });
  }

  async rejectQuestion(requestId: string): Promise<void> {
    const result = { action: 'decline' };
    await this.client.respond(requestId, result);
    this.onEnvelope({ jsonrpc: '2.0', id: requestId, result });
  }

  close(): void {
    this.stream?.close();
    this.stream = null;
    this.patch({ connection: 'closed', ready: false });
  }

  private onEnvelope(envelope: AcpEnvelope): void {
    if ('method' in envelope && 'id' in envelope && isObject(envelope.params)) {
      this.openRequests.set(String(envelope.id), envelope.params);
    } else if ('id' in envelope && !('method' in envelope)) {
      this.openRequests.delete(String(envelope.id));
    }
    const projection = applyAcpEnvelope(this.snapshot.projection, envelope);
    if (projection !== this.snapshot.projection) this.patch({ projection });
  }

  private patch(value: Partial<AcpSessionControllerSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...value };
    for (const listener of this.listeners) listener();
  }
}

export function createAcpSessionController(
  options: AcpSessionControllerOptions,
): AcpSessionController {
  return new AcpSessionController(options);
}

export type AcpSessionClientInstance = AcpClient;
