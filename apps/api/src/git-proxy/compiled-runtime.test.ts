import { afterEach, describe, expect, test } from 'bun:test';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileOpenCodeRuntime } from './compiled-runtime';

const roots: string[] = [];
const INPUT = {
  projectId: 'project-1',
  ref: 'main',
  sourceSha: 'a'.repeat(40),
  agentConfig: JSON.stringify({ agent: { kortix: { prompt: 'Ship safely.' } } }),
};

async function materializeRuntime() {
  const root = await mkdtemp(join(tmpdir(), 'kortix-compiled-runtime-'));
  roots.push(root);
  const artifact = compileOpenCodeRuntime(INPUT);
  const runtimePath = join(root, 'server.mjs');
  await writeFile(runtimePath, artifact.source, { mode: 0o700 });
  return { artifact, root, runtimePath };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('compileOpenCodeRuntime', () => {
  test('produces a deterministic content-addressed OpenCode runtime', () => {
    const first = compileOpenCodeRuntime(INPUT);
    const second = compileOpenCodeRuntime(INPUT);

    expect(second).toEqual(first);
    expect(first.manifest).toEqual({
      format: 'kortix.compiled-runtime.v1',
      engine: 'opencode',
      project_id: 'project-1',
      ref: 'main',
      source_sha: 'a'.repeat(40),
      agent_config: INPUT.agentConfig,
      agent_config_etag: expect.stringMatching(/^[0-9a-f]{16}$/),
    });
    expect(first.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(first.size).toBe(Buffer.byteLength(first.source));
  });

  test('prints its compiled manifest without starting the agent', async () => {
    const { artifact, runtimePath } = await materializeRuntime();
    const child = Bun.spawn([process.execPath, runtimePath, '--manifest'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);

    expect(exitCode, stderr).toBe(0);
    expect(JSON.parse(stdout)).toEqual(artifact.manifest);
  });

  test('starts the baked agent with compiled config and runtime secrets', async () => {
    const { root, runtimePath } = await materializeRuntime();
    const capturePath = join(root, 'capture.json');
    const agentPath = join(root, 'agent.mjs');
    await writeFile(
      agentPath,
      `#!/usr/bin/env node
import { writeFileSync } from "node:fs";
writeFileSync(process.env.CAPTURE_PATH, JSON.stringify({
  projectId: process.env.KORTIX_PROJECT_ID,
  ref: process.env.KORTIX_DEFAULT_BRANCH,
  sourceSha: process.env.KORTIX_BASE_SHA,
  agentConfig: process.env.KORTIX_COMPILED_AGENT_CONFIG,
  token: process.env.KORTIX_TOKEN,
}));
`,
    );
    await chmod(agentPath, 0o700);
    const child = Bun.spawn([process.execPath, runtimePath], {
      env: {
        ...process.env,
        CAPTURE_PATH: capturePath,
        KORTIX_AGENT_BIN: agentPath,
        KORTIX_TOKEN: 'runtime-only-token',
      },
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const [exitCode, stderr] = await Promise.all([
      child.exited,
      new Response(child.stderr).text(),
    ]);

    expect(exitCode, stderr).toBe(0);
    expect(JSON.parse(await readFile(capturePath, 'utf8'))).toEqual({
      projectId: 'project-1',
      ref: 'main',
      sourceSha: 'a'.repeat(40),
      agentConfig: INPUT.agentConfig,
      token: 'runtime-only-token',
    });
    expect(artifactSourceHasSecret(await readFile(runtimePath, 'utf8'))).toBe(false);
  });

  test('rejects a runtime identity that differs from the compiled artifact', async () => {
    const { runtimePath } = await materializeRuntime();
    const child = Bun.spawn([process.execPath, runtimePath], {
      env: {
        ...process.env,
        KORTIX_PROJECT_ID: 'different-project',
        KORTIX_AGENT_BIN: '/bin/true',
      },
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const [exitCode, stderr] = await Promise.all([
      child.exited,
      new Response(child.stderr).text(),
    ]);

    expect(exitCode).toBe(78);
    expect(stderr).toContain('Compiled runtime identity mismatch for KORTIX_PROJECT_ID');
  });

  test('rejects malformed compiler input', () => {
    expect(() => compileOpenCodeRuntime({ ...INPUT, sourceSha: 'HEAD' })).toThrow(
      'sourceSha must be a lowercase 40-character Git SHA',
    );
    expect(() => compileOpenCodeRuntime({ ...INPUT, agentConfig: '{' })).toThrow();
  });
});

function artifactSourceHasSecret(source: string): boolean {
  return source.includes('runtime-only-token');
}
