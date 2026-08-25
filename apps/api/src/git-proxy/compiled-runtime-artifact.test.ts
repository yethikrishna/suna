import { afterEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { GitBackedProject } from "../projects/git/types";
import {
  __clearCompiledRuntimeBuildsForTests,
  buildCompiledRuntimeArtifact,
} from "./compiled-runtime-artifact";

const roots: string[] = [];
const originalCacheRoot = process.env.KORTIX_COMPILED_BOOT_CACHE_DIR;
const originalMirrorRoot = process.env.KORTIX_GIT_CACHE_DIR;

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, {
    cwd,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "Ivan Bagarić",
      GIT_AUTHOR_EMAIL: "ino.bagaric.1@gmail.com",
      GIT_COMMITTER_NAME: "Ivan Bagarić",
      GIT_COMMITTER_EMAIL: "ino.bagaric.1@gmail.com",
    },
    encoding: "utf8",
  }).trim();
}

function makeProject(): {
  project: GitBackedProject;
  sha: string;
  source: string;
} {
  const root = mkdtempSync(join(tmpdir(), "kortix-runtime-source-"));
  roots.push(root);
  const source = join(root, "source");
  mkdirSync(join(source, ".kortix", "opencode", "agents"), { recursive: true });
  git(["init", "-b", "main"], source);
  writeFileSync(
    join(source, "kortix.yaml"),
    "kortix_version: 2\ndefault_agent: kortix\nagents:\n  kortix: {}\n",
  );
  writeFileSync(
    join(source, ".kortix", "opencode", "agents", "kortix.md"),
    "---\nmode: primary\n---\nAnswer from the compiled runtime.\n",
  );
  git(["add", "-A"], source);
  git(["commit", "-m", "runtime source"], source);
  return {
    project: {
      projectId: crypto.randomUUID(),
      repoUrl: `file://${source}`,
      defaultBranch: "main",
      manifestPath: "kortix.yaml",
      gitAuthToken: "test-token",
    },
    sha: git(["rev-parse", "HEAD"], source),
    source,
  };
}

afterEach(() => {
  __clearCompiledRuntimeBuildsForTests();
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
  if (originalCacheRoot === undefined)
    delete process.env.KORTIX_COMPILED_BOOT_CACHE_DIR;
  else process.env.KORTIX_COMPILED_BOOT_CACHE_DIR = originalCacheRoot;
  if (originalMirrorRoot === undefined) delete process.env.KORTIX_GIT_CACHE_DIR;
  else process.env.KORTIX_GIT_CACHE_DIR = originalMirrorRoot;
});

describe("buildCompiledRuntimeArtifact", () => {
  test("compiles exact Git state into an executable OpenCode server artifact", async () => {
    const { project, sha } = makeProject();
    const cache = mkdtempSync(join(tmpdir(), "kortix-runtime-cache-"));
    const mirrors = mkdtempSync(join(tmpdir(), "kortix-runtime-mirrors-"));
    roots.push(cache, mirrors);
    process.env.KORTIX_COMPILED_BOOT_CACHE_DIR = cache;
    process.env.KORTIX_GIT_CACHE_DIR = mirrors;

    const artifact = await buildCompiledRuntimeArtifact(project, "main", sha);
    const manifest = JSON.parse(
      execFileSync(process.execPath, [artifact.path, "--manifest"], {
        encoding: "utf8",
      }),
    );

    expect(artifact.cacheHit).toBe(false);
    expect(artifact.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(artifact.size).toBeGreaterThan(0);
    expect(manifest).toEqual(artifact.manifest);
    expect(JSON.parse(manifest.agent_config)).toEqual({
      agent: {
        kortix: {
          mode: "primary",
          prompt: "Answer from the compiled runtime.\n",
        },
      },
    });
  });

  test("reuses a verified content-addressed artifact", async () => {
    const { project, sha } = makeProject();
    const cache = mkdtempSync(join(tmpdir(), "kortix-runtime-cache-"));
    const mirrors = mkdtempSync(join(tmpdir(), "kortix-runtime-mirrors-"));
    roots.push(cache, mirrors);
    process.env.KORTIX_COMPILED_BOOT_CACHE_DIR = cache;
    process.env.KORTIX_GIT_CACHE_DIR = mirrors;

    const first = await buildCompiledRuntimeArtifact(project, "main", sha);
    const second = await buildCompiledRuntimeArtifact(project, "main", sha);

    expect(first.cacheHit).toBe(false);
    expect(second.cacheHit).toBe(true);
    expect(second.path).toBe(first.path);
    expect(readFileSync(second.path, "utf8")).toBe(
      readFileSync(first.path, "utf8"),
    );
  });

  test("rebuilds a cache entry whose body has no embedded manifest", async () => {
    const { project, sha } = makeProject();
    const cache = mkdtempSync(join(tmpdir(), "kortix-runtime-cache-"));
    const mirrors = mkdtempSync(join(tmpdir(), "kortix-runtime-mirrors-"));
    roots.push(cache, mirrors);
    process.env.KORTIX_COMPILED_BOOT_CACHE_DIR = cache;
    process.env.KORTIX_GIT_CACHE_DIR = mirrors;

    const first = await buildCompiledRuntimeArtifact(project, "main", sha);
    const invalidSource = "#!/usr/bin/env node\nprocess.exit(0);\n";
    writeFileSync(first.path, invalidSource);
    const metadataPath = join(
      cache,
      readdirSync(cache).find((name) => name.endsWith(".runtime.json"))!,
    );
    const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
    metadata.sha256 = createHash("sha256").update(invalidSource).digest("hex");
    metadata.size = Buffer.byteLength(invalidSource);
    writeFileSync(metadataPath, `${JSON.stringify(metadata)}\n`);

    const rebuilt = await buildCompiledRuntimeArtifact(project, "main", sha);
    const rebuiltSource = readFileSync(rebuilt.path, "utf8");

    expect(rebuilt.cacheHit).toBe(false);
    expect(rebuiltSource).toContain("// kortix-manifest-base64url:");
  });

  test("rejects a named ref that moved from the expected commit", async () => {
    const { project } = makeProject();
    const cache = mkdtempSync(join(tmpdir(), "kortix-runtime-cache-"));
    const mirrors = mkdtempSync(join(tmpdir(), "kortix-runtime-mirrors-"));
    roots.push(cache, mirrors);
    process.env.KORTIX_COMPILED_BOOT_CACHE_DIR = cache;
    process.env.KORTIX_GIT_CACHE_DIR = mirrors;

    await expect(
      buildCompiledRuntimeArtifact(project, "main", "a".repeat(40)),
    ).rejects.toThrow(/source moved/);
  });
});
