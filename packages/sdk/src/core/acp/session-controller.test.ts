import { describe, expect, test } from 'bun:test';

import { createAcpSessionController, type AcpSessionClient } from './session-controller';
import { AcpTransportError, type AcpEnvelope, type AcpStreamEvent } from './types';

function harness() {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  let emit: ((event: AcpStreamEvent) => void) | null = null;
  let emitError: ((error: unknown) => void) | null = null;
  const client: AcpSessionClient = {
    connect(options) {
      calls.push({ method: 'connect', args: [] });
      emit = options.onEvent;
      emitError = options.onError ?? null;
      return { close() {}, lastEventId: 0, ready: Promise.resolve() };
    },
    async loadSession(input) {
      calls.push({ method: 'loadSession', args: [input] });
      return {
        sessionId: input.sessionId,
        configOptions: [
          { id: 'model', currentValue: 'kortix/glm-5.2' },
          { id: 'mode', currentValue: 'build' },
        ],
      };
    },
    async setSessionConfigOption(sessionId, configId, value) {
      calls.push({
        method: 'setSessionConfigOption',
        args: [sessionId, configId, value],
      });
      return {};
    },
    async prompt(sessionId, prompt) {
      calls.push({ method: 'prompt', args: [sessionId, prompt] });
      emit?.({
        id: 1,
        envelope: {
          jsonrpc: '2.0',
          method: 'session/update',
          params: {
            sessionId,
            update: {
              sessionUpdate: 'agent_message_chunk',
              content: { type: 'text', text: 'PONG' },
            },
          },
        },
      });
      return {
        stopReason: 'end_turn',
        usage: { inputTokens: 1, outputTokens: 1 },
      };
    },
    async cancel(sessionId) {
      calls.push({ method: 'cancel', args: [sessionId] });
    },
    async respond(id, result) {
      calls.push({ method: 'respond', args: [id, result] });
    },
  };
  return {
    client,
    calls,
    emit(envelope: AcpEnvelope, id = 1) {
      emit?.({ id, envelope });
    },
    emitError(error: unknown) {
      emitError?.(error);
    },
  };
}

describe('ACP session controller', () => {
  test('opens the stream before loading the canonical OpenCode session', async () => {
    const h = harness();
    const controller = createAcpSessionController({
      sessionId: 'ses_1',
      client: h.client,
    });
    await controller.connect();

    expect(h.calls.slice(0, 2)).toEqual([
      { method: 'connect', args: [] },
      {
        method: 'loadSession',
        args: [{ sessionId: 'ses_1', cwd: '/workspace' }],
      },
    ]);
    expect(controller.getSnapshot().ready).toBe(true);
    expect(controller.getSnapshot().configOptions).toHaveLength(2);
  });

  test('projects transcript updates replayed during session/load', async () => {
    const h = harness();
    h.client.loadSession = async (input) => {
      h.emit({
        jsonrpc: '2.0',
        method: 'session/update',
        params: {
          sessionId: input.sessionId,
          update: {
            sessionUpdate: 'user_message_chunk',
            content: { type: 'text', text: 'previous question' },
          },
        },
      });
      h.emit({
        jsonrpc: '2.0',
        method: 'session/update',
        params: {
          sessionId: input.sessionId,
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: { type: 'text', text: 'previous answer' },
          },
        },
      });
      return {};
    };
    const controller = createAcpSessionController({
      sessionId: 'ses_1',
      client: h.client,
    });

    await controller.connect();

    expect(controller.getSnapshot().projection.messages).toMatchObject([
      {
        info: { role: 'user' },
        parts: [{ type: 'text', text: 'previous question' }],
      },
      {
        info: { role: 'assistant' },
        parts: [{ type: 'text', text: 'previous answer' }],
      },
    ]);
  });

  test('applies model and agent options before one ACP prompt', async () => {
    const h = harness();
    const controller = createAcpSessionController({
      sessionId: 'ses_1',
      client: h.client,
    });
    await controller.connect();
    await controller.send([{ type: 'text', text: 'ping' }], {
      model: 'kortix/glm-5.2',
      agent: 'reviewer',
    });

    expect(h.calls.slice(2)).toEqual([
      {
        method: 'setSessionConfigOption',
        args: ['ses_1', 'model', 'kortix/glm-5.2'],
      },
      {
        method: 'setSessionConfigOption',
        args: ['ses_1', 'mode', 'reviewer'],
      },
      {
        method: 'prompt',
        args: ['ses_1', [{ type: 'text', text: 'ping' }]],
      },
    ]);
    expect(controller.getSnapshot().projection.messages.at(-1)?.parts).toMatchObject([
      { type: 'text', text: 'PONG' },
      { type: 'step-finish', reason: 'end_turn' },
    ]);
  });

  test('answers ACP permission requests with the matching option id', async () => {
    const h = harness();
    const controller = createAcpSessionController({
      sessionId: 'ses_1',
      client: h.client,
    });
    await controller.connect();
    h.emit({
      jsonrpc: '2.0',
      id: 'permission-1',
      method: 'session/request_permission',
      params: {
        sessionId: 'ses_1',
        options: [
          { optionId: 'allow_once', kind: 'allow_once', name: 'Allow once' },
          { optionId: 'allow_always', kind: 'allow_always', name: 'Always' },
          { optionId: 'reject_once', kind: 'reject_once', name: 'Reject' },
        ],
      },
    });

    await controller.answerPermission('permission-1', 'always');
    expect(h.calls.at(-1)).toEqual({
      method: 'respond',
      args: ['permission-1', { outcome: { outcome: 'selected', optionId: 'allow_always' } }],
    });
    expect(controller.getSnapshot().projection.permissions).toEqual([]);
  });

  test('cancels a rejected permission request when no reject option exists', async () => {
    const h = harness();
    const controller = createAcpSessionController({
      sessionId: 'ses_1',
      client: h.client,
    });
    await controller.connect();
    h.emit({
      jsonrpc: '2.0',
      id: 'permission-1',
      method: 'session/request_permission',
      params: {
        sessionId: 'ses_1',
        options: [{ optionId: 'allow_once', kind: 'allow_once', name: 'Allow once' }],
      },
    });

    await controller.answerPermission('permission-1', 'reject');

    expect(h.calls.at(-1)).toEqual({
      method: 'respond',
      args: ['permission-1', { outcome: { outcome: 'cancelled' } }],
    });
    expect(controller.getSnapshot().projection.permissions).toEqual([]);
  });

  test('rejects an allow reply when no compatible allow option exists', async () => {
    const h = harness();
    const controller = createAcpSessionController({
      sessionId: 'ses_1',
      client: h.client,
    });
    await controller.connect();
    h.emit({
      jsonrpc: '2.0',
      id: 'permission-1',
      method: 'session/request_permission',
      params: {
        sessionId: 'ses_1',
        options: [{ optionId: 'reject_once', kind: 'reject_once', name: 'Reject' }],
      },
    });

    await expect(controller.answerPermission('permission-1', 'once')).rejects.toThrow(
      'ACP permission request permission-1 has no compatible once option',
    );
    expect(h.calls.filter((call) => call.method === 'respond')).toEqual([]);
  });

  test('ignores reconnectable stream errors and records terminal failures', async () => {
    const h = harness();
    const controller = createAcpSessionController({
      sessionId: 'ses_1',
      client: h.client,
    });
    await controller.connect();

    h.emitError(new AcpTransportError('temporary outage', 503, false));
    expect(controller.getSnapshot()).toMatchObject({
      connection: 'open',
      error: null,
    });

    h.emitError(new AcpTransportError('permission denied', 403, true));
    expect(controller.getSnapshot()).toMatchObject({
      connection: 'error',
      error: { message: 'permission denied' },
    });
  });

  test('returns explicit unsupported errors for undo and redo', async () => {
    const h = harness();
    const controller = createAcpSessionController({
      sessionId: 'ses_1',
      client: h.client,
    });
    await controller.connect();

    await expect(controller.runCommand('undo', '')).rejects.toThrow(
      'OpenCode ACP does not support /undo',
    );
    await expect(controller.runCommand('redo', '')).rejects.toThrow(
      'OpenCode ACP does not support /redo',
    );
  });

  test('records a prompt transport error in the controller snapshot', async () => {
    const h = harness();
    h.client.prompt = async () => {
      throw new Error('ACP prompt failed');
    };
    const controller = createAcpSessionController({
      sessionId: 'ses_1',
      client: h.client,
    });
    await controller.connect();

    await expect(controller.send([{ type: 'text', text: 'ping' }])).rejects.toThrow(
      'ACP prompt failed',
    );
    expect(controller.getSnapshot()).toMatchObject({
      sending: false,
      error: { message: 'ACP prompt failed' },
    });
  });
});
