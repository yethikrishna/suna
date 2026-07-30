import { describe, expect, test } from 'bun:test';

import type { StoredAcpEnvelope } from '../projects/lib/acp-transcript';
import { compactAcpEnvelopes, compactOpencodeMessages } from './compact-transcript';

const SCOPE = 'ses_scope_1';

let ordinal = 0;

function envelope(
  body: Record<string, unknown>,
  direction: StoredAcpEnvelope['direction'] = 'agent_to_client',
  createdAt = '2026-07-30T00:00:00.000Z',
): StoredAcpEnvelope {
  ordinal += 1;
  return { ordinal, direction, streamEventId: ordinal, envelope: body, createdAt };
}

function update(
  body: Record<string, unknown>,
  sessionId = SCOPE,
  createdAt?: string,
): StoredAcpEnvelope {
  return envelope(
    { jsonrpc: '2.0', method: 'session/update', params: { sessionId, update: body } },
    'agent_to_client',
    createdAt,
  );
}

function agentText(text: string, messageId: string, createdAt?: string): StoredAcpEnvelope {
  return update(
    { sessionUpdate: 'agent_message_chunk', messageId, content: { type: 'text', text } },
    SCOPE,
    createdAt,
  );
}

function userText(text: string, messageId: string): StoredAcpEnvelope {
  return update({
    sessionUpdate: 'user_message_chunk',
    messageId,
    content: { type: 'text', text },
  });
}

function thought(text: string, messageId: string): StoredAcpEnvelope {
  return update({
    sessionUpdate: 'agent_thought_chunk',
    messageId,
    content: { type: 'text', text },
  });
}

function toolCall(
  toolCallId: string,
  status: string,
  extra: Record<string, unknown> = {},
): StoredAcpEnvelope {
  return update({
    sessionUpdate: status === 'pending' ? 'tool_call' : 'tool_call_update',
    toolCallId,
    status,
    kind: 'search',
    title: 'glob',
    ...extra,
  });
}

function prompt(id: number | string, text: string, blocks: unknown[] = []): StoredAcpEnvelope {
  return envelope(
    {
      jsonrpc: '2.0',
      id,
      method: 'session/prompt',
      params: { sessionId: SCOPE, prompt: [{ type: 'text', text }, ...blocks] },
    },
    'client_to_agent',
  );
}

function promptResult(
  id: number | string,
  result: Record<string, unknown>,
  createdAt?: string,
): StoredAcpEnvelope {
  return envelope({ jsonrpc: '2.0', id, result }, 'agent_to_client', createdAt);
}

function options(overrides: Record<string, unknown> = {}) {
  return { acpSessionId: SCOPE, limit: 100, maxChars: 4000, ...overrides } as {
    acpSessionId: string | null;
    limit: number;
    maxChars: number;
  };
}

describe('compactOpencodeMessages', () => {
  test('joins text parts, drops synthetic text, keeps tool name+status and file name+mime', () => {
    const messages = compactOpencodeMessages(
      [
        {
          info: { role: 'assistant', time: { created: 1000, completed: 2000 } },
          parts: [
            { type: 'text', text: 'first line' },
            { type: 'text', text: 'second line' },
            { type: 'text', text: 'synthetic', synthetic: true },
            { type: 'tool', tool: 'bash', state: { status: 'completed', output: 'secret output' } },
            { type: 'file', filename: 'report.pdf', mime: 'application/pdf', content: 'base64' },
            { type: 'reasoning', text: 'internal thoughts' },
          ],
        },
      ],
      { limit: 40, maxChars: 700 },
    );

    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('assistant');
    expect(messages[0].text).toBe('first line second line');
    expect(messages[0].created).toBe('1970-01-01T00:00:01.000Z');
    expect(messages[0].completed).toBe('1970-01-01T00:00:02.000Z');
    expect(messages[0].tools).toEqual([{ tool: 'bash', status: 'completed' }]);
    expect(messages[0].files).toEqual([{ filename: 'report.pdf', mime: 'application/pdf' }]);
    expect(messages[0].reasoning_omitted).toBe(true);
    expect(messages[0].error).toBeNull();
    expect(JSON.stringify(messages[0])).not.toContain('secret output');
  });

  test('reads a { messages: [] } envelope and keeps only the last `limit` messages', () => {
    const payload = {
      messages: [1, 2, 3].map((n) => ({
        info: { role: 'user', time: {} },
        parts: [{ type: 'text', text: `m${n}` }],
      })),
    };
    const messages = compactOpencodeMessages(payload, { limit: 2, maxChars: 700 });
    expect(messages.map((m) => m.text)).toEqual(['m2', 'm3']);
  });

  test('truncates an overlong body with an ellipsis', () => {
    const messages = compactOpencodeMessages(
      [{ info: { role: 'user', time: {} }, parts: [{ type: 'text', text: 'x'.repeat(5000) }] }],
      { limit: 40, maxChars: 100 },
    );
    expect(messages[0].text).toHaveLength(100);
    expect(messages[0].text.endsWith('…')).toBe(true);
  });

  test('returns an empty list for a non-list payload', () => {
    expect(compactOpencodeMessages(null, { limit: 40, maxChars: 700 })).toEqual([]);
  });
});

describe('compactAcpEnvelopes', () => {
  test('returns an empty list when there are no envelopes', () => {
    expect(compactAcpEnvelopes([], options())).toEqual([]);
  });

  test('projects the prompt as a user message, agent chunks as assistant text, and tool calls', () => {
    const messages = compactAcpEnvelopes(
      [
        prompt(1, 'do the thing'),
        thought('planning', 'msg_a'),
        toolCall('call_1', 'pending'),
        toolCall('call_1', 'in_progress'),
        toolCall('call_1', 'completed'),
        agentText('all ', 'msg_b'),
        agentText('done', 'msg_b'),
        promptResult(1, { stopReason: 'end_turn' }, '2026-07-30T00:01:00.000Z'),
      ],
      options(),
    );

    expect(messages.map((m) => m.role)).toEqual(['user', 'assistant', 'assistant']);
    expect(messages[0].text).toBe('do the thing');
    expect(messages[1].reasoning_omitted).toBe(true);
    expect(messages[1].text).toBe('');
    expect(messages[1].tools).toEqual([{ tool: 'glob', status: 'completed' }]);
    expect(messages[2].text).toBe('all done');
    expect(messages[2].completed).toBe('2026-07-30T00:01:00.000Z');
  });

  test('a session/load replay of the same messageId does not duplicate or double the text', () => {
    const messages = compactAcpEnvelopes(
      [
        prompt(1, 'hello there'),
        agentText('one ', 'msg_a'),
        agentText('two', 'msg_a'),
        promptResult(1, { stopReason: 'end_turn' }),
        envelope(
          { jsonrpc: '2.0', id: 2, method: 'session/load', params: { sessionId: SCOPE } },
          'client_to_agent',
        ),
        userText('hello there', 'msg_u'),
        agentText('one two', 'msg_a'),
      ],
      options(),
    );

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('user');
    expect(messages[0].text).toBe('hello there');
    expect(messages[1].text).toBe('one two');
  });

  test('a replayed tool call never downgrades a terminal status back to running', () => {
    const messages = compactAcpEnvelopes(
      [
        prompt(1, 'go'),
        agentText('x', 'msg_a'),
        toolCall('call_1', 'pending'),
        toolCall('call_1', 'completed'),
        toolCall('call_1', 'pending'),
      ],
      options(),
    );
    expect(messages[1].tools).toEqual([{ tool: 'glob', status: 'completed' }]);
  });

  test('maps a failed tool call to the error status and derives the name from the ACP kind', () => {
    const messages = compactAcpEnvelopes(
      [
        agentText('x', 'msg_a'),
        update({
          sessionUpdate: 'tool_call',
          toolCallId: 'call_9',
          status: 'failed',
          kind: 'execute',
          title: 'Running a shell command',
        }),
      ],
      options(),
    );
    expect(messages[0].tools).toEqual([{ tool: 'bash', status: 'error' }]);
  });

  test('ignores session/update notifications scoped to another ACP session', () => {
    const messages = compactAcpEnvelopes(
      [
        agentText('mine', 'msg_a'),
        update(
          {
            sessionUpdate: 'agent_message_chunk',
            messageId: 'msg_x',
            content: { type: 'text', text: 'theirs' },
          },
          'ses_other',
        ),
      ],
      options(),
    );
    expect(messages).toHaveLength(1);
    expect(messages[0].text).toBe('mine');
  });

  test('infers the scope from the envelopes when no acp_session_id is stored', () => {
    const messages = compactAcpEnvelopes(
      [
        prompt(1, 'scoped prompt'),
        agentText('scoped reply', 'msg_a'),
        update(
          {
            sessionUpdate: 'agent_message_chunk',
            messageId: 'msg_x',
            content: { type: 'text', text: 'foreign' },
          },
          'ses_other',
        ),
      ],
      options({ acpSessionId: null }),
    );
    expect(messages.map((m) => m.text)).toEqual(['scoped prompt', 'scoped reply']);
  });

  test('records non-text prompt blocks as sanitized file references', () => {
    const messages = compactAcpEnvelopes(
      [
        prompt(1, 'look at this', [
          {
            type: 'resource_link',
            name: 'spec.pdf',
            uri: 'file:///workspace/spec.pdf',
            mimeType: 'application/pdf',
          },
          { type: 'image', mimeType: 'image/png', data: 'BASE64PAYLOAD' },
        ]),
      ],
      options(),
    );
    expect(messages[0].files).toEqual([
      { filename: 'spec.pdf', mime: 'application/pdf' },
      { filename: null, mime: 'image/png' },
    ]);
    expect(JSON.stringify(messages[0])).not.toContain('BASE64PAYLOAD');
  });

  test('carries a JSON-RPC error response onto the assistant turn', () => {
    const messages = compactAcpEnvelopes(
      [
        prompt(1, 'go'),
        agentText('partial', 'msg_a'),
        envelope({ jsonrpc: '2.0', id: 1, error: { code: -32000, message: 'model overloaded' } }),
      ],
      options(),
    );
    expect(messages[1].error).toEqual({ name: '-32000', message: 'model overloaded' });
  });

  test('keeps only the last `limit` messages and truncates each to `maxChars`', () => {
    const messages = compactAcpEnvelopes(
      [
        agentText('a'.repeat(50), 'msg_1'),
        agentText('b'.repeat(50), 'msg_2'),
        agentText('c'.repeat(50), 'msg_3'),
      ],
      options({ limit: 2, maxChars: 10 }),
    );
    expect(messages).toHaveLength(2);
    expect(messages[0].text).toBe(`${'b'.repeat(9)}…`);
    expect(messages[1].text).toBe(`${'c'.repeat(9)}…`);
  });
});
