import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { agentConfigEtag } from './compile-agent-config';
import { isConfigStale } from './session-reload';

describe('agentConfigEtag', () => {
  test('the same config hashes the same, a changed one does not', () => {
    const a = '{"agent":{"support":{"prompt":"v1"}}}';
    expect(agentConfigEtag(a)).toBe(agentConfigEtag(a));
    expect(agentConfigEtag(a)).not.toBe(agentConfigEtag('{"agent":{"support":{"prompt":"v2"}}}'));
  });

  test('no compiled config has no etag — not the hash of "null"', () => {
    // A v1 project has nothing to compare. Hashing the absence would give every
    // v1 project the same non-null etag and make "stale" answerable when it
    // is not.
    expect(agentConfigEtag(null)).toBeNull();
    expect(agentConfigEtag(undefined)).toBeNull();
    expect(agentConfigEtag('')).toBeNull();
  });

  test('it is short enough to read and long enough to compare', () => {
    expect(agentConfigEtag('{"agent":{}}')).toHaveLength(16);
    expect(agentConfigEtag('{"agent":{}}')).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('isConfigStale', () => {
  test('different hashes are stale, identical ones are not', () => {
    expect(isConfigStale('aaaa', 'bbbb')).toBe(true);
    expect(isConfigStale('aaaa', 'aaaa')).toBe(false);
  });

  test('an unknown side is null, NEVER false', () => {
    // "Up to date" and "could not ask" are different answers, and collapsing
    // them is exactly how a stale session goes unnoticed: an unreachable box
    // would report itself current. The CLI prints a warning for null rather
    // than a green tick.
    expect(isConfigStale(null, 'bbbb')).toBeNull();
    expect(isConfigStale('aaaa', null)).toBeNull();
    expect(isConfigStale(null, null)).toBeNull();
  });

  test('a project with no compiled config is unanswerable, not "current"', () => {
    // v1 projects compile to null on both sides.
    expect(isConfigStale(agentConfigEtag(null), agentConfigEtag(null))).toBeNull();
  });
});

/**
 * The workspace half of a reload — and the one thing it must never do.
 *
 * `base=1` routes the daemon to `syncWorkspaceToBase`, whose entire body is
 * `git checkout -B <cfg.branchName> <baseSha>` — and `cfg.branchName` is the
 * SESSION ID. On a session carrying commits of its own that force-moves the
 * working branch onto the base tip, orphaning them and deleting the files they
 * introduced, while the call still returns 200 and the UI says "Reloaded."
 *
 * The helper documents the precondition it needs — "safe because a fresh
 * session has no local work yet" — and its only other caller honours it, at
 * session CREATE on a restored warm snapshot. A reload runs against an
 * established session, so it must use the `--ff-only` path, which cannot
 * discard anything and fails cleanly on a branch that was never pushed.
 *
 * The obvious mitigation — gate the reset on "does this session have local
 * commits" — is not available: the API can only inspect the git mirror, and a
 * session branch committed but never pushed is not in it, so the check would
 * answer "no local work" for exactly the session with the most to lose.
 *
 * Asserted against the source because the function is private and closes over
 * `db`, `resolveSandboxIngress` and `fetch` with no injection seam. That is a
 * real limit: this pins the query and the response field, not the round trip.
 */
const SOURCE = readFileSync(join(import.meta.dir, 'session-reload.ts'), 'utf8');

function refreshBody(): string {
  const body = SOURCE.split('async function refreshSandboxWorkspace(')[1]?.split('\n}')[0];
  expect(body).toBeTruthy();
  return body as string;
}

describe('the reload never hard-resets the session branch', () => {
  test('it does NOT send base=1 — that path destroys committed session work', () => {
    const body = refreshBody();
    expect(body).not.toContain("base: '1'");
    expect(body).not.toContain('base=1');
    expect(body).not.toContain('base_sha');
  });

  test('it uses the plain refresh, which is git pull --ff-only', () => {
    // --ff-only is the whole safety property: it refuses rather than discards.
    expect(refreshBody()).toContain('/kortix/refresh?restart=0');
  });

  test('it does not resolve a base sha at all — nothing on this path needs one', () => {
    // Belt and braces: no base sha in scope means no way to reintroduce the
    // reset by wiring an existing local back into the query.
    expect(refreshBody()).not.toContain('resolveCommitSha');
  });

  test('both entry points drop the mirror TTL before reading it', () => {
    // The mirror caches for 60s. "I merged, now reload" happens inside that
    // window essentially every time, so without this the reload compiles the
    // pre-merge manifest and `--status` cheerfully agrees you are up to date.
    // `\n}\n` — a closing brace alone on a line. Splitting on `\n}` alone stops
    // at the end of the destructured input TYPE (`\n}): Promise<…>`), which cuts
    // the body off entirely and makes this pass for the wrong reason.
    const bodyOf = (name: string) =>
      SOURCE.split(`export async function ${name}(`)[1]?.split('\n}\n')[0];
    for (const name of ['reloadSessionConfig', 'latestAgentConfigEtag']) {
      const body = bodyOf(name);
      expect(body).toBeTruthy();
      expect(body).toContain('invalidateProjectMirror(input.projectId)');
    }
  });

  test('the commit is read from repo.after, the field the daemon actually sends', () => {
    // The daemon answers `{repo: {before, after}}`. Reading `repo.commit` gave
    // undefined every time, so `commit_sha` always reported the PRE-reload value
    // and a successful pull looked like a no-op.
    const body = refreshBody();
    expect(body).toContain('body.repo?.after?.commit');
    expect(body).not.toContain('body.repo?.commit');
  });
});
