import { describe, expect, test } from 'bun:test';
import {
  relativeTurnTime,
  shouldPollVoiceTranscript,
  turnSpeakerLabel,
  voiceTranscriptKey,
} from './session-voice-transcript-shared';

describe('turnSpeakerLabel', () => {
  test('a tool-role turn is labeled by its speaker (the tool name)', () => {
    expect(turnSpeakerLabel('tool', 'ask_kortix')).toBe('ask_kortix');
    expect(turnSpeakerLabel('tool', 'run_command')).toBe('run_command');
  });

  test('a tool-role turn with no speaker falls back to a generic label', () => {
    expect(turnSpeakerLabel('tool', null)).toBe('tool call');
  });

  test('an agent-role turn is always labeled Kortix, regardless of speaker', () => {
    expect(turnSpeakerLabel('agent', null)).toBe('Kortix');
    expect(turnSpeakerLabel('agent', 'ignored')).toBe('Kortix');
  });

  test('a user-role turn uses its speaker name, falling back to "Caller"', () => {
    expect(turnSpeakerLabel('user', 'Alex')).toBe('Alex');
    expect(turnSpeakerLabel('user', null)).toBe('Caller');
  });
});

describe('relativeTurnTime', () => {
  test('buckets recency into now / seconds / minutes / hours / days', () => {
    const now = Date.now();
    expect(relativeTurnTime(new Date(now - 1_000).toISOString())).toBe('now');
    expect(relativeTurnTime(new Date(now - 30_000).toISOString())).toBe('30s ago');
    expect(relativeTurnTime(new Date(now - 5 * 60_000).toISOString())).toBe('5m ago');
    expect(relativeTurnTime(new Date(now - 3 * 3_600_000).toISOString())).toBe('3h ago');
    expect(relativeTurnTime(new Date(now - 2 * 86_400_000).toISOString())).toBe('2d ago');
  });
});

describe('voiceTranscriptKey', () => {
  test('is stable and defaults missing ids to empty strings (never undefined in a query key)', () => {
    expect(voiceTranscriptKey('P1', 'S1')).toEqual(['voice-transcript', 'P1', 'S1']);
    expect(voiceTranscriptKey(undefined, undefined)).toEqual(['voice-transcript', '', '']);
  });
});

describe('shouldPollVoiceTranscript', () => {
  const visibleVoicePanel = {
    panelOpen: true,
    voiceView: true,
    visibleLayout: true,
    booting: false,
    transient: false,
  };

  test('polls only when the active session Voice panel is visible', () => {
    expect(shouldPollVoiceTranscript(visibleVoicePanel)).toBe(true);
  });

  for (const [name, override] of [
    ['normal session chat', { voiceView: false }],
    ['closed side panel', { panelOpen: false }],
    ['inactive session tab', { visibleLayout: false }],
    ['booting session', { booting: true }],
    ['transient session', { transient: true }],
  ] as const) {
    test(`does not poll for ${name}`, () => {
      expect(shouldPollVoiceTranscript({ ...visibleVoicePanel, ...override })).toBe(false);
    });
  }
});
