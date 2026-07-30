import { describe, expect, test } from 'bun:test';

import { type AcpProjection, applyAcpEnvelope, createAcpProjection } from './projection';

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
  test('projects persisted client session/prompt envelopes as user messages', () => {
    const state = applyAcpEnvelope(createAcpProjection('native-1'), {
      jsonrpc: '2.0',
      id: 'prompt-1',
      method: 'session/prompt',
      params: {
        sessionId: 'native-1',
        prompt: [
          { type: 'text', text: 'first ' },
          { type: 'text', text: 'question' },
        ],
      },
    });

    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]?.info.role).toBe('user');
    expect(state.messages[0]?.parts).toMatchObject([{ type: 'text', text: 'first question' }]);
  });

  test('preserves OpenCode message ids from ACP transcript replay', () => {
    let state = createAcpProjection('ses_1');
    state = update(state, 'user_message_chunk', {
      messageId: 'msg_user_1',
      content: { type: 'text', text: 'first prompt' },
    });
    state = update(state, 'agent_message_chunk', {
      messageId: 'msg_assistant_1',
      content: { type: 'text', text: 'first answer' },
    });
    state = update(state, 'user_message_chunk', {
      messageId: 'msg_user_2',
      content: { type: 'text', text: 'second prompt' },
    });

    expect(state.messages.map((message) => message.info.id)).toEqual([
      'msg_user_1',
      'msg_assistant_1',
      'msg_user_2',
    ]);
  });

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

    expect(state.messages.map((message) => message.info.role)).toEqual(['user', 'assistant']);
    expect(state.messages[0]?.parts).toMatchObject([{ type: 'text', text: 'hello' }]);
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

  test('appends an unscoped text chunk that arrives after the prompt result', () => {
    let state = createAcpProjection('ses_1');
    state = update(state, 'user_message_chunk', {
      content: { type: 'text', text: 'reply exactly' },
    });
    state = update(state, 'agent_message_chunk', {
      content: { type: 'text', text: 'PI_FIRST_' },
    });
    state = applyAcpEnvelope(state, {
      jsonrpc: '2.0',
      id: 'prompt-1',
      result: { stopReason: 'end_turn' },
    });
    state = update(state, 'agent_message_chunk', {
      content: { type: 'text', text: '123' },
    });

    expect(state.messages).toHaveLength(2);
    expect(state.messages[1]?.parts).toMatchObject([
      { type: 'text', text: 'PI_FIRST_123' },
      { type: 'step-finish', reason: 'end_turn' },
    ]);
    expect(state.messages[1]?.info.time).toMatchObject({
      completed: expect.any(Number),
    });
    expect(state.status).toEqual({ type: 'idle' });
  });

  test('preserves upstream message boundaries across one ACP prompt', () => {
    let state = createAcpProjection('ses_1');
    state = update(state, 'user_message_chunk', {
      messageId: 'msg_user_1',
      content: { type: 'text', text: 'Research Marko' },
    });
    state = update(state, 'agent_thought_chunk', {
      messageId: 'msg_assistant_1',
      content: { type: 'text', text: 'First thought. ' },
    });
    state = update(state, 'agent_message_chunk', {
      messageId: 'msg_assistant_1',
      content: { type: 'text', text: 'First update.' },
    });
    state = update(state, 'tool_call', {
      toolCallId: 'call_1',
      title: 'web_search',
      kind: 'other',
      status: 'pending',
      rawInput: { query: 'Marko' },
    });
    state = update(state, 'agent_thought_chunk', {
      messageId: 'msg_assistant_2',
      content: { type: 'text', text: 'Second thought.' },
    });
    state = update(state, 'agent_message_chunk', {
      messageId: 'msg_assistant_2',
      content: { type: 'text', text: 'Second update.' },
    });
    state = update(state, 'agent_message_chunk', {
      messageId: 'msg_assistant_3',
      content: { type: 'text', text: 'Third update.' },
    });

    expect(state.messages.map((message) => message.info.id)).toEqual([
      'msg_user_1',
      'msg_assistant_1',
      'msg_assistant_2',
      'msg_assistant_3',
    ]);
    expect(state.messages.map((message) => message.info.role)).toEqual([
      'user',
      'assistant',
      'assistant',
      'assistant',
    ]);
    expect(state.messages[1]?.info).toMatchObject({
      parentID: 'msg_user_1',
      time: { completed: expect.any(Number) },
    });
    expect(state.messages[1]?.parts).toMatchObject([
      { type: 'reasoning', text: 'First thought. ' },
      { type: 'text', text: 'First update.' },
      { type: 'tool', callID: 'call_1' },
    ]);
    expect(state.messages[2]?.info).toMatchObject({
      parentID: 'msg_user_1',
      time: { completed: expect.any(Number) },
    });
    expect(state.messages[2]?.parts).toMatchObject([
      { type: 'reasoning', text: 'Second thought.' },
      { type: 'text', text: 'Second update.' },
    ]);
    expect(state.messages[3]?.info).toMatchObject({
      parentID: 'msg_user_1',
    });
    expect(
      state.messages[3] && 'completed' in state.messages[3].info.time
        ? state.messages[3].info.time.completed
        : undefined,
    ).toBeUndefined();
    expect(state.messages[3]?.parts).toMatchObject([{ type: 'text', text: 'Third update.' }]);
  });

  test('routes late tool updates to the assistant message that owns the call', () => {
    let state = createAcpProjection('ses_1');
    state = update(state, 'agent_message_chunk', {
      messageId: 'msg_assistant_1',
      content: { type: 'text', text: 'Searching.' },
    });
    state = update(state, 'tool_call', {
      toolCallId: 'call_1',
      title: 'web_search',
      kind: 'other',
      status: 'pending',
      rawInput: { query: 'Marko' },
    });
    state = update(state, 'agent_message_chunk', {
      messageId: 'msg_assistant_2',
      content: { type: 'text', text: 'Still working.' },
    });
    state = update(state, 'tool_call_update', {
      toolCallId: 'call_1',
      status: 'completed',
      rawOutput: { output: 'Found' },
    });

    expect(state.messages).toHaveLength(2);
    expect(state.messages[0]?.parts).toMatchObject([
      { type: 'text', text: 'Searching.' },
      {
        type: 'tool',
        callID: 'call_1',
        state: { status: 'completed', output: 'Found' },
      },
    ]);
    expect(state.messages[1]?.parts).toMatchObject([{ type: 'text', text: 'Still working.' }]);
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

  test('preserves native tool names instead of ACP protocol kinds', () => {
    let state = createAcpProjection('ses_1');
    state = update(state, 'tool_call', {
      toolCallId: 'bash_1',
      title: 'bash',
      kind: 'execute',
      status: 'pending',
      rawInput: {},
    });
    state = update(state, 'tool_call_update', {
      toolCallId: 'bash_1',
      title: 'ls -la /workspace',
      kind: 'execute',
      status: 'in_progress',
      rawInput: { command: 'ls -la /workspace' },
    });
    state = update(state, 'tool_call_update', {
      toolCallId: 'bash_1',
      title: 'ls -la /workspace',
      kind: 'execute',
      status: 'completed',
      rawOutput: { output: 'README.md' },
    });
    state = update(state, 'tool_call', {
      toolCallId: 'todo_1',
      title: 'todowrite',
      kind: 'other',
      status: 'pending',
      rawInput: {},
    });
    state = update(state, 'tool_call_update', {
      toolCallId: 'todo_1',
      title: '2 todos',
      kind: 'other',
      status: 'completed',
      rawInput: {
        todos: [
          { content: 'Research', status: 'completed' },
          { content: 'Create deck', status: 'completed' },
        ],
      },
      rawOutput: [],
    });
    state = update(state, 'tool_call', {
      toolCallId: 'show_1',
      title: 'show',
      kind: 'other',
      status: 'pending',
      rawInput: {},
    });
    state = update(state, 'tool_call_update', {
      toolCallId: 'show_1',
      title: 'show',
      kind: 'other',
      status: 'completed',
      rawOutput: { success: true },
    });

    expect(state.messages[0]?.parts).toMatchObject([
      {
        type: 'tool',
        tool: 'bash',
        state: {
          status: 'completed',
          title: 'ls -la /workspace',
          input: { command: 'ls -la /workspace' },
          output: 'README.md',
        },
      },
      {
        type: 'tool',
        tool: 'todowrite',
        state: {
          status: 'completed',
          title: '2 todos',
          input: {
            todos: [
              { content: 'Research', status: 'completed' },
              { content: 'Create deck', status: 'completed' },
            ],
          },
        },
      },
      {
        type: 'tool',
        tool: 'show',
        state: {
          status: 'completed',
          title: 'Show Output',
        },
      },
    ]);
  });

  test('projects item plan updates and plan removal', () => {
    let state = createAcpProjection('ses_1');
    state = update(state, 'plan_update', {
      plan: {
        type: 'items',
        planId: 'plan-1',
        entries: [
          { content: 'Inspect', status: 'completed', priority: 'high' },
          { content: 'Verify', status: 'pending', priority: 'medium' },
        ],
      },
    });
    expect(state.todos).toEqual([
      { content: 'Inspect', status: 'completed', priority: 'high' },
      { content: 'Verify', status: 'pending', priority: 'medium' },
    ]);

    state = update(state, 'plan_removed', { planId: 'plan-1' });
    expect(state.todos).toEqual([]);
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

  test('projects command, mode, config, session information, and usage updates', () => {
    let state = createAcpProjection('ses_1');
    state = update(state, 'available_commands_update', {
      availableCommands: [{ name: 'review', description: 'Review changes' }],
    });
    state = update(state, 'current_mode_update', {
      currentModeId: 'plan',
    });
    state = update(state, 'config_option_update', {
      configOptions: [{ id: 'model', currentValue: 'kortix/glm-5.2' }],
    });
    state = update(state, 'session_info_update', {
      title: 'ACP session',
      updatedAt: '2026-07-25T00:00:00.000Z',
    });
    state = update(state, 'usage_update', {
      used: 1024,
      size: 8192,
      cost: { amount: 0.04, currency: 'USD' },
    });

    expect(state.availableCommands).toEqual([{ name: 'review', description: 'Review changes' }]);
    expect(state.currentModeId).toBe('plan');
    expect(state.configOptions).toEqual([{ id: 'model', currentValue: 'kortix/glm-5.2' }]);
    expect(state.sessionInfo).toEqual({
      title: 'ACP session',
      updatedAt: '2026-07-25T00:00:00.000Z',
    });
    expect(state.usage).toEqual({
      used: 1024,
      size: 8192,
      cost: { amount: 0.04, currency: 'USD' },
    });
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

  test('a newer assistant message terminalizes an unresolved tool from the previous message', () => {
    let state = createAcpProjection('ses_1');
    state = update(state, 'agent_thought_chunk', {
      messageId: 'msg_assistant_1',
      content: { type: 'text', text: 'Checking the files.' },
    });
    state = update(state, 'tool_call', {
      toolCallId: 'call_stale',
      title: 'bash',
      kind: 'execute',
      status: 'in_progress',
      rawInput: { command: 'test -f deck.pptx' },
    });
    state = update(state, 'agent_message_chunk', {
      messageId: 'msg_assistant_2',
      content: { type: 'text', text: 'The deck is complete.' },
    });

    const previousAssistant = state.messages[0];
    expect(previousAssistant?.info.role).toBe('assistant');
    if (previousAssistant?.info.role !== 'assistant') {
      throw new Error('Expected the first projected message to be an assistant message');
    }
    expect(previousAssistant.info.time.completed).toEqual(expect.any(Number));
    expect(state.messages[0]?.parts).toContainEqual(
      expect.objectContaining({
        type: 'tool',
        callID: 'call_stale',
        state: expect.objectContaining({
          status: 'completed',
          output: '',
          time: expect.objectContaining({ end: expect.any(Number) }),
        }),
      }),
    );
    expect(state.messages[1]?.info.id).toBe('msg_assistant_2');
  });
});

describe('ACP session/load replay de-duplication', () => {
  function load(projection: AcpProjection, id = 'load-1') {
    return applyAcpEnvelope(projection, {
      jsonrpc: '2.0',
      id,
      method: 'session/load',
      params: { sessionId: 'ses_1' },
    });
  }

  function textOf(message: { parts: Array<{ type: string }> } | undefined, type: string): string {
    return (message?.parts ?? [])
      .filter((part): part is { type: string; text: string } => part.type === type)
      .map((part) => part.text)
      .join('|');
  }

  test('a whole-message re-emission replaces the streamed text instead of appending', () => {
    let state = createAcpProjection('ses_1');
    state = update(state, 'user_message_chunk', {
      messageId: 'msg_user_1',
      content: { type: 'text', text: 'onboard me' },
    });
    state = update(state, 'agent_message_chunk', {
      messageId: 'msg_assistant_1',
      content: { type: 'text', text: 'Hello ' },
    });
    state = update(state, 'agent_message_chunk', {
      messageId: 'msg_assistant_1',
      content: { type: 'text', text: 'world' },
    });

    state = load(state);
    state = update(state, 'user_message_chunk', {
      messageId: 'msg_user_1',
      content: { type: 'text', text: 'onboard me' },
    });
    state = update(state, 'agent_message_chunk', {
      messageId: 'msg_assistant_1',
      content: { type: 'text', text: 'Hello world' },
    });

    expect(state.messages).toHaveLength(2);
    expect(textOf(state.messages[0], 'text')).toBe('onboard me');
    expect(textOf(state.messages[1], 'text')).toBe('Hello world');
  });

  test('a re-emitted reasoning and text pair duplicates neither part', () => {
    let state = createAcpProjection('ses_1');
    state = update(state, 'user_message_chunk', {
      messageId: 'msg_user_1',
      content: { type: 'text', text: 'go' },
    });
    state = update(state, 'agent_thought_chunk', {
      messageId: 'msg_assistant_1',
      content: { type: 'text', text: 'thinking hard' },
    });
    state = update(state, 'agent_message_chunk', {
      messageId: 'msg_assistant_1',
      content: { type: 'text', text: 'the answer' },
    });

    state = load(state);
    state = update(state, 'user_message_chunk', {
      messageId: 'msg_user_1',
      content: { type: 'text', text: 'go' },
    });
    state = update(state, 'agent_thought_chunk', {
      messageId: 'msg_assistant_1',
      content: { type: 'text', text: 'thinking hard' },
    });
    state = update(state, 'agent_message_chunk', {
      messageId: 'msg_assistant_1',
      content: { type: 'text', text: 'the answer' },
    });

    expect(state.messages).toHaveLength(2);
    expect(textOf(state.messages[1], 'reasoning')).toBe('thinking hard');
    expect(textOf(state.messages[1], 'text')).toBe('the answer');
  });

  test('eleven copies of one conversation project exactly one copy of each message', () => {
    let state = createAcpProjection('ses_1');
    state = applyAcpEnvelope(state, {
      jsonrpc: '2.0',
      id: 'prompt-1',
      method: 'session/prompt',
      params: { sessionId: 'ses_1', prompt: [{ type: 'text', text: 'onboard me' }] },
    });
    state = update(state, 'agent_thought_chunk', {
      messageId: 'msg_assistant_1',
      content: { type: 'text', text: 'reading the repo' },
    });
    state = update(state, 'agent_message_chunk', {
      messageId: 'msg_assistant_1',
      content: { type: 'text', text: 'Hello ' },
    });
    state = update(state, 'tool_call', {
      toolCallId: 'call_1',
      title: 'bash',
      kind: 'execute',
      status: 'pending',
      rawInput: { command: 'ls' },
    });
    state = update(state, 'tool_call_update', {
      toolCallId: 'call_1',
      status: 'completed',
      rawOutput: { output: 'README.md' },
    });
    state = update(state, 'agent_message_chunk', {
      messageId: 'msg_assistant_1',
      content: { type: 'text', text: 'world' },
    });
    state = applyAcpEnvelope(state, {
      jsonrpc: '2.0',
      id: 'prompt-1',
      result: { stopReason: 'end_turn' },
    });

    for (let attempt = 0; attempt < 10; attempt += 1) {
      state = load(state, `load-${String(attempt)}`);
      state = update(state, 'user_message_chunk', {
        messageId: 'msg_user_1',
        content: { type: 'text', text: 'onboard me' },
      });
      state = update(state, 'agent_thought_chunk', {
        messageId: 'msg_assistant_1',
        content: { type: 'text', text: 'reading the repo' },
      });
      state = update(state, 'agent_message_chunk', {
        messageId: 'msg_assistant_1',
        content: { type: 'text', text: 'Hello world' },
      });
      state = update(state, 'tool_call', {
        toolCallId: 'call_1',
        title: 'bash',
        kind: 'execute',
        status: 'pending',
        rawInput: { command: 'ls' },
      });
    }

    expect(state.messages.map((message) => message.info.role)).toEqual(['user', 'assistant']);
    expect(state.messages.map((message) => message.info.id)).toEqual([
      'msg_user_1',
      'msg_assistant_1',
    ]);
    expect(textOf(state.messages[0], 'text')).toBe('onboard me');
    expect(textOf(state.messages[1], 'reasoning')).toBe('reading the repo');
    expect(textOf(state.messages[1], 'text')).toBe('Hello world');
    expect(state.messages[1]?.parts.filter((part) => part.type === 'tool')).toMatchObject([
      {
        callID: 'call_1',
        tool: 'bash',
        state: { status: 'completed', output: 'README.md' },
      },
    ]);
  });

  test('a re-emission truncated by a killed process keeps the longest version', () => {
    let state = createAcpProjection('ses_1');
    state = update(state, 'user_message_chunk', {
      messageId: 'msg_user_1',
      content: { type: 'text', text: 'go' },
    });
    state = update(state, 'agent_message_chunk', {
      messageId: 'msg_assistant_1',
      content: { type: 'text', text: 'the complete answer' },
    });

    state = load(state);
    state = update(state, 'user_message_chunk', {
      messageId: 'msg_user_1',
      content: { type: 'text', text: 'go' },
    });
    state = update(state, 'agent_message_chunk', {
      messageId: 'msg_assistant_1',
      content: { type: 'text', text: 'the compl' },
    });

    expect(textOf(state.messages[1], 'text')).toBe('the complete answer');
  });

  test('a re-emission that completes a truncated stream wins', () => {
    let state = createAcpProjection('ses_1');
    state = update(state, 'user_message_chunk', {
      messageId: 'msg_user_1',
      content: { type: 'text', text: 'go' },
    });
    state = update(state, 'agent_message_chunk', {
      messageId: 'msg_assistant_1',
      content: { type: 'text', text: 'the compl' },
    });

    state = load(state);
    state = update(state, 'user_message_chunk', {
      messageId: 'msg_user_1',
      content: { type: 'text', text: 'go' },
    });
    state = update(state, 'agent_message_chunk', {
      messageId: 'msg_assistant_1',
      content: { type: 'text', text: 'the complete answer' },
    });

    expect(textOf(state.messages[1], 'text')).toBe('the complete answer');
  });

  test('a re-emission delivered in several chunks still lands once', () => {
    let state = createAcpProjection('ses_1');
    state = update(state, 'user_message_chunk', {
      messageId: 'msg_user_1',
      content: { type: 'text', text: 'go' },
    });
    state = update(state, 'agent_message_chunk', {
      messageId: 'msg_assistant_1',
      content: { type: 'text', text: 'one two three' },
    });

    state = load(state);
    state = update(state, 'user_message_chunk', {
      messageId: 'msg_user_1',
      content: { type: 'text', text: 'go' },
    });
    state = update(state, 'agent_message_chunk', {
      messageId: 'msg_assistant_1',
      content: { type: 'text', text: 'one ' },
    });
    state = update(state, 'agent_message_chunk', {
      messageId: 'msg_assistant_1',
      content: { type: 'text', text: 'two ' },
    });
    state = update(state, 'agent_message_chunk', {
      messageId: 'msg_assistant_1',
      content: { type: 'text', text: 'three' },
    });

    expect(textOf(state.messages[1], 'text')).toBe('one two three');
  });

  test('a replayed tool call never downgrades a terminal status or drops its output', () => {
    let state = createAcpProjection('ses_1');
    state = update(state, 'agent_message_chunk', {
      messageId: 'msg_assistant_1',
      content: { type: 'text', text: 'running' },
    });
    state = update(state, 'tool_call', {
      toolCallId: 'call_1',
      title: 'bash',
      kind: 'execute',
      status: 'pending',
      rawInput: { command: 'ls' },
    });
    state = update(state, 'tool_call_update', {
      toolCallId: 'call_1',
      status: 'completed',
      rawOutput: { output: 'README.md' },
    });
    state = update(state, 'tool_call', {
      toolCallId: 'call_1',
      title: 'bash',
      kind: 'execute',
      status: 'pending',
      rawInput: { command: 'ls' },
    });

    expect(state.messages[0]?.parts.filter((part) => part.type === 'tool')).toMatchObject([
      {
        callID: 'call_1',
        tool: 'bash',
        state: { status: 'completed', output: 'README.md' },
      },
    ]);
  });

  test('a replayed failed tool call keeps the error status', () => {
    let state = createAcpProjection('ses_1');
    state = update(state, 'agent_message_chunk', {
      messageId: 'msg_assistant_1',
      content: { type: 'text', text: 'running' },
    });
    state = update(state, 'tool_call', {
      toolCallId: 'call_1',
      title: 'bash',
      kind: 'execute',
      status: 'failed',
      rawOutput: { output: 'exit 1' },
    });
    state = update(state, 'tool_call_update', {
      toolCallId: 'call_1',
      status: 'in_progress',
    });

    expect(state.messages[0]?.parts.filter((part) => part.type === 'tool')).toMatchObject([
      { callID: 'call_1', state: { status: 'error', error: 'exit 1' } },
    ]);
  });

  test('genuinely consecutive assistant messages with different ids are both kept', () => {
    let state = createAcpProjection('ses_1');
    state = update(state, 'user_message_chunk', {
      messageId: 'msg_user_1',
      content: { type: 'text', text: 'go' },
    });
    state = update(state, 'agent_message_chunk', {
      messageId: 'msg_assistant_1',
      content: { type: 'text', text: 'same text' },
    });
    state = update(state, 'agent_message_chunk', {
      messageId: 'msg_assistant_2',
      content: { type: 'text', text: 'same text' },
    });

    expect(state.messages.map((message) => message.info.id)).toEqual([
      'msg_user_1',
      'msg_assistant_1',
      'msg_assistant_2',
    ]);
    expect(textOf(state.messages[1], 'text')).toBe('same text');
    expect(textOf(state.messages[2], 'text')).toBe('same text');
  });

  test('live incremental streaming still accumulates around an interleaved tool call', () => {
    let state = createAcpProjection('ses_1');
    state = update(state, 'user_message_chunk', {
      messageId: 'msg_user_1',
      content: { type: 'text', text: 'go' },
    });
    state = update(state, 'agent_thought_chunk', {
      messageId: 'msg_assistant_1',
      content: { type: 'text', text: 'plan' },
    });
    for (const chunk of ['I ', 'am ', 'streaming']) {
      state = update(state, 'agent_message_chunk', {
        messageId: 'msg_assistant_1',
        content: { type: 'text', text: chunk },
      });
      state = update(state, 'tool_call_update', {
        toolCallId: 'call_1',
        status: 'in_progress',
        title: 'bash',
        kind: 'execute',
      });
    }
    state = update(state, 'agent_thought_chunk', {
      messageId: 'msg_assistant_1',
      content: { type: 'text', text: 'ning' },
    });

    expect(textOf(state.messages[1], 'text')).toBe('I am streaming');
    expect(textOf(state.messages[1], 'reasoning')).toBe('planning');
  });
});

describe('ACP turn liveness', () => {
  function prompt(projection: AcpProjection, id: string, text: string) {
    return applyAcpEnvelope(projection, {
      jsonrpc: '2.0',
      id,
      method: 'session/prompt',
      params: { sessionId: 'ses_1', prompt: [{ type: 'text', text }] },
    });
  }

  function response(projection: AcpProjection, id: string, result: Record<string, unknown>) {
    return applyAcpEnvelope(projection, { jsonrpc: '2.0', id, result });
  }

  test('history replayed without a terminal prompt response settles the turn', () => {
    let state = createAcpProjection('ses_1');
    state = update(state, 'user_message_chunk', {
      content: { type: 'text', text: 'onboard me' },
    });
    state = update(state, 'agent_thought_chunk', {
      content: { type: 'text', text: 'reading the repo' },
    });
    state = update(state, 'tool_call', {
      toolCallId: 'call_1',
      title: 'read',
      kind: 'read',
      status: 'pending',
    });
    state = update(state, 'tool_call_update', {
      toolCallId: 'call_1',
      status: 'completed',
      rawOutput: { output: 'ok' },
    });
    state = update(state, 'agent_message_chunk', {
      content: { type: 'text', text: 'here is the summary' },
    });

    expect(state.status).toEqual({ type: 'idle' });
    expect(state.pendingPrompts).toEqual([]);
  });

  test('a completed turn re-emitted as fresh session/update history stays settled', () => {
    let state = createAcpProjection('ses_1');
    state = prompt(state, '1785365003374', 'onboard me');
    state = update(state, 'agent_message_chunk', {
      content: { type: 'text', text: 'here is the summary' },
    });
    state = response(state, '1785365003374', {
      stopReason: 'end_turn',
      usage: { inputTokens: 1670, outputTokens: 241 },
    });

    expect(state.status).toEqual({ type: 'idle' });

    state = update(state, 'user_message_chunk', {
      content: { type: 'text', text: 'onboard me' },
    });
    state = update(state, 'agent_thought_chunk', {
      content: { type: 'text', text: 'reading the repo' },
    });
    state = update(state, 'agent_message_chunk', {
      content: { type: 'text', text: 'here is the summary' },
    });

    expect(state.status).toEqual({ type: 'idle' });
    expect(state.pendingPrompts).toEqual([]);
  });

  test('an unanswered session/prompt marks the turn active until its response arrives', () => {
    let state = prompt(createAcpProjection('ses_1'), 'prompt-1', 'build the deck');

    expect(state.status).toEqual({ type: 'busy' });
    expect(state.pendingPrompts).toEqual(['prompt-1']);

    state = update(state, 'agent_message_chunk', {
      content: { type: 'text', text: 'working' },
    });

    expect(state.status).toEqual({ type: 'busy' });

    state = response(state, 'prompt-1', { stopReason: 'end_turn' });

    expect(state.status).toEqual({ type: 'idle' });
    expect(state.pendingPrompts).toEqual([]);
  });

  test('a prompt that never answered settles when a client re-attaches to the runtime', () => {
    let state = prompt(createAcpProjection('ses_1'), 'prompt-1', 'build the deck');
    state = update(state, 'agent_thought_chunk', {
      content: { type: 'text', text: 'thinking' },
    });

    expect(state.status).toEqual({ type: 'busy' });

    state = applyAcpEnvelope(state, {
      jsonrpc: '2.0',
      id: 'init-1',
      method: 'initialize',
      params: { protocolVersion: 1 },
    });

    expect(state.status).toEqual({ type: 'idle' });
    expect(state.pendingPrompts).toEqual([]);
  });

  test('a prompt rejected with a JSON-RPC error settles the turn', () => {
    let state = prompt(createAcpProjection('ses_1'), 'prompt-1', 'build the deck');
    state = applyAcpEnvelope(state, {
      jsonrpc: '2.0',
      id: 'prompt-1',
      error: { code: -32603, message: 'harness crashed' },
    });

    expect(state.status).toEqual({ type: 'idle' });
    expect(state.pendingPrompts).toEqual([]);
  });

  test('two overlapping prompts stay active until both answer', () => {
    let state = prompt(createAcpProjection('ses_1'), 'prompt-1', 'first');
    state = prompt(state, 'prompt-2', 'second');

    expect(state.pendingPrompts).toEqual(['prompt-1', 'prompt-2']);

    state = response(state, 'prompt-1', { stopReason: 'end_turn' });

    expect(state.status).toEqual({ type: 'busy' });

    state = response(state, 'prompt-2', { stopReason: 'end_turn' });

    expect(state.status).toEqual({ type: 'idle' });
  });
});

describe('ACP transcript sequence fidelity', () => {
  function load(projection: AcpProjection, id = 'load-1') {
    return applyAcpEnvelope(projection, {
      jsonrpc: '2.0',
      id,
      method: 'session/load',
      params: { sessionId: 'ses_1' },
    });
  }

  function user(projection: AcpProjection, messageId: string, text: string) {
    return update(projection, 'user_message_chunk', {
      messageId,
      content: { type: 'text', text },
    });
  }

  function agent(projection: AcpProjection, messageId: string, text: string) {
    return update(projection, 'agent_message_chunk', {
      messageId,
      content: { type: 'text', text },
    });
  }

  function shape(projection: AcpProjection): string {
    return JSON.stringify(
      projection.messages.map((message) => ({
        id: message.info.id,
        role: message.info.role,
        parts: message.parts.map((part) => ({
          type: part.type,
          text: 'text' in part ? part.text : undefined,
          callID: 'callID' in part ? part.callID : undefined,
        })),
      })),
    );
  }

  test('a user message first seen in a replay sorts before the assistant reply it prompted', () => {
    let state = createAcpProjection('ses_1');
    state = agent(state, 'msg_assistant_1', 'the answer');

    state = load(state);
    state = user(state, 'msg_user_1', 'the question');
    state = agent(state, 'msg_assistant_1', 'the answer');

    expect(state.messages.map((message) => message.info.id)).toEqual([
      'msg_user_1',
      'msg_assistant_1',
    ]);
    expect(state.messages.map((message) => message.info.role)).toEqual(['user', 'assistant']);
  });

  test('a replay orders every canonical message by its replay position', () => {
    let state = createAcpProjection('ses_1');
    state = agent(state, 'msg_assistant_2', 'second answer');

    state = load(state);
    state = user(state, 'msg_user_1', 'first question');
    state = agent(state, 'msg_assistant_1', 'first answer');
    state = user(state, 'msg_user_2', 'second question');
    state = agent(state, 'msg_assistant_2', 'second answer');

    expect(state.messages.map((message) => message.info.id)).toEqual([
      'msg_user_1',
      'msg_assistant_1',
      'msg_user_2',
      'msg_assistant_2',
    ]);
  });

  test('a chunk flushed after the attach does not claim the head of the replayed history', () => {
    let state = createAcpProjection('ses_1');
    state = load(state);
    state = agent(state, 'msg_a2', 'the last answer');
    state = user(state, 'msg_u1', 'first question');
    state = agent(state, 'msg_a1', 'first answer');
    state = user(state, 'msg_u2', 'second question');
    state = agent(state, 'msg_a2', 'the last answer');

    expect(state.messages.map((message) => message.info.id)).toEqual([
      'msg_u1',
      'msg_a1',
      'msg_u2',
      'msg_a2',
    ]);
  });

  test('a replayed tool call stays inside the assistant message that made it', () => {
    let state = createAcpProjection('ses_1');
    state = agent(state, 'msg_assistant_1', 'answer');
    state = update(state, 'tool_call', { toolCallId: 'call_1', title: 'bash', kind: 'execute' });

    state = load(state);
    state = user(state, 'msg_user_1', 'question');
    state = agent(state, 'msg_assistant_1', 'answer');
    state = update(state, 'tool_call', { toolCallId: 'call_1', title: 'bash', kind: 'execute' });

    expect(state.messages.map((message) => message.info.id)).toEqual([
      'msg_user_1',
      'msg_assistant_1',
    ]);
    expect(
      state.messages[1]?.parts.filter((part) => part.type === 'tool').map((part) => part.callID),
    ).toEqual(['call_1']);
  });

  test('a prompt the harness never acknowledged stays after the replayed history', () => {
    let state = createAcpProjection('ses_1');
    state = applyAcpEnvelope(state, {
      jsonrpc: '2.0',
      id: 3,
      method: 'session/prompt',
      params: { sessionId: 'ses_1', prompt: [{ type: 'text', text: 'never landed' }] },
    });

    state = load(state);
    state = user(state, 'msg_user_1', 'question');
    state = agent(state, 'msg_assistant_1', 'answer');

    expect(state.messages.map((message) => message.info.id)).toEqual([
      'msg_user_1',
      'msg_assistant_1',
      'acp-user-3',
    ]);
  });

  test('folding the same replay log twice yields an identical transcript', () => {
    const fold = () => {
      let state = createAcpProjection('ses_1');
      for (let pass = 0; pass < 2; pass += 1) {
        state = load(state, `load-${pass}`);
        state = user(state, 'msg_user_1', 'first question');
        state = update(state, 'agent_thought_chunk', {
          messageId: 'msg_assistant_1',
          content: { type: 'text', text: 'thinking' },
        });
        state = agent(state, 'msg_assistant_1', 'first answer');
        state = update(state, 'tool_call', {
          toolCallId: 'call_1',
          title: 'bash',
          kind: 'execute',
          status: 'completed',
        });
        state = user(state, 'msg_user_2', 'second question');
        state = agent(state, 'msg_assistant_2', 'second answer');
      }
      return state;
    };

    expect(shape(fold())).toBe(shape(fold()));
    expect(fold().messages.map((message) => message.info.id)).toEqual([
      'msg_user_1',
      'msg_assistant_1',
      'msg_user_2',
      'msg_assistant_2',
    ]);
  });

  test('live incremental streaming keeps its arrival order', () => {
    let state = createAcpProjection('ses_1');
    state = user(state, 'msg_user_1', 'go');
    for (const chunk of ['I ', 'am ', 'streaming']) {
      state = agent(state, 'msg_assistant_1', chunk);
    }
    state = user(state, 'msg_user_2', 'again');
    state = agent(state, 'msg_assistant_2', 'sure');

    expect(state.messages.map((message) => message.info.id)).toEqual([
      'msg_user_1',
      'msg_assistant_1',
      'msg_user_2',
      'msg_assistant_2',
    ]);
    expect(
      state.messages[1]?.parts
        .filter((part) => part.type === 'text')
        .map((part) => part.text)
        .join(''),
    ).toBe('I am streaming');
  });
});

describe('ACP reported token usage', () => {
  function turn(usage: Record<string, number>) {
    let state = applyAcpEnvelope(createAcpProjection('ses_1'), {
      jsonrpc: '2.0',
      id: 'prompt-1',
      method: 'session/prompt',
      params: { sessionId: 'ses_1', prompt: [{ type: 'text', text: 'go' }] },
    });
    state = update(state, 'agent_message_chunk', {
      messageId: 'msg_assistant_1',
      content: { type: 'text', text: 'done' },
    });
    return applyAcpEnvelope(state, {
      jsonrpc: '2.0',
      id: 'prompt-1',
      result: { stopReason: 'end_turn', usage },
    });
  }

  function tokensOf(projection: AcpProjection) {
    const info = projection.messages.at(-1)?.info;
    return info && info.role === 'assistant' ? info.tokens : null;
  }

  function reported(projection: AcpProjection): number {
    const tokens = tokensOf(projection);
    if (!tokens) return 0;
    return tokens.input + tokens.output + tokens.reasoning + tokens.cache.read + tokens.cache.write;
  }

  test('the reported total matches totalTokens when thinking is billed on top of output', () => {
    const state = turn({
      inputTokens: 5607,
      outputTokens: 13,
      thoughtTokens: 25,
      cachedReadTokens: 1792,
      totalTokens: 7437,
    });

    expect(reported(state)).toBe(7437);
    expect(tokensOf(state)?.reasoning).toBe(25);
  });

  test('the reported total matches totalTokens when thinking is billed inside output', () => {
    const state = turn({
      inputTokens: 7430,
      outputTokens: 18,
      thoughtTokens: 9,
      cachedReadTokens: 3456,
      totalTokens: 10904,
    });

    expect(reported(state)).toBe(10904);
    expect(tokensOf(state)?.reasoning).toBe(9);
  });

  test('cached write tokens stay inside the reported total', () => {
    const state = turn({
      inputTokens: 3,
      outputTokens: 9,
      cachedReadTokens: 0,
      cachedWriteTokens: 34914,
      totalTokens: 34926,
    });

    expect(reported(state)).toBe(34926);
    expect(tokensOf(state)?.cache.write).toBe(34914);
  });

  test('a usage payload without a total keeps every reported component', () => {
    const state = turn({
      inputTokens: 100,
      outputTokens: 20,
      thoughtTokens: 5,
      cachedReadTokens: 7,
    });

    expect(reported(state)).toBe(132);
  });

  test('the harness context report is projected for the meter', () => {
    let state = update(createAcpProjection('ses_1'), 'usage_update', {
      size: 200000,
      used: 30470,
      cost: { amount: 0, currency: 'USD' },
    });

    expect(state.contextWindow).toBe(200000);
    expect(state.contextUsed).toBe(30470);

    state = update(state, 'usage_update', { size: 200000, used: 0 });

    expect(state.contextUsed).toBe(30470);
  });

  test('usage lands on the last assistant message even when a user prompt follows it', () => {
    let state = update(createAcpProjection('ses_1'), 'agent_message_chunk', {
      messageId: 'msg_assistant_1',
      content: { type: 'text', text: 'done' },
    });
    state = applyAcpEnvelope(state, {
      jsonrpc: '2.0',
      id: 'prompt-2',
      method: 'session/prompt',
      params: { sessionId: 'ses_1', prompt: [{ type: 'text', text: 'next' }] },
    });
    state = applyAcpEnvelope(state, {
      jsonrpc: '2.0',
      id: 'prompt-1',
      result: {
        stopReason: 'end_turn',
        usage: {
          inputTokens: 169,
          outputTokens: 10,
          thoughtTokens: 22,
          cachedReadTokens: 7168,
          totalTokens: 7369,
        },
      },
    });

    const assistant = state.messages.find((message) => message.info.role === 'assistant');
    const tokens = assistant?.info.role === 'assistant' ? assistant.info.tokens : null;
    expect(tokens).not.toBeNull();
    expect(
      (tokens?.input ?? 0) +
        (tokens?.output ?? 0) +
        (tokens?.reasoning ?? 0) +
        (tokens?.cache.read ?? 0) +
        (tokens?.cache.write ?? 0),
    ).toBe(7369);
  });
});
