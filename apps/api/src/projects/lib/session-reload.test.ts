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
 * The workspace half of a reload — the part that silently did nothing.
 *
 * `refreshSandboxWorkspace` posted `/kortix/refresh?restart=0` with no `base=1`.
 * Without that flag the daemon runs `refreshRepo`, which pulls `cfg.branchName`
 * — and the API sets `KORTIX_BRANCH_NAME` to the SESSION ID. So the reload asked
 * the sandbox to pull `refs/heads/<sessionId>`: a throw for a session whose
 * branch was never pushed, and for a pushed one a pull of the session's own
 * branch, which cannot contain the merge the user is reloading to collect.
 * The throw was swallowed and the CLI still printed "Reloaded."
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

describe('the reload pulls the BASE ref, not the session branch', () => {
  test('it sends base=1', () => {
    expect(refreshBody()).toContain("base: '1'");
  });

  test('base_sha is resolved from the session ref, falling back to the default branch', () => {
    // Same ref the compiler reads. If these two diverged, the workspace and the
    // compiled config would describe different commits and the reload would
    // half-apply.
    expect(refreshBody()).toContain('project.baseRef ?? project.defaultBranch');
  });

  test('it still skips the restart — the config push right after does one', () => {
    expect(refreshBody()).toContain("restart: '0'");
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
