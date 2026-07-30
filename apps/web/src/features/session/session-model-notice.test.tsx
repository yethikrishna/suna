import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { SessionModelNotice } from './session-error-banner';

const REQUESTED = 'kortix/anthropic/claude-sonnet-5';

describe('SessionModelNotice — an unavailable model is inline and non-fatal', () => {
  test('names the requested model and the model used instead', () => {
    const html = renderToStaticMarkup(
      <SessionModelNotice
        notice={{
          reason: 'model-not-found',
          requestedModel: REQUESTED,
          activeModel: 'kortix/glm-5.2',
          applied: true,
          message: `${REQUESTED} is not available in this session. Using kortix/glm-5.2 instead.`,
        }}
      />,
    );
    expect(html).toContain(REQUESTED);
    expect(html).toContain('kortix/glm-5.2');
    expect(html).not.toContain('OpenCode failed to load');
    expect(html).not.toContain('Restart session');
  });

  test('explains the harness fallback when no equivalent model is offered', () => {
    const html = renderToStaticMarkup(
      <SessionModelNotice
        notice={{
          reason: 'model-not-found',
          requestedModel: REQUESTED,
          activeModel: 'opencode/big-pickle',
          applied: false,
          message: `${REQUESTED} is not available in this session, and no equivalent model is offered. This session is running on the agent's own model, opencode/big-pickle.`,
        }}
      />,
    );
    expect(html).toContain(REQUESTED);
    expect(html).toContain('opencode/big-pickle');
  });

  test('renders nothing when there is no notice', () => {
    expect(renderToStaticMarkup(<SessionModelNotice notice={null} />)).toBe('');
  });

  test('carries a stable test hook so the surface is assertable in a browser', () => {
    const html = renderToStaticMarkup(
      <SessionModelNotice
        notice={{
          reason: 'model-not-found',
          requestedModel: REQUESTED,
          activeModel: null,
          applied: false,
          message: 'unavailable',
        }}
      />,
    );
    expect(html).toContain('data-session-model-notice');
  });
});
