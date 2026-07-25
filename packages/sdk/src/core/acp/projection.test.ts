import { describe, expect, test } from 'bun:test';

import {
  applyAcpEnvelope,
  createAcpProjection,
  type AcpProjection,
} from './projection';

function update(
  projection: AcpProjection,
  sessionUpdate: string,
  fields: Record<string, unknown> = {},
) {
  return applyAcpEnvelope(projection, {
    jsonrpc: '2.0',
    method: 'session/update',
    params: {
      sessionId: 'ses_1',
      update: { sessionUpdate, ...fields },
    },
  });
}

describe('ACP to Kortix session projection', () => {
  test('projects user, thought, assistant, usage, and stop reason', () => {
    let state = createAcpProjection('ses_1');
    state = update(state, 'user_message_chunk', {
      content: { type: 'text', text: 'hello' },
    });
    state = update(state, 'agent_thought_chunk', {
      content: { type: 'text', text: 'think ' },
    });
    state = update(state, 'agent_thought_chunk', {
      content: { type: 'text', text: 'more' },
    });
    state = update(state, 'agent_message_chunk', {
      content: { type: 'text', text: 'ACP_' },
    });
    state = update(state, 'agent_message_chunk', {
      content: { type: 'text', text: 'PONG' },
    });
    state = applyAcpEnvelope(state, {
      jsonrpc: '2.0',
      id: 'prompt-1',
      result: {
        stopReason: 'end_turn',
        usage: {
          inputTokens: 10,
          outputTokens: 2,
          thoughtTokens: 3,
          cachedReadTokens: 4,
          cachedWriteTokens: 5,
        },
      },
    });

    expect(state.messages.map((message) => message.info.role)).toEqual([
      'user',
      'assistant',
    ]);
    expect(state.messages[0]?.parts).toMatchObject([
      { type: 'text', text: 'hello' },
    ]);
    expect(state.messages[1]?.parts).toMatchObject([
      { type: 'reasoning', text: 'think more' },
      { type: 'text', text: 'ACP_PONG' },
      {
        type: 'step-finish',
        reason: 'end_turn',
        tokens: {
          input: 10,
          output: 2,
          reasoning: 3,
          cache: { read: 4, write: 5 },
        },
      },
    ]);
    expect(state.status).toEqual({ type: 'idle' });
  });

  test('projects tool calls, tool updates, and plans', () => {
    let state = createAcpProjection('ses_1');
    state = update(state, 'tool_call', {
      toolCallId: 'call_1',
      title: 'Read file',
      kind: 'read',
      status: 'in_progress',
      rawInput: { path: 'README.md' },
    });
    state = update(state, 'tool_call_update', {
      toolCallId: 'call_1',
      status: 'completed',
      rawOutput: { content: 'ok' },
    });
    state = update(state, 'plan', {
      entries: [
        { content: 'Inspect', status: 'completed', priority: 'high' },
        { content: 'Change', status: 'in_progress', priority: 'medium' },
      ],
    });

    expect(state.messages[0]?.parts[0]).toMatchObject({
      type: 'tool',
      callID: 'call_1',
      tool: 'read',
      state: {
        status: 'completed',
        input: { path: 'README.md' },
        output: '{"content":"ok"}',
      },
    });
    expect(state.todos).toEqual([
      { content: 'Inspect', status: 'completed', priority: 'high' },
      { content: 'Change', status: 'in_progress', priority: 'medium' },
    ]);
  });

  test('tracks permission and question requests until a response closes them', () => {
    let state = createAcpProjection('ses_1');
    state = applyAcpEnvelope(state, {
      jsonrpc: '2.0',
      id: 'permission-1',
      method: 'session/request_permission',
      params: {
        sessionId: 'ses_1',
        toolCall: { toolCallId: 'call_1', title: 'Run command' },
        options: [
          { optionId: 'allow_once', name: 'Allow once', kind: 'allow_once' },
          { optionId: 'reject_once', name: 'Reject', kind: 'reject_once' },
        ],
      },
    });
    state = applyAcpEnvelope(state, {
      jsonrpc: '2.0',
      id: 'question-1',
      method: 'elicitation/create',
      params: {
        sessionId: 'ses_1',
        message: 'Choose one',
        requestedSchema: {
          type: 'object',
          properties: {
            choice: { type: 'string', enum: ['a', 'b'] },
          },
        },
      },
    });
    expect(state.permissions).toHaveLength(1);
    expect(state.questions).toHaveLength(1);

    state = applyAcpEnvelope(state, {
      jsonrpc: '2.0',
      id: 'permission-1',
      result: { outcome: { outcome: 'selected', optionId: 'allow_once' } },
    });
    state = applyAcpEnvelope(state, {
      jsonrpc: '2.0',
      id: 'question-1',
      result: { action: 'accept', content: { choice: 'a' } },
    });
    expect(state.permissions).toEqual([]);
    expect(state.questions).toEqual([]);
  });

  test('ignores updates for a different ACP session', () => {
    const state = createAcpProjection('ses_1');
    const next = applyAcpEnvelope(state, {
      jsonrpc: '2.0',
      method: 'session/update',
      params: {
        sessionId: 'ses_other',
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: 'leak' },
        },
      },
    });
    expect(next).toBe(state);
  });
});
