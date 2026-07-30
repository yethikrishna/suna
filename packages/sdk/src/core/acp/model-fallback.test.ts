import { describe, expect, test } from 'bun:test';

import {
  acpModelNotice,
  advertisedCurrentModel,
  advertisedModelOptions,
  parseAcpModelNotFound,
  selectAcpFallbackModel,
} from './model-fallback';
import { AcpRpcError } from './types';

const OPENCODE_MODEL_OPTION = {
  id: 'model',
  name: 'Model',
  type: 'select',
  category: 'model',
  currentValue: 'opencode/big-pickle',
  options: [
    { name: 'Anthropic/Claude Opus 4.8', value: 'anthropic/claude-opus-4-8' },
    { name: 'Anthropic/Claude Sonnet 5', value: 'anthropic/claude-sonnet-5' },
    { name: 'OpenCode Zen/Big Pickle', value: 'opencode/big-pickle' },
  ],
};

const GATEWAY_MODEL_OPTION = {
  id: 'model',
  name: 'Model',
  type: 'select',
  category: 'model',
  currentValue: 'kortix/glm-5.2',
  options: [
    { name: 'Anthropic/Claude Opus 4.8', value: 'anthropic/claude-opus-4-8' },
    { name: 'kortix/deepseek-v4-flash', value: 'kortix/deepseek-v4-flash' },
    { name: 'kortix/glm-5.2', value: 'kortix/glm-5.2' },
  ],
};

describe('parseAcpModelNotFound', () => {
  test('recognises the -32602 model-not-found the harness returns for an unknown model', () => {
    const error = new AcpRpcError('Invalid params: model not found: kortix/glm-5.2', -32602, {
      modelId: 'kortix/glm-5.2',
      providerId: 'kortix',
    });
    expect(parseAcpModelNotFound(error)).toEqual({
      modelId: 'kortix/glm-5.2',
      providerId: 'kortix',
      message: 'Invalid params: model not found: kortix/glm-5.2',
    });
  });

  test('recognises it without structured data, from the message alone', () => {
    const error = new AcpRpcError(
      'Invalid params: model not found: kortix/anthropic/claude-sonnet-5',
      -32602,
    );
    expect(parseAcpModelNotFound(error)?.modelId).toBeNull();
    expect(parseAcpModelNotFound(error)?.providerId).toBeNull();
  });

  test('ignores a -32602 that is not about a model', () => {
    expect(
      parseAcpModelNotFound(new AcpRpcError('Invalid params: cwd is required', -32602)),
    ).toBeNull();
  });

  test('ignores every other error', () => {
    expect(parseAcpModelNotFound(new AcpRpcError('model not found: x', -32603))).toBeNull();
    expect(parseAcpModelNotFound(new Error('model not found: x'))).toBeNull();
    expect(parseAcpModelNotFound(null)).toBeNull();
  });
});

describe('advertisedModelOptions', () => {
  test('reads the harness-advertised option list off the session/load result', () => {
    expect(advertisedModelOptions([OPENCODE_MODEL_OPTION, { id: 'mode', options: [] }])).toEqual([
      { value: 'anthropic/claude-opus-4-8', name: 'Anthropic/Claude Opus 4.8' },
      { value: 'anthropic/claude-sonnet-5', name: 'Anthropic/Claude Sonnet 5' },
      { value: 'opencode/big-pickle', name: 'OpenCode Zen/Big Pickle' },
    ]);
  });

  test('is empty when the harness advertises no model option', () => {
    expect(advertisedModelOptions([{ id: 'mode', options: [{ value: 'build' }] }])).toEqual([]);
    expect(advertisedModelOptions([])).toEqual([]);
  });

  test('reads the currently active model off the same option', () => {
    expect(advertisedCurrentModel([OPENCODE_MODEL_OPTION])).toBe('opencode/big-pickle');
    expect(advertisedCurrentModel([{ id: 'model' }])).toBeNull();
  });
});

describe('selectAcpFallbackModel', () => {
  test('prefers the session active model when the harness still advertises it', () => {
    expect(
      selectAcpFallbackModel({
        requestedModel: 'kortix/anthropic/claude-sonnet-5',
        advertised: advertisedModelOptions([GATEWAY_MODEL_OPTION]),
        currentModel: 'kortix/glm-5.2',
        serverDefaultModel: 'kortix/deepseek-v4-flash',
        rejected: new Set(),
      }),
    ).toBe('kortix/glm-5.2');
  });

  test('falls to the server default when the active model is not advertised', () => {
    expect(
      selectAcpFallbackModel({
        requestedModel: 'kortix/anthropic/claude-sonnet-5',
        advertised: advertisedModelOptions([GATEWAY_MODEL_OPTION]),
        currentModel: 'kortix/gone-4.0',
        serverDefaultModel: 'kortix/glm-5.2',
        rejected: new Set(),
      }),
    ).toBe('kortix/glm-5.2');
  });

  test('falls to the first advertised option in the same namespace when nothing else resolves', () => {
    expect(
      selectAcpFallbackModel({
        requestedModel: 'kortix/anthropic/claude-sonnet-5',
        advertised: advertisedModelOptions([GATEWAY_MODEL_OPTION]),
        currentModel: null,
        serverDefaultModel: null,
        rejected: new Set(),
      }),
    ).toBe('kortix/deepseek-v4-flash');
  });

  test('never rewrites a managed kortix model onto a BYOK id, even as the last resort', () => {
    expect(
      selectAcpFallbackModel({
        requestedModel: 'kortix/anthropic/claude-sonnet-5',
        advertised: advertisedModelOptions([OPENCODE_MODEL_OPTION]),
        currentModel: 'opencode/big-pickle',
        serverDefaultModel: 'kortix/glm-5.2',
        rejected: new Set(),
      }),
    ).toBeNull();
  });

  test('never re-picks a model that already failed', () => {
    expect(
      selectAcpFallbackModel({
        requestedModel: 'kortix/anthropic/claude-sonnet-5',
        advertised: advertisedModelOptions([GATEWAY_MODEL_OPTION]),
        currentModel: 'kortix/glm-5.2',
        serverDefaultModel: 'kortix/glm-5.2',
        rejected: new Set(['kortix/glm-5.2']),
      }),
    ).toBe('kortix/deepseek-v4-flash');
  });

  test('never re-picks the model that was just requested', () => {
    expect(
      selectAcpFallbackModel({
        requestedModel: 'kortix/glm-5.2',
        advertised: advertisedModelOptions([
          { id: 'model', currentValue: 'kortix/glm-5.2', options: [{ value: 'kortix/glm-5.2' }] },
        ]),
        currentModel: 'kortix/glm-5.2',
        serverDefaultModel: 'kortix/glm-5.2',
        rejected: new Set(),
      }),
    ).toBeNull();
  });

  test('keeps a bare harness id in the bare namespace', () => {
    expect(
      selectAcpFallbackModel({
        requestedModel: 'gone-1',
        advertised: [
          { value: 'anthropic/claude-opus-4-8', name: null },
          { value: 'sonic', name: null },
        ],
        currentModel: null,
        serverDefaultModel: null,
        rejected: new Set(),
      }),
    ).toBe('sonic');
  });
});

describe('acpModelNotice', () => {
  test('names the requested model and the replacement when a fallback applied', () => {
    const notice = acpModelNotice({
      requestedModel: 'kortix/anthropic/claude-sonnet-5',
      fallbackModel: 'kortix/glm-5.2',
      harnessModel: 'kortix/glm-5.2',
    });
    expect(notice.reason).toBe('model-not-found');
    expect(notice.requestedModel).toBe('kortix/anthropic/claude-sonnet-5');
    expect(notice.activeModel).toBe('kortix/glm-5.2');
    expect(notice.applied).toBe(true);
    expect(notice.message).toContain('kortix/anthropic/claude-sonnet-5');
    expect(notice.message).toContain('kortix/glm-5.2');
  });

  test('names the harness model it fell back to when no Kortix model could be selected', () => {
    const notice = acpModelNotice({
      requestedModel: 'kortix/anthropic/claude-sonnet-5',
      fallbackModel: null,
      harnessModel: 'opencode/big-pickle',
    });
    expect(notice.applied).toBe(false);
    expect(notice.activeModel).toBe('opencode/big-pickle');
    expect(notice.message).toContain('kortix/anthropic/claude-sonnet-5');
    expect(notice.message).toContain('opencode/big-pickle');
  });

  test('does not claim the requested model is also the replacement', () => {
    const notice = acpModelNotice({
      requestedModel: 'kortix/glm-5.2',
      fallbackModel: null,
      harnessModel: 'kortix/glm-5.2',
    });
    expect(notice.applied).toBe(false);
    expect(notice.activeModel).toBeNull();
    expect(notice.message).toContain('kortix/glm-5.2');
    expect(notice.message).not.toContain("agent's own model, kortix/glm-5.2");
  });

  test('still explains itself when the harness reports no model at all', () => {
    const notice = acpModelNotice({
      requestedModel: 'kortix/glm-5.2',
      fallbackModel: null,
      harnessModel: null,
    });
    expect(notice.applied).toBe(false);
    expect(notice.activeModel).toBeNull();
    expect(notice.message).toContain('kortix/glm-5.2');
  });
});
