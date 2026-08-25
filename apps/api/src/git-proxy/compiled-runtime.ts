import { createHash } from 'node:crypto';

export const COMPILED_RUNTIME_FORMAT = 'kortix.compiled-runtime.v1' as const;
export const COMPILED_RUNTIME_CONTENT_TYPE =
  'application/vnd.kortix.compiled-runtime.v1+javascript';

export interface CompiledRuntimeManifest {
  format: typeof COMPILED_RUNTIME_FORMAT;
  engine: 'opencode';
  project_id: string;
  ref: string;
  source_sha: string;
  agent_config: string | null;
  agent_config_etag: string | null;
}

export interface CompiledRuntimeArtifact {
  source: string;
  sha256: string;
  size: number;
  manifest: CompiledRuntimeManifest;
}

export interface CompileOpenCodeRuntimeInput {
  projectId: string;
  ref: string;
  sourceSha: string;
  agentConfig?: string | null;
}

function validateInput(input: CompileOpenCodeRuntimeInput): void {
  if (!input.projectId.trim()) throw new Error('projectId is required');
  if (!input.ref.trim()) throw new Error('ref is required');
  if (!/^[0-9a-f]{40}$/.test(input.sourceSha)) {
    throw new Error('sourceSha must be a lowercase 40-character Git SHA');
  }
  if (input.agentConfig) JSON.parse(input.agentConfig);
}

function etag(value: string | null): string | null {
  if (!value) return null;
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function runtimeSource(manifest: CompiledRuntimeManifest): string {
  const encodedManifest = Buffer.from(JSON.stringify(manifest)).toString('base64url');
  return `#!/usr/bin/env node
// kortix-manifest-base64url:${encodedManifest}
import { spawn } from "node:child_process";

export const manifest = Object.freeze(
  JSON.parse(Buffer.from("${encodedManifest}", "base64url").toString("utf8")),
);

if (process.argv.includes("--manifest")) {
  process.stdout.write(JSON.stringify(manifest) + "\\n");
  process.exit(0);
}

const compiledEnv = {
  KORTIX_COMPILED_RUNTIME_FORMAT: manifest.format,
  KORTIX_COMPILED_RUNTIME_SOURCE_SHA: manifest.source_sha,
  KORTIX_PROJECT_ID: manifest.project_id,
  KORTIX_DEFAULT_BRANCH: manifest.ref,
  KORTIX_BASE_REF: manifest.ref,
  KORTIX_BASE_SHA: manifest.source_sha,
  ...(manifest.agent_config
    ? {
        KORTIX_COMPILED_AGENT_CONFIG: manifest.agent_config,
        KORTIX_COMPILED_AGENT_CONFIG_ETAG: manifest.agent_config_etag,
      }
    : {}),
};

for (const [name, value] of Object.entries(compiledEnv)) {
  const runtimeValue = process.env[name];
  if (runtimeValue !== undefined && runtimeValue !== value) {
    process.stderr.write(
      "Compiled runtime identity mismatch for " + name + "\\n",
    );
    process.exit(78);
  }
}

const executable = process.env.KORTIX_AGENT_BIN || "/usr/local/bin/kortix-agent";
const child = spawn(executable, [], {
  env: { ...process.env, ...compiledEnv },
  stdio: "inherit",
});

const forward = (signal) => {
  if (!child.killed) child.kill(signal);
};

process.on("SIGINT", () => forward("SIGINT"));
process.on("SIGTERM", () => forward("SIGTERM"));
child.once("error", (error) => {
  process.stderr.write("Failed to start Kortix agent: " + error.message + "\\n");
  process.exit(127);
});
child.once("exit", (code, signal) => {
  if (signal) {
    process.stderr.write("Kortix agent exited from signal " + signal + "\\n");
    process.exit(1);
  }
  process.exit(code ?? 1);
});
`;
}

export function compileOpenCodeRuntime(
  input: CompileOpenCodeRuntimeInput,
): CompiledRuntimeArtifact {
  validateInput(input);
  const agentConfig = input.agentConfig ?? null;
  const manifest: CompiledRuntimeManifest = {
    format: COMPILED_RUNTIME_FORMAT,
    engine: 'opencode',
    project_id: input.projectId,
    ref: input.ref,
    source_sha: input.sourceSha,
    agent_config: agentConfig,
    agent_config_etag: etag(agentConfig),
  };
  const source = runtimeSource(manifest);
  return {
    source,
    sha256: createHash('sha256').update(source).digest('hex'),
    size: Buffer.byteLength(source),
    manifest,
  };
}
