import { beforeEach, describe, expect, mock, test } from 'bun:test';
// applyStoppedState — the single writer for "this sandbox is parked".
//
// The procedure used to be copy-pasted three times (reaper idle stop, reaper
// provider-confirmed reconcile, session-lifecycle/stop.ts) and had drifted: the
// manual-stop copy assigned a whole metadata object built from a row it had
// SELECTed moments earlier, dropping whatever a concurrent writer had put there
// in between, and the money-critical "settle the meter before flipping the
// status" order was carried by a comment repeated in each copy.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { projectSessions, sessionSandboxes } from '@kortix/db';
import * as realComputeMetering from '../../billing/services/compute-metering';
import { RUNTIME_WAKE_LEASE_MS } from '../session-lifecycle/runtime-wake-fence';
import { mockConfigModule } from './test-support/mock-config';

type UpdateCall = {
  table: unknown;
  updates: Record<string, unknown>;
  inTransaction: boolean;
};

let events: string[] = [];
let updateCalls: UpdateCall[] = [];
let cacheInvalidations: string[] = [];
let selectedRows: Array<Record<string, unknown>> = [];
let executedStatements: Array<{ sql: unknown; inTransaction: boolean }> = [];
let revokedTokens: Array<{ sessionId: string; accountId: string }> = [];
let preserveCalls: Array<{ sandboxId: string; reason: string; stopReason: string }> = [];
let inTransaction = false;
/** When set, every `tx.execute` fails with this message. */
let executeThrows: string | null = null;

mock.module('../../config', () => mockConfigModule());

const updater = (table: unknown) => ({
  set: (updates: Record<string, unknown>) => ({
    where: async () => {
      events.push(`update:${table === sessionSandboxes ? 'sandbox' : 'session'}`);
      updateCalls.push({ table, updates, inTransaction });
    },
  }),
});

const executor = async (statement: unknown) => {
  events.push('execute');
  executedStatements.push({ sql: statement, inTransaction });
  if (executeThrows) throw new Error(executeThrows);
};

/**
 * A nested drizzle transaction, which the postgres.js driver implements as
 * `savepoint sN` / `rollback to sN` + rethrow. Emulated here because that is
 * exactly the mechanism keeping a failed ledger write from taking the stop's
 * two status flips down with it.
 */
const savepoint = async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
  events.push('savepoint:begin');
  try {
    const result = await fn(transactionScope);
    events.push('savepoint:release');
    return result;
  } catch (error) {
    events.push('savepoint:rollback');
    throw error;
  }
};

const transactionScope = { update: updater, execute: executor, transaction: savepoint };

mock.module('../../shared/db', () => ({
  db: {
    transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      events.push('tx:begin');
      inTransaction = true;
      try {
        return await fn(transactionScope);
      } finally {
        inTransaction = false;
        events.push('tx:commit');
      }
    },
    update: updater,
    execute: executor,
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => selectedRows }),
      }),
    }),
  },
}));

mock.module('../../sandbox-proxy', () => ({
  invalidateProviderCache: (externalId: string) => {
    cacheInvalidations.push(externalId);
  },
}));

// Spread the real module: `mock.module` replaces it WHOLESALE, so a stub that
// lists exports by hand deletes every export it omits — the failure surfaces in
// whatever unrelated file imports the missing name next, attributed to no test.
mock.module('../../billing/services/compute-metering', () => ({
  ...realComputeMetering,
  pauseComputeSession: async (sandboxId: string) => {
    events.push(`pause:${sandboxId}`);
  },
  endComputeSession: async () => {},
  reopenComputeForSandbox: async () => undefined,
}));

mock.module('../../repositories/account-tokens', () => ({
  revokeSessionConnectorTokens: async (sessionId: string, accountId: string) => {
    revokedTokens.push({ sessionId, accountId });
    return 1;
  },
}));

mock.module('../runtime-identity', () => ({
  preserveEstablishedRuntime: async (
    row: { sandboxId: string },
    reason: string,
    stopReason: string,
  ) => {
    preserveCalls.push({ sandboxId: row.sandboxId, reason, stopReason });
    return row;
  },
}));

const {
  applyStoppedState,
  reconcileSandboxRemovedByExternalId,
  reconcileSandboxStoppedByExternalId,
} = await import('./sandbox-state-sync');

/** Flatten a drizzle SQL expression (including its bound params) to text, so a
 *  test can assert what the write actually asks Postgres to do. */
function describeSql(expression: unknown): string {
  const chunks = (expression as { queryChunks?: unknown[] } | null)?.queryChunks ?? [];
  return chunks
    .map((chunk) => {
      if (typeof chunk === 'string') return chunk;
      if (!chunk || typeof chunk !== 'object') return '';
      const value = (chunk as { value?: unknown }).value;
      if (Array.isArray(value)) return value.join('');
      if (typeof value === 'string') return value;
      return (chunk as { name?: string }).name ?? '';
    })
    .join(' ');
}

const isSqlExpression = (value: unknown): boolean =>
  Array.isArray((value as { queryChunks?: unknown[] } | null)?.queryChunks);
const sandboxUpdate = () => updateCalls.find((c) => c.table === sessionSandboxes);
const sessionUpdate = () => updateCalls.find((c) => c.table === projectSessions);

const NOW = new Date('2026-07-29T12:00:00.000Z');
const write = {
  sandboxId: 'sb-1',
  sessionId: 'sess-1',
  externalId: 'ext-1',
  stopReason: 'deadline_expired' as const,
  now: NOW,
};

beforeEach(() => {
  events = [];
  updateCalls = [];
  cacheInvalidations = [];
  selectedRows = [];
  executedStatements = [];
  revokedTokens = [];
  preserveCalls = [];
  inTransaction = false;
  executeThrows = null;
});

describe('applyStoppedState', () => {
  test('settles the meter before either status flip', async () => {
    await applyStoppedState(write);

    expect(events.indexOf('pause:sb-1')).toBeLessThan(events.indexOf('update:sandbox'));
    expect(events.indexOf('pause:sb-1')).toBeLessThan(events.indexOf('update:session'));
  });

  test('flips the sandbox row and the session row in ONE transaction', async () => {
    await applyStoppedState(write);

    expect(sandboxUpdate()?.inTransaction).toBe(true);
    expect(sessionUpdate()?.inTransaction).toBe(true);
    expect(events.filter((e) => e === 'tx:begin')).toHaveLength(1);
    expect(sandboxUpdate()?.updates.status).toBe('stopped');
    expect(sessionUpdate()?.updates.status).toBe('stopped');
  });

  test('a billing failure never blocks the stop', async () => {
    mock.module('../../billing/services/compute-metering', () => ({
      ...realComputeMetering,
      pauseComputeSession: async () => {
        throw new Error('wallet unreachable');
      },
      endComputeSession: async () => {},
      reopenComputeForSandbox: async () => undefined,
    }));
    const warn = console.warn;
    console.warn = () => {};
    try {
      await applyStoppedState(write);
    } finally {
      console.warn = warn;
      mock.module('../../billing/services/compute-metering', () => ({
        ...realComputeMetering,
        pauseComputeSession: async (sandboxId: string) => {
          events.push(`pause:${sandboxId}`);
        },
        endComputeSession: async () => {},
        reopenComputeForSandbox: async () => undefined,
      }));
    }

    expect(sandboxUpdate()?.updates.status).toBe('stopped');
  });

  // stopReason is now required on every write, so the metadata merge is never
  // empty even when the caller has no extra patch of its own — it always
  // carries at least stopReason + stoppedAt.
  test('no caller patch still merges stopReason and stoppedAt', async () => {
    await applyStoppedState(write);

    const rendered = describeSql(sandboxUpdate()?.updates.metadata);
    expect(rendered).toContain('deadline_expired');
    expect(rendered).toContain('stoppedAt');
    // The same statement also DROPS the in-flight wake keys, so a committed
    // stop wins the start/stop race in both orderings.
    expect(rendered).toContain('runtimeWakeId');
    expect(rendered).toContain('runtimeWakeStartedAt');
  });

  test('atomically removes all turn authority when any stop path parks the sandbox', async () => {
    await applyStoppedState(write);

    const rendered = describeSql(sandboxUpdate()?.updates.metadata);
    expect(rendered).toContain("- 'activeTurn'");
    expect(rendered).toContain("- 'activeTurns'");
    expect(rendered).toContain("- 'lifecycleStopClaim'");
  });

  // Erasing the turn authority above makes every token-scoped ledger settle
  // impossible afterwards: they all CAS against the metadata entry this
  // statement just deleted. A turn that was in flight would keep claiming to be
  // running for ever — the exact stuck-busy signal session_turns exists to
  // answer. So the settle rides in the SAME transaction.
  test('settles every open session_turns row of the sandbox, inside the stop transaction', async () => {
    await applyStoppedState(write);

    expect(executedStatements).toHaveLength(1);
    const [settle] = executedStatements;
    expect(settle.inTransaction).toBe(true);
    const rendered = describeSql(settle.sql);
    expect(rendered).toContain('UPDATE kortix.session_turns');
    expect(rendered).toContain("state = 'ended'");
    expect(rendered).toContain('runtime_gone');
    expect(rendered).toContain('sb-1');
    // Keyed by sandbox and scoped to rows that are still open.
    expect(rendered).toContain('sandbox_id');
    expect(rendered).toContain("state <> 'ended'");
    // Ordered after the erasure, never before: a settle that ran first would
    // leave a turn started in between unsettled.
    expect(events.indexOf('update:sandbox')).toBeLessThan(events.indexOf('execute'));
    expect(events.indexOf('execute')).toBeLessThan(events.indexOf('tx:commit'));
  });

  // THE PROVIDER BOX IS ALREADY OFF by the time this runs (stop-box.ts calls
  // provider.stop() before applyStoppedState, and so does parkEstablishedRuntime).
  // If a session_turns failure could abort this transaction, the row would stay
  // 'active' and its session 'running' against a dead box, with metering already
  // paused — and every retry would fail identically for as long as the cause
  // lasted (a lock timeout, a rollout ahead of migrate-db, a migration holding
  // ACCESS EXCLUSIVE). A best-effort observation table must never own that.
  test('a failing ledger settle rolls back to its savepoint and the stop still commits', async () => {
    executeThrows = 'relation "kortix.session_turns" does not exist';
    const error = console.error;
    console.error = () => {};
    try {
      await expect(applyStoppedState(write)).resolves.toBeUndefined();
    } finally {
      console.error = error;
    }

    // Both status flips are still there, and the transaction still committed.
    expect(sandboxUpdate()?.updates.status).toBe('stopped');
    expect(sessionUpdate()?.updates.status).toBe('stopped');
    expect(events).toContain('tx:commit');
    // Bounded by a savepoint, so only the ledger statement is undone. Without
    // one, Postgres marks the whole transaction aborted and both flips are lost.
    expect(events).toContain('savepoint:rollback');
    expect(events.indexOf('savepoint:begin')).toBeLessThan(events.indexOf('execute'));
  });

  test('a successful ledger settle releases its savepoint', async () => {
    await applyStoppedState(write);

    expect(events).toContain('savepoint:release');
    expect(events).not.toContain('savepoint:rollback');
  });

  // The lost update: a whole-object write assembled from a stale SELECT drops
  // whatever a concurrent writer put in the column in between — the
  // `runtimeWakeId` wake fence (projects/routes/shared.ts) and, one table over,
  // the `lastAliveAt` stamp the compute clamp bills against.
  //
  // The fixture deliberately avoids a `stopReason` key inside `metadata` here:
  // `write.stopReason` (top-level, required) always wins over one nested in
  // `metadata` — see the precedence test below — so putting it here would
  // read as though the nested value mattered when it never lands.
  test('REGRESSION: the caller patch is MERGED into jsonb, never assigned', async () => {
    await applyStoppedState({
      ...write,
      metadata: { stoppedBy: 'user-1' },
    });

    const metadata = sandboxUpdate()?.updates.metadata;
    expect(isSqlExpression(metadata)).toBe(true);
    const rendered = describeSql(metadata);
    expect(rendered).toContain('coalesce');
    expect(rendered).toContain("'{}'::jsonb");
    expect(rendered).toContain('stopReason');
    expect(rendered).toContain('stoppedBy');
  });

  test('the caller patch is the whole merge', async () => {
    await applyStoppedState({ ...write, metadata: { customField: 'x' } });

    const rendered = describeSql(sandboxUpdate()?.updates.metadata);
    expect(rendered).toContain('customField');
  });

  test('drops the proxy cache, and tolerates a row with no external id', async () => {
    await applyStoppedState(write);
    expect(cacheInvalidations).toEqual(['ext-1']);

    cacheInvalidations = [];
    await applyStoppedState({ ...write, externalId: null });
    expect(cacheInvalidations).toEqual([]);
  });
});

describe('reconcileSandboxStoppedByExternalId', () => {
  test('routes a provider-confirmed stop through the single writer', async () => {
    selectedRows = [{ sandboxId: 'sb-1', sessionId: 'sess-1', status: 'active' }];

    expect(await reconcileSandboxStoppedByExternalId('ext-1', NOW)).toBe(true);
    // The money-critical order: settle the meter against the still-active row
    // BEFORE flipping either status.
    expect(events.indexOf('pause:sb-1')).toBeLessThan(events.indexOf('update:sandbox'));
    expect(cacheInvalidations).toEqual(['ext-1']);
  });

  test('a row already stopped is a no-op', async () => {
    selectedRows = [{ sandboxId: 'sb-1', sessionId: 'sess-1', status: 'stopped' }];

    expect(await reconcileSandboxStoppedByExternalId('ext-1', NOW)).toBe(false);
    expect(updateCalls).toEqual([]);
  });

  test('a fresh wake fence defers a transient provider-stopped observation', async () => {
    selectedRows = [
      {
        sandboxId: 'sb-1',
        sessionId: 'sess-1',
        status: 'active',
        metadata: {
          runtimeWakeId: 'wake-1',
          runtimeWakeStartedAt: new Date(NOW.getTime() - 5_000).toISOString(),
        },
      },
    ];

    expect(await reconcileSandboxStoppedByExternalId('ext-1', NOW)).toBe(false);
    expect(events).toEqual([]);
  });

  test('an expired wake fence does not hide a provider-stopped sandbox', async () => {
    selectedRows = [
      {
        sandboxId: 'sb-1',
        sessionId: 'sess-1',
        status: 'active',
        metadata: {
          runtimeWakeId: 'wake-1',
          runtimeWakeStartedAt: new Date(NOW.getTime() - RUNTIME_WAKE_LEASE_MS - 1).toISOString(),
        },
      },
    ];

    expect(await reconcileSandboxStoppedByExternalId('ext-1', NOW)).toBe(true);
    expect(events).toContain('pause:sb-1');
  });
});

describe('reconcileSandboxRemovedByExternalId', () => {
  // A removed box can never be woken, so its connector token is a bearer
  // credential with no owner and nothing else ever expires it.
  test('SECURITY: revokes the session connector tokens for a removed sandbox', async () => {
    selectedRows = [
      {
        sandboxId: 'sb-1',
        sessionId: 'sess-1',
        accountId: 'acct-1',
        externalId: 'ext-1',
        metadata: {},
        status: 'active',
      },
    ];

    expect(await reconcileSandboxRemovedByExternalId('ext-1', NOW)).toBe(true);
    // A webhook `removed` is one of the three genuine provider-removal signals
    // (this, the reaper's status poll, and a /start status check that came back
    // `removed`), so it is one of the shapes allowed to stamp `provider_removed`.
    // Every other preserve path (failed wake, failed restart, stalled provision)
    // stamps its own reason — see stop-reason.ts.
    expect(preserveCalls).toEqual([
      { sandboxId: 'sb-1', reason: 'provider_webhook_removed', stopReason: 'provider_removed' },
    ]);
    expect(revokedTokens).toEqual([{ sessionId: 'sess-1', accountId: 'acct-1' }]);
  });
});

describe('applyStoppedState — stopReason', () => {
  test('merges the reason into the sandbox metadata patch', async () => {
    // (state is reset by the file's top-level beforeEach, run before every test)
    await applyStoppedState({
      sandboxId: 'sb-1',
      sessionId: 'se-1',
      externalId: 'ext-1',
      stopReason: 'deadline_expired',
    });
    const update = sandboxUpdate();
    expect(update).toBeDefined();
    // The write must be a jsonb MERGE, never a whole-object assign — a concurrent
    // writer's runtimeWakeId / lastAliveAt live in the same column.
    expect(update?.updates.metadata).toBeDefined();
    // `updates.metadata` is a drizzle SQL AST (circular via its column/table
    // refs) — describeSql renders it to text the same way every other test in
    // this file asserts against it; a raw JSON.stringify throws on the cycle.
    expect(describeSql(update?.updates.metadata)).toContain('deadline_expired');
  });

  // The top-level field is the one source of truth for WHY a box parked. A
  // caller-supplied `metadata.stopReason` (e.g. an older copy-pasted patch)
  // must never leak into the write — only the required top-level value can.
  test('the top-level stopReason wins over a conflicting metadata.stopReason', async () => {
    await applyStoppedState({
      sandboxId: 'sb-1',
      sessionId: 'se-1',
      externalId: 'ext-1',
      stopReason: 'run_cap',
      metadata: { stopReason: 'manual' },
    });

    const rendered = describeSql(sandboxUpdate()?.updates.metadata);
    expect(rendered).toContain('run_cap');
    expect(rendered).not.toContain('manual');
  });
});

// `ended_at` is what every reader treats as "closed forever":
// getOpenComputeSession keys off `IS NULL`, the usage rollup coalesces to it,
// and the reimburse script bounds refunds by it. Two independent writers is how
// a window gets settled to one instant and stamped with another.
describe('the ended_at single-writer invariant', () => {
  const API_SRC = join(import.meta.dir, '..', '..');

  function sourceFiles(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        sourceFiles(full, out);
      } else if (entry.name.endsWith('.ts') && !entry.name.includes('.test.')) {
        out.push(full);
      }
    }
    return out;
  }

  // `endedAt:` is a proxy for "assigns this column", and the bare string also
  // appears in code that has nothing to do with compute sessions — a drizzle
  // SELECT projection on another table with an `ended_at` column reads
  // `endedAt: someTable.endedAt` (kortix.session_turns has one, and
  // projects/routes/r8.ts projects it). Scope the scan to modules that could
  // actually write THIS column: composing that statement means naming the
  // table, through the drizzle symbol or in raw SQL. A module that never names
  // it cannot assign it, so excluding those loses no writer — and the
  // assertion below still pins the surviving writer by file AND hit count.
  const NAMES_COMPUTE_SESSIONS = /sandboxComputeSessions|sandbox_compute_sessions/;

  test('exactly one module assigns sandbox_compute_sessions.ended_at', () => {
    const writers = sourceFiles(API_SRC)
      .map((file) => ({ file: file.slice(API_SRC.length + 1), src: readFileSync(file, 'utf8') }))
      .filter((entry) => NAMES_COMPUTE_SESSIONS.test(entry.src))
      .map((entry) => ({
        file: entry.file,
        hits: (entry.src.match(/endedAt:\s/g) ?? []).length,
      }))
      .filter((entry) => entry.hits > 0);

    expect(writers).toEqual([{ file: 'billing/repositories/compute-sessions.ts', hits: 2 }]);
  });

  // The scoping above is only sound if it cannot hide a writer. Prove the
  // filter admits the module that owns the column rather than merely counting
  // zero everywhere.
  test('the scan still reaches the module that owns the column', () => {
    const owner = sourceFiles(API_SRC).find((file) =>
      file.endsWith(join('billing', 'repositories', 'compute-sessions.ts')),
    );
    expect(owner).toBeDefined();
    expect(NAMES_COMPUTE_SESSIONS.test(readFileSync(owner as string, 'utf8'))).toBe(true);
  });
});
