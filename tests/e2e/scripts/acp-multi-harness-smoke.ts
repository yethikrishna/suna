#!/usr/bin/env bun

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createAcpClient } from "../../../packages/sdk/src/core/acp/client";
import {
  type AcpSessionController,
  createAcpSessionController,
} from "../../../packages/sdk/src/core/acp/session-controller";
import { buildProjectAcpEndpoint } from "../../../packages/sdk/src/core/session/runtime-transport";
import { apiResult, createApiJsonClient } from "../helpers/http";

type Harness = "claude" | "codex" | "opencode" | "pi";
type SandboxProvider = "daytona" | "platinum" | "e2b" | "local-docker";

type Project = {
  project_id: string;
  account_id: string;
  git_origin_url: string;
  metadata: {
    experimental?: Record<string, boolean>;
  };
  experimental: Record<string, boolean>;
  experimental_features: Array<{ key: string; name: string; enabled: boolean }>;
};

type ProjectDetail = {
  config: {
    default_agent: string | null;
    open_code_default_agent?: string | null;
    agents: Array<{
      name: string;
      runtime?: string | null;
      harness?: Harness | null;
      native_agent?: string | null;
    }>;
  };
};

type ProjectSession = {
  session_id: string;
  agent_name: string | null;
  sandbox_provider?: SandboxProvider;
  runtime_transport?: "acp" | "rest";
  runtime_harness?: Harness;
  native_agent?: string | null;
  acp_server_id?: string | null;
  acp_session_id?: string | null;
};

type SessionStart = ProjectSession & {
  stage: "provisioning" | "starting" | "ready" | "failed" | "stopped";
  retriable: boolean;
  error?: string | null;
  sandbox: {
    status: string;
    external_id: string;
    sandbox_id: string;
  } | null;
};

const repoRoot = resolve(import.meta.dir, "../../..");
const apiBase = process.env.E2E_API_URL || "http://localhost:8008/v1";
const supabaseUrl = process.env.E2E_SUPABASE_URL || "http://127.0.0.1:54321";
const databaseUrl =
  process.env.E2E_DATABASE_URL || process.env.DATABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const anonKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";
const password = "AcpMultiHarness123!";
const keepFixture = process.env.E2E_KEEP_ACP_MULTI_HARNESS_FIXTURE === "1";
const reuseProjectId =
  process.env.E2E_ACP_MULTI_HARNESS_REUSE_PROJECT_ID?.trim() || "";
const reuseUserEmail =
  process.env.E2E_ACP_MULTI_HARNESS_REUSE_EMAIL?.trim() || "";
const sandboxProvider =
  (process.env.E2E_ACP_MULTI_HARNESS_PROVIDER?.trim() as
    SandboxProvider | undefined) || undefined;
const runtimeModel = process.env.E2E_ACP_MULTI_HARNESS_MODEL?.trim() || "";
const directOpenAiKey =
  process.env.E2E_ACP_MULTI_HARNESS_OPENAI_API_KEY?.trim() || "";
const manifest = readFileSync(
  resolve(repoRoot, "packages/starter/templates/acp-multi-harness/kortix.yaml"),
  "utf8",
);
const api = createApiJsonClient(apiBase);
const supportedHarnesses: Harness[] = ["opencode", "claude", "codex", "pi"];
const requestedHarnesses =
  process.env.E2E_ACP_MULTI_HARNESS_HARNESSES?.split(",")
    .map((value) => value.trim())
    .filter(Boolean) ?? [];
const invalidHarnesses = requestedHarnesses.filter(
  (value) => !supportedHarnesses.includes(value as Harness),
);
assert(
  invalidHarnesses.length === 0,
  `Unsupported harnesses: ${invalidHarnesses.join(", ")}`,
);
const harnesses: Harness[] =
  requestedHarnesses.length > 0
    ? requestedHarnesses.map((value) => value as Harness)
    : supportedHarnesses;

let userId = "";
let userEmail = "";
let accessToken = "";
let projectId = "";
let accountId = "";
const sessionIds: string[] = [];
const controllers = new Set<AcpSessionController>();

function log(label: string, detail: string): void {
  console.log(`[acp-multi-harness] ${label}: ${detail}`);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function createUserAndSignIn(email: string): Promise<string> {
  assert(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY is required");
  assert(anonKey, "SUPABASE_ANON_KEY is required");
  const created = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
    }),
  });
  const createdText = await created.text();
  assert(
    created.status === 200,
    `Supabase user create returned ${created.status}: ${createdText}`,
  );
  const createdBody = JSON.parse(createdText) as {
    id?: string;
    user?: { id?: string };
  };
  userId = createdBody.user?.id ?? createdBody.id ?? "";
  assert(userId, "Supabase user create returned no user id");

  return signIn(email);
}

async function signIn(email: string): Promise<string> {
  assert(anonKey, "SUPABASE_ANON_KEY is required");
  const signedIn = await fetch(
    `${supabaseUrl}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    },
  );
  const signedInText = await signedIn.text();
  assert(
    signedIn.status === 200,
    `Supabase sign-in returned ${signedIn.status}: ${signedInText}`,
  );
  const session = JSON.parse(signedInText) as { access_token?: string };
  assert(session.access_token, "Supabase sign-in returned no access_token");
  return session.access_token;
}

async function waitFor<T>(
  read: () => Promise<T>,
  accept: (value: T) => boolean,
  label: string,
  timeoutMs = 120_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let value = await read();
  while (!accept(value) && Date.now() < deadline) {
    await Bun.sleep(1_000);
    value = await read();
  }
  if (!accept(value)) {
    throw new Error(
      `${label} timed out: ${JSON.stringify(value).slice(0, 1_000)}`,
    );
  }
  return value;
}

function seedCredits(accountId: string): void {
  if (!databaseUrl) {
    log(
      "credits",
      "E2E_DATABASE_URL is unset; using the account state from the API",
    );
    return;
  }
  assert(
    /^[0-9a-f-]{36}$/i.test(accountId),
    `invalid account id for credit seed: ${accountId}`,
  );
  const sql = `INSERT INTO kortix.credit_accounts (account_id, balance, tier)
    VALUES ('${accountId}', 1000, 'tier_2_20')
    ON CONFLICT (account_id) DO UPDATE SET balance = 1000, tier = 'tier_2_20';`;
  const result = Bun.spawnSync(
    ["psql", databaseUrl, "-v", "ON_ERROR_STOP=1", "-c", sql],
    {
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  assert(
    result.exitCode === 0,
    `credit seed failed: ${result.stderr.toString().trim()}`,
  );
}

function hardDeleteFixtureRows(projectId: string, accountId: string): void {
  assert(databaseUrl, "DATABASE_URL is required for complete fixture cleanup");
  assert(
    /^[0-9a-f-]{36}$/i.test(projectId),
    `invalid cleanup project id: ${projectId}`,
  );
  assert(
    /^[0-9a-f-]{36}$/i.test(accountId),
    `invalid cleanup account id: ${accountId}`,
  );
  const sql = `BEGIN;
    DELETE FROM kortix.projects WHERE project_id = '${projectId}';
    DELETE FROM kortix.accounts WHERE account_id = '${accountId}';
    COMMIT;`;
  const result = Bun.spawnSync(
    ["psql", databaseUrl, "-v", "ON_ERROR_STOP=1", "-c", sql],
    {
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  assert(
    result.exitCode === 0,
    `fixture row cleanup failed: ${result.stderr.toString().trim()}`,
  );
}

function authorizedFetch(token: string): typeof fetch {
  return (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  }) as typeof fetch;
}

function assistantProjectionText(controller: AcpSessionController): string {
  return controller
    .getSnapshot()
    .projection.messages.filter((message) => message.info.role === "assistant")
    .flatMap((message) =>
      message.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text),
    )
    .join("\n");
}

function controllerFor(
  token: string,
  sessionId: string,
  start: SessionStart,
): AcpSessionController {
  assert(start.sandbox?.external_id, "session has no sandbox external_id");
  assert(start.acp_server_id, "session has no acp_server_id");
  assert(start.acp_session_id, "session has no acp_session_id");
  assert(start.runtime_harness, "session has no runtime_harness");
  const client = createAcpClient({
    endpoint: buildProjectAcpEndpoint(apiBase, projectId, sessionId),
    fetch: authorizedFetch(token),
    requestTimeoutMs: 180_000,
  });
  const controller = createAcpSessionController({
    sessionId,
    acpServerId: start.acp_server_id,
    acpSessionId: start.acp_session_id,
    runtimeHarness: start.runtime_harness,
    nativeAgent: start.native_agent,
    durableTranscript: true,
    client,
  });
  controllers.add(controller);
  return controller;
}

async function readSession(
  token: string,
  sessionId: string,
): Promise<ProjectSession> {
  return api<ProjectSession>(
    token,
    "GET",
    `/projects/${projectId}/sessions/${sessionId}`,
  );
}

async function waitForReady(
  token: string,
  sessionId: string,
  harness: Harness,
): Promise<SessionStart> {
  return waitFor(
    async () => {
      const result = await api<SessionStart>(
        token,
        "POST",
        `/projects/${projectId}/sessions/${sessionId}/start?wait_ms=8000`,
        {},
      );
      if (result.stage === "failed") {
        throw new Error(
          `${harness} runtime failed: ${result.error || "unknown error"}`,
        );
      }
      return result;
    },
    (value) =>
      value.stage === "ready" &&
      value.sandbox?.status === "active" &&
      Boolean(value.sandbox.external_id) &&
      value.runtime_transport === "acp" &&
      value.runtime_harness === harness &&
      value.acp_server_id === sessionId &&
      Boolean(value.acp_session_id),
    `${harness} runtime readiness`,
    12 * 60_000,
  );
}

async function waitForMarker(
  controller: AcpSessionController,
  marker: string,
  label: string,
): Promise<void> {
  await waitFor(
    async () => assistantProjectionText(controller),
    (text) => text.includes(marker),
    label,
    5 * 60_000,
  );
}

async function verifyHarness(token: string, harness: Harness): Promise<void> {
  const expectedNativeAgent = harness === "opencode" ? "kortix" : null;
  const firstMarker = `${harness.toUpperCase()}_FIRST_${Date.now()}`;
  const secondMarker = `${harness.toUpperCase()}_FOLLOWUP_${Date.now()}`;
  const restartMarker = `${harness.toUpperCase()}_RESTART_${Date.now()}`;
  const created = await api<ProjectSession>(
    token,
    "POST",
    `/projects/${projectId}/sessions`,
    {
      name: `${harness} ACP smoke`,
      agent_name: harness,
      initial_prompt: `Reply with exactly ${firstMarker}`,
      ...(sandboxProvider ? { provider: sandboxProvider } : {}),
      ...(runtimeModel ? { opencode_model: runtimeModel } : {}),
    },
    201,
  );
  const sessionId = created.session_id;
  sessionIds.push(sessionId);
  assert(
    !sandboxProvider || created.sandbox_provider === sandboxProvider,
    `${harness}: sandbox_provider changed`,
  );

  const started = await waitForReady(token, sessionId, harness);
  assert(started.agent_name === harness, `${harness}: agent_name changed`);
  assert(
    started.native_agent === expectedNativeAgent,
    `${harness}: native_agent was not the immutable manifest value`,
  );
  const identity = {
    runtime_transport: started.runtime_transport,
    runtime_harness: started.runtime_harness,
    native_agent: started.native_agent,
    acp_server_id: started.acp_server_id,
    acp_session_id: started.acp_session_id,
  };

  const controller = controllerFor(token, sessionId, started);
  await controller.connect();
  await waitForMarker(
    controller,
    firstMarker,
    `${harness} initial headless response`,
  );
  await controller.send([
    { type: "text", text: `Reply with exactly ${secondMarker}` },
  ]);
  await waitForMarker(
    controller,
    secondMarker,
    `${harness} follow-up response`,
  );
  controller.close();
  controllers.delete(controller);

  const reloaded = controllerFor(token, sessionId, started);
  await reloaded.connect();
  const transcript = assistantProjectionText(reloaded);
  assert(
    transcript.includes(firstMarker) && transcript.includes(secondMarker),
    `${harness}: transcript reload did not contain both turns`,
  );
  reloaded.close();
  controllers.delete(reloaded);

  const immutableAttempt = await apiResult<{ error?: string }>(
    apiBase,
    token,
    "PATCH",
    `/projects/${projectId}/sessions/${sessionId}`,
    { agent_name: harness === "codex" ? "pi" : "codex" },
  );
  assert(
    immutableAttempt.status === 400,
    `${harness}: agent_name mutation returned ${immutableAttempt.status}`,
  );

  await api(
    token,
    "POST",
    `/projects/${projectId}/sessions/${sessionId}/restart`,
    {},
    202,
  );
  const restarted = await waitForReady(token, sessionId, harness);
  assert(
    restarted.runtime_transport === identity.runtime_transport &&
      restarted.runtime_harness === identity.runtime_harness &&
      restarted.native_agent === identity.native_agent &&
      restarted.acp_server_id === identity.acp_server_id &&
      restarted.acp_session_id === identity.acp_session_id,
    `${harness}: runtime identity changed after restart`,
  );

  const afterRestart = controllerFor(token, sessionId, restarted);
  await afterRestart.connect();
  await afterRestart.send([
    { type: "text", text: `Reply with exactly ${restartMarker}` },
  ]);
  await waitForMarker(
    afterRestart,
    restartMarker,
    `${harness} response after restart`,
  );
  const finalTranscript = assistantProjectionText(afterRestart);
  assert(
    finalTranscript.includes(firstMarker) &&
      finalTranscript.includes(secondMarker) &&
      finalTranscript.includes(restartMarker),
    `${harness}: restart transcript lost a turn`,
  );
  afterRestart.close();
  controllers.delete(afterRestart);

  const finalSession = await readSession(token, sessionId);
  assert(
    finalSession.runtime_harness === harness &&
      finalSession.acp_server_id === sessionId &&
      finalSession.acp_session_id === identity.acp_session_id,
    `${harness}: persisted session identity changed`,
  );
  log(
    harness,
    `PASS project_session_id=${sessionId} acp_server_id=${identity.acp_server_id} acp_session_id=${identity.acp_session_id}`,
  );
}

async function main(): Promise<void> {
  log(
    "target",
    `${apiBase} with ${harnesses.join(", ")} on ${sandboxProvider ?? "the project default provider"} using ${runtimeModel || "each harness default model"}`,
  );
  assert(
    (reuseProjectId && reuseUserEmail) || (!reuseProjectId && !reuseUserEmail),
    "E2E_ACP_MULTI_HARNESS_REUSE_PROJECT_ID and E2E_ACP_MULTI_HARNESS_REUSE_EMAIL must be set together",
  );
  const email =
    reuseUserEmail ||
    `acp-multi-harness-${Date.now()}-${randomUUID().slice(0, 8)}@example.test`;
  userEmail = email;
  accessToken = reuseProjectId
    ? await signIn(email)
    : await createUserAndSignIn(email);
  const token = accessToken;

  if (reuseProjectId) {
    projectId = reuseProjectId;
    log("fixture", `reusing project=${projectId}`);
  } else {
    const accounts = await api<
      Array<{ account_id: string; personal_account?: boolean }>
    >(token, "GET", "/accounts");
    const account =
      accounts.find((item) => item.personal_account) ?? accounts[0];
    assert(
      account?.account_id,
      "No personal account exists for the smoke user",
    );
    accountId = account.account_id;
    seedCredits(accountId);

    const project = await api<Project>(
      token,
      "POST",
      "/projects/provision",
      {
        account_id: accountId,
        name: `ACP multi-harness ${Date.now()}`,
        seed_starter: true,
        starter_template: "acp-multi-harness",
      },
      201,
    );
    projectId = project.project_id;
    assert(
      project.account_id === accountId,
      "Project response account_id changed",
    );
    assert(project.git_origin_url, "Project response has no git_origin_url");
    assert(
      project.metadata.experimental?.acp_runtime === true,
      "starter project metadata did not enable acp_runtime",
    );
    assert(
      project.experimental.acp_runtime === true,
      "starter project did not enable acp_runtime",
    );
    assert(
      project.experimental_features.some(
        (feature) =>
          feature.key === "acp_runtime" &&
          feature.name === "ACP & Multi-Harness" &&
          feature.enabled,
      ),
      "starter project did not expose the enabled ACP & Multi-Harness feature",
    );

    const seededManifest = await waitFor(
      () =>
        api<{ content?: string }>(
          token,
          "GET",
          `/projects/${projectId}/files/content?path=kortix.yaml`,
        ),
      (value) => value.content?.includes("kortix_version: 3") === true,
      "seeded ACP multi-harness manifest",
    );
    const validation = await api<{ valid: boolean; issues: unknown[] }>(
      token,
      "POST",
      `/projects/${projectId}/manifest/validate`,
      { raw: seededManifest.content ?? manifest, format: "yaml" },
    );
    assert(
      validation.valid && validation.issues.length === 0,
      `manifest validation failed: ${JSON.stringify(validation.issues)}`,
    );
    await api(
      token,
      "POST",
      `/executor/projects/${projectId}/connectors/sync`,
      {},
    );
    if (directOpenAiKey) {
      await api(token, "POST", `/projects/${projectId}/secrets`, {
        name: "OPENAI_API_KEY",
        value: directOpenAiKey,
      });
      log(
        "credential",
        "seeded temporary OPENAI_API_KEY for this disposable fixture",
      );
    }
  }

  const detail = await waitFor(
    () => api<ProjectDetail>(token, "GET", `/projects/${projectId}/detail`),
    (value) =>
      harnesses.every((harness) =>
        value.config.agents.some(
          (agent) =>
            agent.name === harness &&
            agent.runtime === harness &&
            agent.harness === harness,
        ),
      ),
    "four-agent runtime catalog",
  );
  assert(
    (detail.config.default_agent ?? detail.config.open_code_default_agent) ===
      "opencode",
    `unexpected default_agent: ${detail.config.default_agent ?? detail.config.open_code_default_agent}`,
  );

  const enabled = reuseProjectId
    ? await api<Project>(
        token,
        "PATCH",
        `/projects/${projectId}/experimental`,
        {
          feature: "acp_runtime",
          enabled: true,
        },
      )
    : await api<Project>(token, "GET", `/projects/${projectId}`);
  assert(
    enabled.experimental.acp_runtime === true,
    "acp_runtime did not enable",
  );
  assert(
    enabled.experimental_features.some(
      (feature) =>
        feature.key === "acp_runtime" &&
        feature.name === "ACP & Multi-Harness" &&
        feature.enabled,
    ),
    "experimental catalog did not expose ACP & Multi-Harness",
  );

  for (const harness of harnesses) {
    await verifyHarness(token, harness);
  }
  log("result", `PASS ${harnesses.length}/${harnesses.length} harnesses`);
  log("fixture", `project=${projectId}`);
}

async function cleanup(): Promise<void> {
  for (const controller of controllers) controller.close();
  controllers.clear();
  if (keepFixture) {
    log(
      "fixture",
      `kept project=${projectId} sessions=${sessionIds.join(",")}`,
    );
    log("login", `email=${userEmail} password=${password}`);
  } else if (accessToken && projectId) {
    for (const sessionId of sessionIds) {
      const stopped = await apiResult(
        apiBase,
        accessToken,
        "DELETE",
        `/projects/${projectId}/sessions/${sessionId}`,
      );
      assert(
        stopped.status === 200 || stopped.status === 404,
        `session cleanup returned ${stopped.status} for ${sessionId}`,
      );
    }
    if (!reuseProjectId) {
      const purged = await apiResult<{ repo_deleted?: boolean }>(
        apiBase,
        accessToken,
        "DELETE",
        `/projects/${projectId}?purge=true`,
      );
      assert(purged.status === 200, `project purge returned ${purged.status}`);
      assert(
        purged.json?.repo_deleted === true,
        "project purge did not delete the managed repo",
      );
      hardDeleteFixtureRows(projectId, accountId);
    }
  }
  if (!keepFixture && !reuseProjectId && userId && serviceRoleKey) {
    const deletedUser = await fetch(
      `${supabaseUrl}/auth/v1/admin/users/${userId}`,
      {
        method: "DELETE",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      },
    );
    assert(
      deletedUser.status === 200 ||
        deletedUser.status === 204 ||
        deletedUser.status === 404,
      `Supabase user cleanup returned ${deletedUser.status}: ${await deletedUser.text()}`,
    );
  }
  if (!keepFixture && !reuseProjectId && projectId && accountId)
    log("cleanup", "removed project, sessions, account, and user");
}

try {
  await main();
} finally {
  await cleanup();
}
