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

/** `reloadVerified`'s body, comments stripped. */
function reloadBody(): string {
  const start = SRC.indexOf('async function reloadVerified(');
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

  test('verifies the candidate BEFORE retiring the old process', () => {
    // The entire fix in one assertion. If the kill moves above the probe this
    // is the kill-then-hope restart again, and nothing else here would notice.
    const probeAt = body.indexOf('probeUntilReady');
    const killAt = body.indexOf('killProcessGroup(previous');
    expect(probeAt).toBeGreaterThan(-1);
    expect(killAt).toBeGreaterThan(-1);
    expect(probeAt).toBeLessThan(killAt);
  });

  test('adopts the candidate before retiring the old one', () => {
    // Retire first and any request landing in the gap has no opencode at all.
    expect(body.indexOf('child = candidate')).toBeLessThan(
      body.indexOf('killProcessGroup(previous'),
    );
  });

  test('strips the old exit handler before killing it', () => {
    // The old child's handler nulls `child` and schedules a respawn. Left
    // attached, killing it would erase the candidate we just adopted and
    // respawn against what is now the standby port.
    const detachAt = body.indexOf("removeAllListeners('exit')");
    expect(detachAt).toBeGreaterThan(-1);
    expect(detachAt).toBeLessThan(body.indexOf('killProcessGroup(previous'));
  });

  test('supervises the promoted candidate', () => {
    // It was spawned unsupervised. Promoted without this it would die silently
    // and never come back.
    expect(body).toContain('superviseChild(candidate)');
  });
});

describe('when the candidate never comes up', () => {
  const body = reloadBody();

  test('keeps the old process and says why', () => {
    expect(body).toContain("outcome: 'kept-old'");
    expect(body).toMatch(/reason:/);
  });

  test('kills the candidate, never the incumbent, on that branch', () => {
    const failBranch = body.slice(body.indexOf('if (!ready)'), body.indexOf('if (previous) previous'));
    expect(failBranch).toContain('killProcessGroup(candidate');
    expect(failBranch).not.toContain('killProcessGroup(previous');
  });

  test('does not swap the ports on failure', () => {
    const failBranch = body.slice(body.indexOf('if (!ready)'), body.indexOf('if (previous) previous'));
    expect(failBranch).not.toContain('currentCfg.opencodeInternalPort =');
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

  test('a swap trades the two, so the live port always has a standby', () => {
    const body = reloadBody();
    expect(body).toContain('currentCfg.opencodeInternalPort = candidatePort');
    expect(body).toContain('currentCfg.opencodeStandbyPort = livePort');
  });
});

describe('callers get the outcome', () => {
  test('reloadConfig no longer calls the kill-first restart', () => {
    const reload = SRC.split('async reloadConfig(')[1]?.split('\n    },')[0] ?? '';
    const code = reload
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n');
    expect(code).toContain('reloadVerified()');
    expect(code).not.toContain('this.restart()');
  });

  test('reloadConfig reports kept-old rather than claiming success', () => {
    const reload = SRC.split('async reloadConfig(')[1]?.split('\n    },')[0] ?? '';
    expect(reload).toContain("return 'kept-old'");
  });

  test('the refresh route returns the outcome so CLI and web can show it', () => {
    expect(REFRESH).toContain('reloadVerified()');
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
