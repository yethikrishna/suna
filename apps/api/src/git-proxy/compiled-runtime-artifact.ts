import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { resolveCompiledAgentConfigForSession } from "../projects/lib/compile-agent-config";
import { validateRef, validateSha } from "../projects/git-ref";
import { refreshMirror, runGit } from "../projects/git/mirror";
import type { GitBackedProject } from "../projects/git/types";
import {
  COMPILED_RUNTIME_FORMAT,
  compileOpenCodeRuntime,
  type CompiledRuntimeManifest,
} from "./compiled-runtime";

export interface StoredCompiledRuntimeArtifact {
  path: string;
  sha256: string;
  size: number;
  sourceSha: string;
  cacheHit: boolean;
  manifest: CompiledRuntimeManifest;
}

interface CachedRuntimeMetadata {
  format: typeof COMPILED_RUNTIME_FORMAT;
  projectId: string;
  ref: string;
  sourceSha: string;
  sha256: string;
  size: number;
  manifest: CompiledRuntimeManifest;
}

const builds = new Map<string, Promise<StoredCompiledRuntimeArtifact>>();

export class CompiledRuntimeSourceMovedError extends Error {
  constructor(expectedSha: string, actualSha: string) {
    super(
      `compiled runtime source moved: expected ${expectedSha}, got ${actualSha}`,
    );
    this.name = "CompiledRuntimeSourceMovedError";
  }
}

function cacheRoot(): string {
  return (
    process.env.KORTIX_COMPILED_BOOT_CACHE_DIR || "/tmp/kortix/compiled-boot"
  );
}

function artifactKey(
  projectId: string,
  ref: string,
  sourceSha: string,
): string {
  return createHash("sha256")
    .update(`${COMPILED_RUNTIME_FORMAT}\0${projectId}\0${ref}\0${sourceSha}`)
    .digest("hex");
}

async function assertExactSource(
  project: GitBackedProject,
  ref: string,
  sourceSha: string,
): Promise<void> {
  let mirror = await refreshMirror(project);
  let actualSha = (
    await runGit(["rev-parse", "--verify", `${ref}^{commit}`], mirror, false)
  ).stdout.trim();
  if (actualSha !== sourceSha) {
    mirror = await refreshMirror(project, true);
    actualSha = (
      await runGit(["rev-parse", "--verify", `${ref}^{commit}`], mirror, false)
    ).stdout.trim();
  }
  if (actualSha !== sourceSha)
    throw new CompiledRuntimeSourceMovedError(sourceSha, actualSha);
}

async function readCachedArtifact(
  runtimePath: string,
  metadataPath: string,
  projectId: string,
  ref: string,
  sourceSha: string,
): Promise<StoredCompiledRuntimeArtifact | null> {
  try {
    const metadata = JSON.parse(
      await readFile(metadataPath, "utf8"),
    ) as CachedRuntimeMetadata;
    const source = await readFile(runtimePath);
    const runtime = await stat(runtimePath);
    const sha256 = createHash("sha256").update(source).digest("hex");
    if (
      metadata.format !== COMPILED_RUNTIME_FORMAT ||
      metadata.projectId !== projectId ||
      metadata.ref !== ref ||
      metadata.sourceSha !== sourceSha ||
      metadata.size !== runtime.size ||
      metadata.sha256 !== sha256 ||
      runtime.size <= 0
    ) {
      return null;
    }
    return {
      path: runtimePath,
      sha256,
      size: runtime.size,
      sourceSha,
      cacheHit: true,
      manifest: metadata.manifest,
    };
  } catch {
    return null;
  }
}

async function compileArtifact(
  project: GitBackedProject,
  ref: string,
  sourceSha: string,
  runtimePath: string,
  metadataPath: string,
): Promise<StoredCompiledRuntimeArtifact> {
  await assertExactSource(project, ref, sourceSha);
  const agentConfig = await resolveCompiledAgentConfigForSession(
    project,
    sourceSha,
  );
  const artifact = compileOpenCodeRuntime({
    projectId: project.projectId,
    ref,
    sourceSha,
    agentConfig,
  });
  const stagedPath = `${runtimePath}.${crypto.randomUUID()}.tmp`;
  try {
    await writeFile(stagedPath, artifact.source, { mode: 0o700 });
    await rename(stagedPath, runtimePath);
    const metadata: CachedRuntimeMetadata = {
      format: COMPILED_RUNTIME_FORMAT,
      projectId: project.projectId,
      ref,
      sourceSha,
      sha256: artifact.sha256,
      size: artifact.size,
      manifest: artifact.manifest,
    };
    await writeFile(metadataPath, `${JSON.stringify(metadata)}\n`, {
      mode: 0o600,
    });
    return {
      path: runtimePath,
      sha256: artifact.sha256,
      size: artifact.size,
      sourceSha,
      cacheHit: false,
      manifest: artifact.manifest,
    };
  } finally {
    await rm(stagedPath, { force: true });
  }
}

export async function buildCompiledRuntimeArtifact(
  project: GitBackedProject,
  refInput: string,
  sourceShaInput: string,
): Promise<StoredCompiledRuntimeArtifact> {
  const ref = validateRef(refInput);
  const sourceSha = validateSha(sourceShaInput);
  const key = artifactKey(project.projectId, ref, sourceSha);
  await mkdir(cacheRoot(), { recursive: true });
  const runtimePath = join(cacheRoot(), `${key}.server.mjs`);
  const metadataPath = join(cacheRoot(), `${key}.runtime.json`);
  const cached = await readCachedArtifact(
    runtimePath,
    metadataPath,
    project.projectId,
    ref,
    sourceSha,
  );
  if (cached) return cached;

  const active = builds.get(key);
  if (active) return active;
  const build = compileArtifact(
    project,
    ref,
    sourceSha,
    runtimePath,
    metadataPath,
  ).finally(() => {
    builds.delete(key);
  });
  builds.set(key, build);
  return build;
}

export function __clearCompiledRuntimeBuildsForTests(): void {
  builds.clear();
}
