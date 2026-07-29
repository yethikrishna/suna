import { describe, expect, test } from 'bun:test';

import { normalizeProxySubPath } from './handlers';

describe('normalizeProxySubPath', () => {
  test('accepts the /v1/messages path emitted by the Anthropic SDK', () => {
    expect(normalizeProxySubPath('anthropic', '/v1/messages')).toBe('/messages');
  });

  test('keeps existing proxy service paths unchanged', () => {
    expect(normalizeProxySubPath('anthropic', '/messages')).toBe('/messages');
    expect(normalizeProxySubPath('openai', '/v1/responses')).toBe('/v1/responses');
  });
});
