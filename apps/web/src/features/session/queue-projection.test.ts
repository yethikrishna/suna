import { describe, expect, test } from 'bun:test';
import type { SessionPrompt } from '@kortix/sdk';
import type { WebQueuedMessage } from '@/stores/message-queue-store';
import { projectQueueRows } from './queue-projection';

function prompt(overrides: Partial<SessionPrompt> = {}): SessionPrompt {
  return {
    prompt_id: 'cmd-1',
    client_message_id: 'q_1',
    message_id: 'msg_a',
    state: 'queued',
    reason: null,
    text: 'say hi',
    attempts: 0,
    last_error: null,
    created_at: '2026-08-18T00:00:00.000Z',
    available_at: '2026-08-18T00:00:00.000Z',
    ...overrides,
  };
}

function local(overrides: Partial<WebQueuedMessage> = {}): WebQueuedMessage {
  return {
    id: 'local-1',
    clientMessageId: 'q_local_1',
    text: 'typed while booting',
    attempts: 0,
    ...overrides,
  } as WebQueuedMessage;
}

const noLocal = { pending: [], failed: [] };

describe('projectQueueRows', () => {
  test('server rows land in the queue, and a delivered-in-flight one is locked', () => {
    const projection = projectQueueRows({
      prompts: [
        prompt({ prompt_id: 'a' }),
        prompt({ prompt_id: 'b', state: 'delivering' }),
        prompt({ prompt_id: 'c', state: 'failed', last_error: 'delivery outcome: failed' }),
      ],
      local: noLocal,
      localInFlightIds: [],
    });

    expect(projection.queued.map((r) => r.id)).toEqual(['a']);
    expect(projection.inFlightIds).toEqual(['b']);
    expect(projection.failed).toEqual([
      { id: 'c', text: 'say hi', lastError: 'delivery outcome: failed', source: 'server' },
    ]);
  });

  test('a `waiting` row is still a queued row — waiting is WHY, not a lane', () => {
    const projection = projectQueueRows({
      prompts: [prompt({ state: 'waiting', reason: 'turn_active' })],
      local: noLocal,
      localInFlightIds: [],
    });
    expect(projection.queued).toHaveLength(1);
    expect(projection.held).toBe(false);
  });

  test('a HELD row reports the hold, so the strip can say the queue is stopped', () => {
    const projection = projectQueueRows({
      prompts: [prompt({ state: 'waiting', reason: 'held' })],
      local: noLocal,
      localInFlightIds: [],
    });
    expect(projection.held).toBe(true);
  });

  test('local entries are rendered TOO — dropping them is how a queued message vanishes', () => {
    // The instant boot shell writes here (its first message is still in the
    // start stash, not the inbox), and so does a `/` command queued mid-turn.
    const projection = projectQueueRows({
      prompts: [prompt({ prompt_id: 'server-1' })],
      local: { pending: [local()], failed: [] },
      localInFlightIds: [],
    });

    expect(projection.queued.map((r) => r.id)).toEqual(['local-1', 'server-1']);
    expect(projection.localIds.has('local-1')).toBe(true);
    expect(projection.localIds.has('server-1')).toBe(false);
  });

  test('a queued `/` command renders as the command, not as its bare arguments', () => {
    const projection = projectQueueRows({
      prompts: [],
      local: { pending: [local({ text: '', command: { name: 'compact' } })], failed: [] },
      localInFlightIds: [],
    });
    expect(projection.queued[0].text).toBe('/compact');
  });

  test('a failed local entry keeps its error, and its own retry lane', () => {
    const projection = projectQueueRows({
      prompts: [],
      local: { pending: [], failed: [local({ lastError: 'Command /x is no longer available' })] },
      localInFlightIds: [],
    });
    expect(projection.failed[0]).toMatchObject({
      id: 'local-1',
      lastError: 'Command /x is no longer available',
      source: 'local',
    });
  });

  test('both in-flight sets are locked, not just the server one', () => {
    const projection = projectQueueRows({
      prompts: [prompt({ prompt_id: 'server-1', state: 'delivering' })],
      local: { pending: [local()], failed: [] },
      localInFlightIds: ['local-1'],
    });
    expect(projection.inFlightIds.sort()).toEqual(['local-1', 'server-1']);
  });
});
