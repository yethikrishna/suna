import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
trap 'exit 0' TERM INT
while :; do /bin/sleep 0.05; done
`,
    );
    writeExecutable(
      'curl',
      `#!/usr/bin/env bash
if [ "\${FAKE_CURL_READY:-0}" = "1" ]; then
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

  test('rejects an unknown warm-up mode', async () => {
    const result = await runWarmup('invalid');
    expect(result.code).toBe(2);
    expect(result.stderr).toContain('usage:');
  });
});
