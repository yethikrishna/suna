import { describe, expect, test } from 'bun:test';

import type { MessageWithParts } from '@kortix/sdk/react';
import type { FlatModel } from '../model-flatten';
import {
  getContextLimit,
  getLastAssistantTokenBreakdown,
  getLastAssistantTokenTotal,
} from './token-progress';

function assistantMessage(tokens: Record<string, unknown> | undefined): MessageWithParts {
  return {
    info: { role: 'assistant', tokens } as any,
    parts: [],
  } as unknown as MessageWithParts;
}

function userMessage(): MessageWithParts {
  return { info: { role: 'user' } as any, parts: [] } as unknown as MessageWithParts;
}

function flatModel(overrides: Partial<FlatModel> = {}): FlatModel {
  return {
    providerID: 'anthropic',
    providerName: 'Anthropic',
    modelID: 'claude-5',
    modelName: 'Claude 5',
    ...overrides,
  };
}

describe('getLastAssistantTokenTotal', () => {
  test('returns 0 for undefined or empty message lists', () => {
    expect(getLastAssistantTokenTotal(undefined)).toBe(0);
    expect(getLastAssistantTokenTotal([])).toBe(0);
  });

  test('sums input/output/reasoning/cache tokens from the most recent assistant message', () => {
    const messages = [
      userMessage(),
      assistantMessage({ input: 100, output: 50, reasoning: 10, cache: { read: 5, write: 2 } }),
    ];
    expect(getLastAssistantTokenTotal(messages)).toBe(167);
  });

  test('skips trailing assistant messages with no token total and finds the last real one', () => {
    const messages = [
      assistantMessage({ input: 100, output: 50 }),
      userMessage(),
      assistantMessage(undefined),
    ];
    expect(getLastAssistantTokenTotal(messages)).toBe(150);
  });

  test('ignores user messages entirely, even if they carry a tokens-shaped field', () => {
    const messages = [assistantMessage({ input: 10, output: 10 }), userMessage()];
    expect(getLastAssistantTokenTotal(messages)).toBe(20);
  });
});

describe('getLastAssistantTokenBreakdown', () => {
  test('reports the whole composition of a real ACP usage payload', () => {
    const messages = [
      userMessage(),
      assistantMessage({ input: 5607, output: 13, reasoning: 25, cache: { read: 1792, write: 0 } }),
    ];

    expect(getLastAssistantTokenBreakdown(messages)).toEqual({
      total: 7437,
      input: 5607,
      output: 13,
      reasoning: 25,
      cached: 1792,
    });
  });

  test('keeps thinking tokens visible instead of folding them into output', () => {
    const messages = [
      assistantMessage({ input: 169, output: 10, reasoning: 22, cache: { read: 7168, write: 0 } }),
    ];
    const breakdown = getLastAssistantTokenBreakdown(messages);

    expect(breakdown.total).toBe(7369);
    expect(breakdown.reasoning).toBe(22);
    expect(breakdown.cached).toBe(7168);
    expect(breakdown.input + breakdown.output).toBe(179);
  });

  test('counts cache writes as occupied context', () => {
    const messages = [
      assistantMessage({ input: 3, output: 9, reasoning: 0, cache: { read: 0, write: 34914 } }),
    ];

    expect(getLastAssistantTokenBreakdown(messages).total).toBe(34926);
    expect(getLastAssistantTokenBreakdown(messages).cached).toBe(34914);
  });

  test('reports zeroes when no assistant message carries usage', () => {
    expect(getLastAssistantTokenBreakdown([userMessage()])).toEqual({
      total: 0,
      input: 0,
      output: 0,
      reasoning: 0,
      cached: 0,
    });
  });
});

describe('getContextLimit', () => {
  test('falls back to 200k when no model is selected', () => {
    expect(getContextLimit(undefined, undefined)).toBe(200000);
    expect(getContextLimit([flatModel()], null)).toBe(200000);
  });

  test('uses the selected model contextWindow when present', () => {
    const models = [flatModel({ modelID: 'claude-5', contextWindow: 500000 })];
    expect(getContextLimit(models, { providerID: 'anthropic', modelID: 'claude-5' })).toBe(500000);
  });

  test('falls back to 200k when the selected model has no positive contextWindow', () => {
    const models = [flatModel({ modelID: 'claude-5', contextWindow: 0 })];
    expect(getContextLimit(models, { providerID: 'anthropic', modelID: 'claude-5' })).toBe(200000);
  });

  test('falls back to 200k when the selected model is not found in the list', () => {
    const models = [flatModel({ modelID: 'claude-5', contextWindow: 500000 })];
    expect(getContextLimit(models, { providerID: 'openai', modelID: 'gpt-5' })).toBe(200000);
  });
});
