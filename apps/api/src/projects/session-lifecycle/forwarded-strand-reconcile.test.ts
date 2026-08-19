import { describe, expect, test } from 'bun:test';
import type { StoredSandboxTurn } from '../sandbox-turn-lifecycle';
import { WIRE_ID_TIME_SCALE } from '../wire-message-id';
import { type StrandReconcileDeps, reconcileForwardedTurnsAtEnd } from './forwarded-strand-reconcile';

const id = (ms: number, tail: string) =>
  `msg_${((BigInt(ms) * WIRE_ID_TIME_SCALE + BigInt(1)) & BigInt(0xffffffffffff)).toString(16).padStart(12, '0')}${tail}`;
const T = 1_800_000_000_000;
const turn = (messageId: string, state: 'delivering' | 'active' = 'active'): StoredSandboxTurn => ({
  token: `tok-${messageId}`,
  state,
  messageId,
  opencodeSessionId: 'ses_root',
  startedAtMs: T,
});

function fakeDeps(over: Partial<StrandReconcileDeps> & { open: StoredSandboxTurn[]; tip: any[] | null }) {
  const calls: Record<string, unknown[][]> = { closeOlder: [], closeStranded: [], remove: [], requeue: [], kick: [] };
  const deps: StrandReconcileDeps = {
    readOpenTurns: async () => over.open,
    closeOlderTurn: async (...a) => { calls.closeOlder.push(a); },
    closeStrandedTurn: async (...a) => { calls.closeStranded.push(a); },
    readTip: async () => over.tip,
    removeMessage: async (...a) => { calls.remove.push(a); return true; },
    requeueStranded: async (...a) => { calls.requeue.push(a); return 'requeued'; },
    kickDrain: (...a) => { calls.kick.push(a); },
    ...over,
  };
  return { deps, calls };
}

describe('reconcileForwardedTurnsAtEnd', () => {
  const u1 = id(T, 'USER1USER1USER');
  const u2 = id(T + 1_000, 'USER2USER2USER');
  const M = id(T + 2_000, 'USERMUSERMUSER');
  const aM = id(T + 3_000, 'ASSTMASSTMASST');
  const u4 = id(T + 2_500, 'USER4USER4USER'); // landed below aM, never read
  const u5 = id(T + 4_000, 'USER5USER5USER'); // a fresh send after the end

  test('no-op without an ended message id when the tip has no finished assistant either', async () => {
    const { deps, calls } = fakeDeps({ open: [turn(u1)], tip: [] });
    const out = await reconcileForwardedTurnsAtEnd({ sessionId: 's' }, deps);
    expect(out).toEqual({ closedOlder: 0, candidates: 0, stranded: 0, requeued: 0 });
    expect(calls.closeOlder).toHaveLength(0);
  });

  test('a relay that names no message falls back to the newest finished assistant\'s parent', async () => {
    // The daemon could not attribute the end; the tip can: the step that
    // ended answered M, and u4 sits above M below its assistant — stranded.
    const tip = [
      { id: M, role: 'user' },
      { id: u4, role: 'user' },
      { id: aM, role: 'assistant', parentID: M, completed: T + 3_500 },
    ];
    const { deps, calls } = fakeDeps({ open: [turn(u1), turn(u4, 'delivering')], tip });
    const out = await reconcileForwardedTurnsAtEnd({ sessionId: 's' }, deps);
    expect(out).toEqual({ closedOlder: 1, candidates: 1, stranded: 1, requeued: 1 });
    expect(calls.closeOlder.map((c) => c[2])).toEqual([u1]);
    expect(calls.remove).toEqual([['s', u4]]);
  });

  test('older forwarded turns close as completed; the ended one is left to the relay', async () => {
    const { deps, calls } = fakeDeps({ open: [turn(u1), turn(u2), turn(M)], tip: [] });
    const out = await reconcileForwardedTurnsAtEnd({ sessionId: 's', opencodeSessionId: 'ses_root', endedMessageId: M }, deps);
    expect(out.closedOlder).toBe(2);
    expect(calls.closeOlder.map((c) => c[2])).toEqual([u1, u2]);
    expect(out.candidates).toBe(0);
  });

  test('a stranded newer prompt is removed, re-queued, its turn closed, and the drain kicked', async () => {
    const tip = [
      { id: M, role: 'user' },
      { id: u4, role: 'user' },
      { id: aM, role: 'assistant', parentID: M, completed: T + 3_500 },
    ];
    const { deps, calls } = fakeDeps({ open: [turn(u4, 'delivering')], tip });
    const out = await reconcileForwardedTurnsAtEnd({ sessionId: 's', opencodeSessionId: 'ses_root', endedMessageId: M }, deps);
    expect(out).toEqual({ closedOlder: 0, candidates: 1, stranded: 1, requeued: 1 });
    expect(calls.remove).toEqual([['s', u4]]);
    expect(calls.requeue).toEqual([['s', u4]]);
    expect(calls.closeStranded).toEqual([['s', u4]]);
    expect(calls.kick).toHaveLength(1);
  });

  test('a newer prompt that opened its own turn is left alone', async () => {
    const a5 = id(T + 4_100, 'ASST5ASST5ASST');
    const tip = [
      { id: M, role: 'user' },
      { id: aM, role: 'assistant', parentID: M, completed: T + 3_500 },
      { id: u5, role: 'user' },
      { id: a5, role: 'assistant', parentID: u5 },
    ];
    const { deps, calls } = fakeDeps({ open: [turn(u5)], tip });
    const out = await reconcileForwardedTurnsAtEnd({ sessionId: 's', opencodeSessionId: 'ses_root', endedMessageId: M }, deps);
    expect(out).toEqual({ closedOlder: 0, candidates: 1, stranded: 0, requeued: 0 });
    expect(calls.remove).toHaveLength(0);
    expect(calls.closeStranded).toHaveLength(0);
  });

  test('a newer prompt not yet reached (no assistant above it) is left alone', async () => {
    const tip = [{ id: M, role: 'user' }, { id: aM, role: 'assistant', parentID: M, completed: T + 3_500 }, { id: u5, role: 'user' }];
    const { deps, calls } = fakeDeps({ open: [turn(u5)], tip });
    const out = await reconcileForwardedTurnsAtEnd({ sessionId: 's', endedMessageId: M }, deps);
    expect(out.stranded).toBe(0);
    expect(calls.remove).toHaveLength(0);
  });

  test('an unreadable tip skips the strand check but still closes older turns', async () => {
    const { deps, calls } = fakeDeps({ open: [turn(u1), turn(u4)], tip: null });
    const out = await reconcileForwardedTurnsAtEnd({ sessionId: 's', endedMessageId: M }, deps);
    expect(out.closedOlder).toBe(1);
    expect(out.stranded).toBe(0);
    expect(calls.remove).toHaveLength(0);
  });

  test('a failed removal never re-queues (no duplicate), the turn stays', async () => {
    const tip = [{ id: M, role: 'user' }, { id: u4, role: 'user' }, { id: aM, role: 'assistant', parentID: M }];
    const { deps, calls } = fakeDeps({ open: [turn(u4)], tip, removeMessage: async () => false });
    const out = await reconcileForwardedTurnsAtEnd({ sessionId: 's', endedMessageId: M }, deps);
    expect(out.stranded).toBe(1);
    expect(out.requeued).toBe(0);
    expect(calls.requeue).toHaveLength(0);
    expect(calls.closeStranded).toHaveLength(0);
  });

  test('turns of another opencode root are ignored', async () => {
    const foreign = { ...turn(u1), opencodeSessionId: 'ses_child' };
    const { deps, calls } = fakeDeps({ open: [foreign], tip: [] });
    const out = await reconcileForwardedTurnsAtEnd({ sessionId: 's', opencodeSessionId: 'ses_root', endedMessageId: M }, deps);
    expect(out.closedOlder).toBe(0);
    expect(calls.closeOlder).toHaveLength(0);
  });
});
