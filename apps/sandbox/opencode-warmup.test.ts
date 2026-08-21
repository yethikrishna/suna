import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const SCRIPT = resolve(import.meta.dir, 'opencode-warmup.sh');

let fixtureRoot: string;
let fixtureBin: string;

function writeExecutable(name: string, source: string): void {
  const path = join(fixtureBin, name);
  writeFileSync(path, source, 'utf8');
  chmodSync(path, 0o755);
}

async function runWarmup(mode: string, env: Record<string, string> = {}) {
  const proc = Bun.spawn({
    cmd: ['bash', SCRIPT, mode],
    env: {
      ...process.env,
      HOME: join(fixtureRoot, 'home'),
      PATH: `${fixtureBin}:${process.env.PATH ?? ''}`,
      ...env,
    },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [code, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  return { code, stdout, stderr };
}

function processIsExecuting(pid: number): boolean {
  const result = Bun.spawnSync({
    cmd: ['ps', '-o', 'stat=', '-p', String(pid)],
    stdout: 'pipe',
    stderr: 'ignore',
  });
  if (result.exitCode !== 0) return false;
  const state = result.stdout.toString().trim();
  return state.length > 0 && !state.startsWith('Z');
}

describe('opencode image warm-up', () => {
  beforeEach(() => {
    fixtureRoot = mkdtempSync(join(tmpdir(), 'kortix-opencode-warmup-'));
    fixtureBin = join(fixtureRoot, 'bin');
    mkdirSync(fixtureBin, { recursive: true });
    writeExecutable(
      'opencode',
      `#!/usr/bin/env bash
if [ "\${FAKE_OPENCODE_CRASH:-0}" = "1" ]; then
  exit 7
fi
if [ "\${FAKE_OPENCODE_IGNORE_TERM:-0}" = "1" ]; then
  trap '' TERM INT
else
  trap 'exit 0' TERM INT
fi
if [ -n "\${FAKE_OPENCODE_PID_FILE:-}" ]; then
  printf '%s' "$$" >"$FAKE_OPENCODE_PID_FILE"
fi
if [ -n "\${FAKE_OPENCODE_HELPER_PID_FILE:-}" ]; then
  (
    trap '' TERM INT
    printf '%s' "$BASHPID" >"$FAKE_OPENCODE_HELPER_PID_FILE"
    while :; do /bin/sleep 0.05; done
  ) &
fi
if [ -n "\${FAKE_OPENCODE_READY_FILE:-}" ]; then
  : >"$FAKE_OPENCODE_READY_FILE"
fi
while :; do /bin/sleep 0.05; done
`,
    );
    writeExecutable(
      'setsid',
      `#!/usr/bin/env python3
import os
import sys
os.setsid()
os.execvp(sys.argv[1], sys.argv[1:])
`,
    );
    writeExecutable(
      'curl',
      `#!/usr/bin/env bash
if [ "\${FAKE_CURL_READY:-0}" = "1" ]; then
  if [ -n "\${FAKE_OPENCODE_READY_FILE:-}" ] && [ ! -f "$FAKE_OPENCODE_READY_FILE" ]; then
    printf '000'
    exit 1
  fi
  printf '%s' "\${FAKE_CURL_CODE:-200}"
  exit 0
fi
printf '000'
exit 1
`,
    );
    writeExecutable('sleep', '#!/usr/bin/env bash\nexit 0\n');
  });

  afterEach(() => {
    rmSync(fixtureRoot, { recursive: true, force: true });
  });

  test('returns success only after OpenCode responds', async () => {
    const result = await runWarmup('migration', { FAKE_CURL_READY: '1' });
    expect(result.code).toBe(0);
  });

  test('fails when OpenCode exits before readiness', async () => {
    const result = await runWarmup('migration', { FAKE_OPENCODE_CRASH: '1' });
    expect(result.code).not.toBe(0);
    expect(result.stderr).toContain('did not become ready');
  });

  test('force-kills the warm-up process group after the shutdown deadline', async () => {
    const pidFile = join(fixtureRoot, 'opencode.pid');
    const helperPidFile = join(fixtureRoot, 'opencode-helper.pid');
    const readyFile = join(fixtureRoot, 'opencode.ready');
    const result = await runWarmup('migration', {
      FAKE_CURL_READY: '1',
      FAKE_OPENCODE_IGNORE_TERM: '1',
      FAKE_OPENCODE_PID_FILE: pidFile,
      FAKE_OPENCODE_HELPER_PID_FILE: helperPidFile,
      FAKE_OPENCODE_READY_FILE: readyFile,
      OPENCODE_WARMUP_STOP_ATTEMPTS: '2',
      OPENCODE_WARMUP_STOP_POLL_SECONDS: '0.01',
    });

    expect(result.code).toBe(0);
    expect(result.stderr).toContain('forcing process group shutdown');
    const pid = Number(readFileSync(pidFile, 'utf8'));
    const helperPid = Number(readFileSync(helperPidFile, 'utf8'));
    expect(() => process.kill(pid, 0)).toThrow();
    expect(processIsExecuting(helperPid)).toBe(false);
  });

  test('rejects an unknown warm-up mode', async () => {
    const result = await runWarmup('invalid');
    expect(result.code).toBe(2);
    expect(result.stderr).toContain('usage:');
  });

  test('the standalone image links the native executable for the supervisor', () => {
    const dockerfile = readFileSync(resolve(import.meta.dir, 'Dockerfile'), 'utf8');

    expect(dockerfile).toContain('iputils-arping util-linux');
    expect(dockerfile).toContain(
      "opencode_package=\"$(pnpm list -g --parseable --depth 0 opencode-ai | sed -n '\\#/node_modules/opencode-ai$#p' | tail -n 1)\"",
    );
    expect(dockerfile).toContain('opencode_native="$opencode_package/bin/opencode.exe"');
    expect(dockerfile).toContain('test "$(wc -c < "$opencode_native")" -gt 50000000');
    expect(dockerfile).toContain('ln -sfn "$opencode_native" /opt/kortix/opencode.current');
    expect(dockerfile).toContain(
      'sudo ln -sfn /opt/kortix/opencode.current /usr/local/bin/opencode-kortix',
    );
  });
});
