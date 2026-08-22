import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface PsqlResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

/** Avoid Bun 1.3.14's piped spawnSync stdout corruption after async children. */
export function runPsql(url: string, sql: string): PsqlResult {
  const output = join(tmpdir(), `kortix-psql-${process.pid}-${crypto.randomUUID()}`);
  const result = Bun.spawnSync(
    ['psql', url, '-v', 'ON_ERROR_STOP=1', '-tAc', sql, '-o', output],
    { stdout: 'ignore', stderr: 'pipe' },
  );
  let stdout = '';
  try {
    stdout = readFileSync(output, 'utf8').trim();
  } finally {
    rmSync(output, { force: true });
  }
  return { ok: result.exitCode === 0, stdout, stderr: result.stderr.toString() };
}
