import { beforeEach, describe, expect, mock, test } from 'bun:test';

/**
 * What a live call leaves behind.
 *
 * The bug these cover: the Kortix agent called the `kortix_voice` connector's
 * `send_prompt`, the room heard it, and `voice_call_turns` had no row for it —
 * so the /voice page rendered a conversation with one side missing. The record
 * of the agent side depended entirely on the LiveKit worker echoing its own
 * speech back through `ConversationItemAdded`, a client-side event in another
 * process that was observed not firing for a programmatic `generateReply`.
 *
 * So the assertion running through all of this is: whatever apps/api hands to
 * the room, apps/api records — and it records the SPOKEN payload, never the
 * "[result] …say it out loud in your own words" instruction wrapper that goes
 * on the wire.
 */

let dbResults: unknown[][] = [];
let inserts: Record<string, unknown>[] = [];
let insertThrows = false;
let agentInRoom = true;
const sent: Array<{ room: string; topic: string; payload: any }> = [];

function makeChain(kind?: string): any {
  const chain: any = {};
  for (const m of ['from', 'where', 'limit', 'values', 'onConflictDoNothing', 'set']) {
    chain[m] = (...args: unknown[]) => {
      if (kind === 'insert' && m === 'values') {
        if (insertThrows) throw new Error('transcript write exploded');
        inserts.push(args[0] as Record<string, unknown>);
      }
      return chain;
    };
  }
  chain.returning = () => chain;
  chain.then = (resolve: (rows: unknown[]) => unknown) => Promise.resolve(resolve(dbResults.shift() ?? []));
  return chain;
}

mock.module('../shared/db', () => ({
  db: {
    select: () => makeChain('select'),
    insert: () => makeChain('insert'),
    update: () => makeChain('update'),
  },
  hasDatabase: () => true,
}));

mock.module('../config', () => ({
  config: { KORTIX_URL: 'https://example.com', API_KEY_SECRET: 'test-secret' },
}));

mock.module('../channels/voice/livekit', () => ({
  KORTIX_REPLY_TOPIC: 'kortix',
  roomNameForCall: (callId: string) => `voice-${callId}`,
  roomHasAgent: async () => agentInRoom,
  roomCallbackUrl: async () => 'https://example.com',
  createRoom: async () => {},
  deleteRoom: async () => {},
  joinPageUrl: () => 'https://example.com/voice/tok',
  sendRoomData: async (room: string, topic: string, payload: unknown) => {
    sent.push({ room, topic, payload });
  },
}));

mock.module('../channels/voice/answer-watch', () => ({
  speakAnswerWhenReady: () => {},
}));

mock.module('../projects/session-lifecycle', () => ({
  continueSession: async () => 'delivered',
}));

const { promptVoiceAgent } = await import('../channels/voice/runtime');
const { relayTurnAnswer, relayTurnEnd, relayTurnStep } = await import('../channels/voice/turn');
const {
  KORTIX_SPEAKER,
  kortixError,
  kortixProgress,
  kortixQuestion,
  kortixResult,
  kortixReview,
  kortixSay,
} = await import('../channels/voice/utterance');

beforeEach(() => {
  dbResults = [];
  inserts = [];
  insertThrows = false;
  agentInRoom = true;
  sent.length = 0;
});

describe('kortix utterances — instruction on the wire, payload in the record', () => {
  const cases = [
    { name: 'say', u: kortixSay('the connector works straight from the session'), tag: '[say]' },
    { name: 'progress', u: kortixProgress('reading the config'), tag: '[progress]' },
    { name: 'result', u: kortixResult('four tests failed'), tag: '[result]' },
    { name: 'question', u: kortixQuestion('should I deploy it?'), tag: '[question]' },
    { name: 'review', u: kortixReview('the login fix'), tag: '[review]' },
    { name: 'error', u: kortixError('sandbox not ready'), tag: '[error]' },
  ];

  for (const { name, u, tag } of cases) {
    test(`${name}: the instruction is tagged, and the transcript is not the instruction`, () => {
      expect(u.instruction).toContain(tag);
      expect(u.transcript).not.toBe(u.instruction);
      expect(u.transcript.trim().length).toBeGreaterThan(0);
      // The transcript is what a human reads back. Stage directions aimed at
      // the voice model must never survive into it — recording the wire text
      // verbatim is the other half of this bug, and it reads as the agent
      // literally saying "mention this briefly and naturally".
      expect(u.transcript).not.toContain(tag);
      expect(u.transcript.toLowerCase()).not.toContain('in your own words');
      expect(u.transcript.toLowerCase()).not.toContain('say it out loud');
      expect(u.transcript.toLowerCase()).not.toContain('briefly and naturally');
    });
  }

  test('the transcript carries the thing that was actually said', () => {
    expect(kortixSay('deploy is green').transcript).toBe('deploy is green');
    expect(kortixResult('four tests failed').transcript).toBe('four tests failed');
    expect(kortixQuestion('should I deploy it?').transcript).toBe('should I deploy it?');
    expect(kortixProgress('reading the config').transcript).toContain('reading the config');
    expect(kortixReview('the login fix').transcript).toContain('the login fix');
    expect(kortixError('sandbox not ready').transcript).toContain('sandbox not ready');
  });

  test('send_prompt keeps the framing that stopped the call answering statements as questions', () => {
    const instruction = kortixSay('the connector works straight from the session').instruction;
    expect(instruction).toContain('Your Kortix agent');
    expect(instruction).toContain('do not treat it');
    expect(instruction).toContain('as a question or a task to act on');
    expect(instruction).toContain('the connector works straight from the session');
  });

  test('an error with no readable cause still says something', () => {
    expect(kortixError(null).transcript).toBe('That request failed');
    expect(kortixError('  ').instruction).not.toContain('::');
  });

  test('Kortix speaks under its own name, not the bot voice', () => {
    // The worker labels what the voice ACTUALLY said with the bot's display
    // name (apps/voice-agent/src/transcripts.ts). These two are both the agent
    // side and must stay distinguishable.
    expect(KORTIX_SPEAKER).toBe('kortix');
  });
});

describe('promptVoiceAgent records what the room was given', () => {
  test('delivers the instruction and writes the payload as an agent turn', async () => {
    const res = await promptVoiceAgent('sess-1', kortixSay('deploy is green'), { projectId: 'proj-1' });

    expect(res.delivered).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.room).toBe('voice-sess-1');
    expect(sent[0]!.payload.type).toBe('kortix_reply');
    expect(sent[0]!.payload.text).toContain('[say]');

    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toEqual({
      callId: 'sess-1',
      projectId: 'proj-1',
      sessionId: 'sess-1',
      role: 'agent',
      speaker: 'kortix',
      text: 'deploy is green',
    });
  });

  test('resolves the project from the session when the caller has none', async () => {
    // turn.ts and answer-watch.ts only ever hold a session id — project_id is
    // NOT NULL on voice_call_turns, so a missing lookup here means the turn is
    // silently never recorded.
    dbResults = [[{ projectId: 'proj-9' }]];

    await promptVoiceAgent('sess-2', kortixResult('four tests failed'));

    expect(inserts).toHaveLength(1);
    expect(inserts[0]!.projectId).toBe('proj-9');
    expect(inserts[0]!.text).toBe('four tests failed');
  });

  test('records nothing when the room has no worker — the utterance was never delivered', async () => {
    agentInRoom = false;

    const res = await promptVoiceAgent('sess-3', kortixSay('nobody is listening'), { projectId: 'p' });

    expect(res.delivered).toBe(false);
    expect(res.reason).toContain('no voice agent');
    expect(sent).toHaveLength(0);
    expect(inserts).toHaveLength(0);
  });

  test('a failed transcript write never turns a delivered utterance into a failure', async () => {
    // Otherwise the agent believes the room did not hear it and says it again.
    insertThrows = true;

    const res = await promptVoiceAgent('sess-4', kortixSay('deploy is green'), { projectId: 'p' });

    expect(res.delivered).toBe(true);
    expect(sent).toHaveLength(1);
  });

  test('an unresolvable project degrades to "delivered but unrecorded", never to a throw', async () => {
    dbResults = [[]];
    const res = await promptVoiceAgent('sess-5', kortixResult('done'));
    expect(res.delivered).toBe(true);
    expect(inserts).toHaveLength(0);
  });
});

describe('in-call turn relay lands in the transcript', () => {
  test('an answer spoken into the call is recorded as an agent turn', async () => {
    dbResults = [[{ projectId: 'proj-1' }]];

    expect(await relayTurnAnswer('sess-answer', 'the migration applied cleanly')).toBe(true);

    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      role: 'agent',
      speaker: 'kortix',
      text: 'the migration applied cleanly',
      sessionId: 'sess-answer',
    });
  });

  test('a spoken progress step is recorded; a throttled one is not spoken and not recorded', async () => {
    dbResults = [[{ projectId: 'proj-1' }]];

    expect(await relayTurnStep('sess-step', 'reading the config')).toBe(true);
    expect(inserts).toHaveLength(1);
    expect(inserts[0]!.text).toContain('reading the config');

    // Throttled: nothing reaches the room, so nothing may claim it did.
    expect(await relayTurnStep('sess-step', 'writing the file')).toBe(false);
    expect(inserts).toHaveLength(1);
  });

  test('a clean end says nothing and therefore records nothing', async () => {
    expect(await relayTurnEnd('sess-end', 'idle')).toBe(false);
    expect(inserts).toHaveLength(0);
  });

  test('a failed turn is spoken and recorded with its cause', async () => {
    dbResults = [[{ projectId: 'proj-1' }]];

    expect(await relayTurnEnd('sess-err', 'error', { message: 'sandbox not ready' })).toBe(true);

    expect(inserts).toHaveLength(1);
    expect(inserts[0]!.text).toContain('sandbox not ready');
    expect(String(inserts[0]!.text)).not.toContain('[error]');
  });
});

/**
 * `db-deps.ts` pulls in most of the API to import, so its voice wiring is
 * asserted by reading the source — the same approach
 * unit-executor-router-deps.test.ts uses, and for the same reason: these are
 * one-line wirings whose absence is invisible until production.
 */
const DB_DEPS_SOURCE = await Bun.file(
  new URL('../executor/db-deps.ts', import.meta.url).pathname,
).text();

describe('kortix_voice connector wiring', () => {
  const source = DB_DEPS_SOURCE;

  test('send_prompt goes through kortixSay, so what it says is also what gets recorded', () => {
    expect(source).toContain("from '../channels/voice/utterance'");
    expect(source).toContain('kortixSay(text)');
    // The framing must live in utterance.ts next to the transcript line, not
    // be re-inlined here where nothing can record it.
    expect(source).not.toContain('[say] Your Kortix agent');
  });

  test('read_transcript hands back `speaker`, not just role and text', () => {
    // role 'agent' covers BOTH the voice speaking and the agent's own
    // send_prompt lines, and role 'tool' is meaningless without the tool name —
    // so a transcript without `speaker` is one the agent cannot attribute.
    const mapping = source.slice(source.indexOf('if (op === '), source.indexOf("if (op === 'send_prompt')"));
    expect(mapping).toContain('speaker: t.speaker');
  });
});

describe('voice_call_turns accepts the roles the code writes', () => {
  const migrations = new URL('../../../../packages/db/migrations/', import.meta.url).pathname;

  test("the CHECK constraint allows 'tool', so MCP tool lines are insertable", async () => {
    const sql = await Bun.file(`${migrations}20260726151842728_voice_call_turns_allow_tool_role.sql`).text();
    expect(sql).toContain(`CHECK ("role" IN ('user', 'agent', 'tool'))`);
  });

  test('the widened constraint is validated in a follow-up migration, not left NOT VALID forever', async () => {
    const sql = await Bun.file(`${migrations}20260726151944122_validate_voice_call_turns_role_check.sql`).text();
    expect(sql).toContain('VALIDATE CONSTRAINT');
    expect(sql).toContain('voice_call_turns_role_check');
  });
});
