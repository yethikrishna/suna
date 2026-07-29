import { beforeEach, describe, expect, mock, test } from 'bun:test';

// The module only ever issues raw SQL, so the assertions below are about the
// STATEMENT SHAPE — which is the whole safety argument: an extend must contain
// both LEAST (the cap) and GREATEST (monotonicity), a shorten must contain
// LEAST and never GREATEST, and neither may assign active_since.
let executed: string[] = [];

/** Flatten a drizzle SQL tree — literal chunks, bound params, and nested
 *  fragments — into text, so a test can assert what Postgres is actually asked
 *  to do rather than trusting the TypeScript that assembled it. */
function render(query: unknown): string {
  if (query === null || query === undefined) return '';
  // Interpolated primitives are stored raw by drizzle, not wrapped in Param.
  if (typeof query !== 'object') return String(query);
  const node = query as { queryChunks?: unknown[]; value?: unknown; name?: unknown };
  if (Array.isArray(node.queryChunks)) return node.queryChunks.map(render).join(' ');
  if (Array.isArray(node.value)) return node.value.join('');
  if (node.value !== undefined) return String(node.value);
  if (node.name !== undefined) return String(node.name);
  return '';
}

mock.module('../config', () => ({ config: { KORTIX_SANDBOX_AUTOSTOP_MINUTES: 15 } }));
mock.module('../shared/db', () => ({
  db: {
    execute: async (query: unknown) => {
      executed.push(render(query));
    },
  },
}));

const {
  ABSOLUTE_RUN_CAP_MS,
  extendSandboxDeadline,
  idleGraceMs,
  isSandboxAuthored,
  isTurnStartRequest,
  shortenSandboxDeadline,
  turnGrantMs,
} = await import('./sandbox-deadline');

beforeEach(() => {
  executed = [];
  delete process.env.KORTIX_SANDBOX_TURN_GRANT_MINUTES;
});

describe('the constants', () => {
  test('the generous ceiling is 4h by default — above p99, below the 264h worst case', () => {
    expect(turnGrantMs()).toBe(4 * 3_600_000);
  });

  test('the idle grace reuses KORTIX_SANDBOX_AUTOSTOP_MINUTES, already 15 in prod', () => {
    expect(idleGraceMs()).toBe(15 * 60_000);
  });

  test('the absolute cap mirrors the DB CHECK at 24h', () => {
    expect(ABSOLUTE_RUN_CAP_MS).toBe(24 * 3_600_000);
  });

  test('the grant is tunable, so it can be tightened without a code change', () => {
    process.env.KORTIX_SANDBOX_TURN_GRANT_MINUTES = '60';
    expect(turnGrantMs()).toBe(60 * 60_000);
  });

  // The documented kill switch: a grant longer than the cap makes every extend
  // clamp at active_since + 24h, neutralising the feature with no rollback.
  test('KILL SWITCH: an absurd grant still cannot exceed the cap', () => {
    process.env.KORTIX_SANDBOX_TURN_GRANT_MINUTES = '100000';
    expect(turnGrantMs()).toBeGreaterThan(ABSOLUTE_RUN_CAP_MS);
  });
});

describe('extendSandboxDeadline — control-plane-observed, monotone, capped', () => {
  test('clamps to active_since + the cap AND never moves the deadline backwards', async () => {
    await extendSandboxDeadline({ sessionId: 'sess-1' });

    const [sql] = executed;
    expect(sql).toContain('LEAST'); // the cap
    expect(sql).toContain('GREATEST'); // monotonic: a concurrent extend can't be lost
    expect(sql).toContain('active_since +');
    expect(sql).toContain('86400'); // ABSOLUTE_RUN_CAP_MS in seconds
    expect(sql).toContain('14400'); // the 4h grant in seconds
  });

  test('NEVER assigns active_since — the DB trigger owns the anchor', async () => {
    await extendSandboxDeadline({ sessionId: 'sess-1' });

    expect(executed[0]).not.toMatch(/SET[\s\S]*active_since\s*=/);
  });

  // Times are computed by Postgres from intervals, so API-pod clock skew cannot
  // reach the money path and the write stays a single monotone statement.
  test('passes the grant as an INTERVAL against SQL now(), not a computed instant', async () => {
    await extendSandboxDeadline({ sessionId: 'sess-1' });

    expect(executed[0]).toContain('make_interval');
    expect(executed[0]).toContain('now()');
  });

  test('only ever touches a live box', async () => {
    await extendSandboxDeadline({ sessionId: 'sess-1' });

    expect(executed[0]).toContain("status IN ('active', 'provisioning')");
  });

  test('addresses a box by sandbox id, session id, or external id', async () => {
    await extendSandboxDeadline({ sandboxId: 'sb-1' });
    await extendSandboxDeadline({ sessionId: 'sess-1' });
    await extendSandboxDeadline({ externalId: 'ext-1' });

    expect(executed[0]).toContain('sandbox_id');
    expect(executed[1]).toContain('session_id');
    expect(executed[2]).toContain('external_id');
  });
});

describe('shortenSandboxDeadline — sandbox-reported, structurally unable to extend', () => {
  // THE INVARIANT, mechanised: because the statement is LEAST-only, it does not
  // matter that the sandbox is the one reporting the turn end. It can be
  // best-effort, duplicated, and replayed without ever prolonging a box.
  test('is LEAST-only: no GREATEST, so it can never push a deadline out', async () => {
    await shortenSandboxDeadline('sess-1');

    expect(executed[0]).toContain('LEAST');
    expect(executed[0]).not.toContain('GREATEST');
  });

  test('does not read or write the anchor, and needs no cap', async () => {
    await shortenSandboxDeadline('sess-1');

    expect(executed[0]).not.toContain('active_since');
    expect(executed[0]).not.toContain('86400');
  });

  test('grants the 15-minute idle tail', async () => {
    await shortenSandboxDeadline('sess-1');

    expect(executed[0]).toContain('900'); // 15 min in seconds
  });
});

describe('isTurnStartRequest — what the control plane counts as OBSERVING a run', () => {
  const AGENT = 8000;
  const OPENCODE = 4096;

  test('every real prompt-delivery path on both ports', () => {
    for (const port of [AGENT, OPENCODE]) {
      expect(isTurnStartRequest(port, 'POST', '/session/abc/prompt_async')).toBe(true);
      expect(isTurnStartRequest(port, 'POST', '/session/abc/message')).toBe(true);
      // /command and /summarize start a real, billable turn too — a classifier
      // that admitted only prompt_async/message would kill a box mid-command.
      expect(isTurnStartRequest(port, 'POST', '/session/abc/command')).toBe(true);
      expect(isTurnStartRequest(port, 'POST', '/session/abc/summarize')).toBe(true);
      expect(isTurnStartRequest(port, 'POST', '/kortix/acp')).toBe(true);
    }
  });

  test('unwraps the in-box dynamic-port nesting', () => {
    expect(isTurnStartRequest(AGENT, 'POST', '/proxy/4096/session/abc/prompt_async')).toBe(true);
  });

  test('tolerates a query string or fragment on the boundary', () => {
    expect(
      isTurnStartRequest(AGENT, 'POST', '/session/abc/prompt_async?directory=/workspace'),
    ).toBe(true);
    expect(isTurnStartRequest(AGENT, 'POST', '/kortix/acp?x=1')).toBe(true);
  });

  test('a GET never starts a turn — passive polling must not extend a box', () => {
    expect(isTurnStartRequest(AGENT, 'GET', '/session/abc/prompt_async')).toBe(false);
    expect(isTurnStartRequest(AGENT, 'GET', '/session/abc/message')).toBe(false);
  });

  test('an app port is not a turn start, whatever the path looks like', () => {
    expect(isTurnStartRequest(3000, 'POST', '/session/abc/prompt_async')).toBe(false);
  });

  test('read-only and lookalike paths are not turn starts', () => {
    expect(isTurnStartRequest(AGENT, 'POST', '/session/abc/status')).toBe(false);
    expect(isTurnStartRequest(AGENT, 'POST', '/session')).toBe(false);
    expect(isTurnStartRequest(AGENT, 'POST', '/kortix/acpx')).toBe(false);
    expect(isTurnStartRequest(AGENT, 'POST', '/session/abc/prompt_asyncx')).toBe(false);
  });
});

// The box holds TWO credentials that authenticate perfectly well. If either one
// is classified as a control-plane observation, the sandbox can renew its own
// deadline forever and the self-granted lease this design deletes is rebuilt.
describe('isSandboxAuthored — the box may never extend its own life', () => {
  test('the kortix_sb_ sandbox token is sandbox-authored', () => {
    expect(isSandboxAuthored('sandbox', null)).toBe(true);
  });

  test('a SESSION-SCOPED PAT is sandbox-authored even though apiKeyType is unset', () => {
    // KORTIX_CLI_TOKEN / KORTIX_EXECUTOR_TOKEN: injected into every box and used
    // by the in-box `kortix` CLI. Its auth branch never sets apiKeyType, so a
    // gate testing apiKeyType alone let the box hold itself open indefinitely.
    expect(isSandboxAuthored(undefined, 'session-abc')).toBe(true);
    expect(isSandboxAuthored(null, 'session-abc')).toBe(true);
    expect(isSandboxAuthored('user', 'session-abc')).toBe(true);
  });

  test('a real user credential is NOT sandbox-authored and may extend', () => {
    // Browser JWT and a non-session-bound personal PAT both resolve sessionId
    // to null, so a human prompting from the UI or their laptop CLI still
    // pushes the deadline out.
    expect(isSandboxAuthored(undefined, null)).toBe(false);
    expect(isSandboxAuthored('user', null)).toBe(false);
    expect(isSandboxAuthored(undefined, undefined)).toBe(false);
  });
});
