/**
 * A reload must never leave the session without an opencode.
 *
 * The old path was `stop()` then `start()` — kill the only opencode, then hope
 * the replacement boots. When it did not (a config the build rejects, a bad
 * agent file, a failed dependency install) the session was left with nothing,
 * and the reload had destroyed the thing it was meant to update.
 *
 * Marko's shape, from the call: "It actually has to keep the process running,
 * make sure that the new process works. If the new process works, swap out the
 * old process for the new one." So: boot the candidate, verify it SERVES, then
 * swap and retire the old one.
 *
 * These assert on source structure. The supervisor owns real child processes,
 * real ports and a real readiness probe; spawning opencode in unit tests would
 * be slow and flaky. What regresses here is the ORDERING and the FAILURE
 * BRANCH — kill-before-verify, or treating a failed boot as success — and both
 * are visible in the source. The live swap is exercised on dev.
 */
import { describe, expect, test } from 'bun:test';

const SRC = await Bun.file(new URL('../opencode.ts', import.meta.url).pathname).text();
const CONFIG = await Bun.file(new URL('../config.ts', import.meta.url).pathname).text();
const PROXY = await Bun.file(new URL('../proxy.ts', import.meta.url).pathname).text();
const REFRESH = await Bun.file(new URL('../routes/refresh.ts', import.meta.url).pathname).text();

/** `verifyCandidateBoots`'s body, comments stripped. */
function reloadBody(): string {
  const start = SRC.indexOf('async function verifyCandidateBoots(');
  expect(start).toBeGreaterThan(-1);
  const rest = SRC.slice(start);
  const end = rest.indexOf('\n  /**\n   * Poll the real session API');
  const body = end > 0 ? rest.slice(0, end) : rest;
  return body
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .join('\n');
}

describe('the candidate boots before anything is killed', () => {
  const body = reloadBody();

  test('spawns the candidate on the standby port, unsupervised', () => {
    expect(body).toContain('opencodeStandbyPort');
    expect(body).toContain('supervise: false');
  });

  test('the verdict comes from a real boot, not an assumption', () => {
    const probeAt = body.indexOf('probeUntilReady');
    const spawnAt = body.indexOf('spawnChild(binaryPath');
    expect(spawnAt).toBeGreaterThan(-1);
    expect(probeAt).toBeGreaterThan(spawnAt);
  });

  test('never touches the running opencode during verification', () => {
    // The running instance keeps serving for the whole trial. Anything that
    // stopped or replaced it here would reintroduce the outage this prevents.
    expect(body).not.toContain('this.restart()');
    expect(body).not.toContain("stop('SIGTERM')");
    expect(body).not.toContain('child = candidate');
  });

  test('always retires the candidate, pass or fail', () => {
    // It was only ever a trial. Left running it holds the standby port and a
    // second opencode against the same workspace.
    expect(body).toContain('killProcessGroup(candidate');
  });
});

describe('when the candidate never comes up', () => {
  const body = reloadBody();

  test('says why, so the caller can report a failed reload', () => {
    // `verifyCandidateBoots` returns the verdict; `reloadVerified` turns a
    // false into outcome: 'kept-old' with this reason attached.
    expect(body).toMatch(/reason:/);
    const method = SRC.slice(SRC.indexOf('async reloadVerified('));
    expect(method).toContain("outcome: 'kept-old'");
    expect(method).toContain('proven.reason');
  });

  test('reports ok:false rather than throwing', () => {
    // The caller turns this into a reported failed reload on a healthy session.
    // A throw would read as a broken box.
    expect(body).toContain('return { ok: false');
  });
});

describe('readiness means the session API answers', () => {
  test('probes the real session API, not a port check', () => {
    // opencode binds its port seconds before the project directory is usable.
    // A TCP or plain-health check would call a half-open process ready and we
    // would swap onto something that cannot answer a prompt.
    const probe = SRC.slice(SRC.indexOf('async function probeUntilReady'));
    expect(probe).toContain('probeOpencodeSessionApi');
  });

  test('gives up early if the candidate dies', () => {
    const probe = SRC.slice(SRC.indexOf('async function probeUntilReady'));
    expect(probe).toContain('proc.exitCode !== null');
  });
});

describe('the port pair', () => {
  test('both halves are fixed config, not allocated at reload time', () => {
    expect(CONFIG).toContain('KORTIX_OPENCODE_STANDBY_PORT');
    expect(CONFIG).toContain('opencodeStandbyPort');
  });

  test('both halves are blocked in the web proxy self-port set', () => {
    // The reason the pair is fixed. This set is built once at startup, so an
    // ephemeral candidate port would be unguarded the moment it went live —
    // an unproxied route from the sandbox to its own opencode.
    const call = PROXY.slice(PROXY.indexOf('blockedSelfPorts'), PROXY.indexOf('blockedSelfPorts') + 260);
    expect(call).toContain('cfg.opencodeInternalPort');
    expect(call).toContain('cfg.opencodeStandbyPort');
  });

  test('the LIVE port never moves — the candidate only ever borrows the standby', () => {
    // Serving from the standby would save a boot and is not worth it: the API
    // decides from the port number whether traffic is the session's
    // conversation, whether it may be publicly shared, whether it counts as
    // preview use for the sandbox deadline, how Platinum rewrites ingress, and
    // where an opencode PTY connects. Each fails silently if the live port
    // moves. Keeping 4096 canonical means nothing outside the box has to know.
    const body = reloadBody();
    expect(body).not.toContain('currentCfg.opencodeInternalPort =');
    expect(body).toContain('currentCfg.opencodeStandbyPort');
  });
});

describe('reloadVerified orders verification before the restart', () => {
  /** The method body, comments stripped. */
  function methodBody(): string {
    const start = SRC.indexOf('async reloadVerified(');
    expect(start).toBeGreaterThan(-1);
    const body = SRC.slice(start, SRC.indexOf('\n    },', start));
    return body
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n');
  }

  test('verifies BEFORE restarting — the entire point', () => {
    // Restart first and this is the old kill-then-hope path with a verification
    // step bolted on after the damage. Nothing else in this file notices, which
    // is exactly why it is asserted here.
    const body = methodBody();
    const verifyAt = body.indexOf('verifyCandidateBoots(');
    const restartAt = body.indexOf('this.restart()');
    expect(verifyAt).toBeGreaterThan(-1);
    expect(restartAt).toBeGreaterThan(-1);
    expect(verifyAt).toBeLessThan(restartAt);
  });

  test('returns kept-old WITHOUT restarting when verification fails', () => {
    // The early return is what protects the running opencode. Falling through
    // to the restart would kill it for a config already known not to boot.
    const body = methodBody();
    const guardAt = body.indexOf('if (!proven.ok) return');
    expect(guardAt).toBeGreaterThan(-1);
    expect(guardAt).toBeLessThan(body.indexOf('this.restart()'));
  });
});

describe('callers get the outcome', () => {
  test('reloadConfig verifies before it restarts', () => {
    const reload = SRC.split('async reloadConfig(')[1]?.split('\n    },')[0] ?? '';
    const code = reload
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n');
    expect(code).toContain('this.reloadVerified(');
  });

  test('reloadConfig reports kept-old rather than claiming success', () => {
    const reload = SRC.split('async reloadConfig(')[1]?.split('\n    },')[0] ?? '';
    expect(reload).toContain("return 'kept-old'");
  });

  test('the refresh route returns the outcome so CLI and web can show it', () => {
    expect(REFRESH).toContain('opencode.reloadVerified(');
    expect(REFRESH).toContain('outcome: reload.outcome');
    // The reason has to reach the user — "reload failed" with no cause is the
    // whole complaint about the old behaviour.
    expect(REFRESH).toContain('reason: reload.reason');
  });

  test('a declined swap does not fail the repo work', () => {
    // The pull succeeded; only the reload declined. Reporting ok:false would
    // hide a good pull behind a safety mechanism doing its job.
    expect(REFRESH).toContain('ok: true');
  });
});

/**
 * The fault-injection switch that makes the decline path provable on a real box.
 *
 * It exists because nothing else can reach that branch in production: the API
 * validates agent configs against opencode's schema before they ever arrive at
 * a sandbox, so no supported input produces a config that fails to boot. The
 * branch is the whole safety mechanism, and "covered by unit tests only" is a
 * weak place to leave it.
 */
describe('verify_fail fault injection', () => {
  test('forces the verdict AFTER a real spawn, not instead of one', () => {
    // A shortcut that returned early would prove the plumbing and nothing else.
    // Spawning for real means the injected run exercises the same code as a
    // genuine failure: candidate started, candidate retired, incumbent alive.
    const body = reloadBody();
    const spawnAt = body.indexOf('spawnChild(binaryPath');
    const forceAt = body.indexOf('opts.forceFail');
    expect(spawnAt).toBeGreaterThan(-1);
    expect(forceAt).toBeGreaterThan(spawnAt);
  });

  test('still retires the candidate when injected', () => {
    const body = reloadBody();
    expect(body.indexOf('killProcessGroup(candidate')).toBeGreaterThan(
      body.indexOf('opts.forceFail'),
    );
  });

  test('the route only injects on an explicit opt-in', () => {
    // Default MUST be a normal reload. A flag that defaulted on would turn
    // every reload on the box into a no-op.
    expect(REFRESH).toContain("c.req.query('verify_fail') === '1'");
  });

  test('injection cannot reach the restart', () => {
    // Same guard as a real failure: decline returns before this.restart().
    const method = SRC.slice(SRC.indexOf('async reloadVerified('));
    const guardAt = method.indexOf('if (!proven.ok) return');
    expect(guardAt).toBeGreaterThan(-1);
    expect(guardAt).toBeLessThan(method.indexOf('this.restart()'));
  });
});
