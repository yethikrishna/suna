/**
 * Monitor-box PROVISIONING — the heavy half, deliberately in its own module.
 *
 * Creating a box needs the snapshot builder, the secrets snapshot, the agent
 * grant resolver, and the API-key repository. Every one of those drags a large
 * import subtree behind it, and none of them is needed to STOP or OBSERVE a
 * box — which is what the maintenance sweep does on almost every tick. So
 * ./monitor-box.ts imports this module dynamically, only at the moment a box
 * actually has to be built. That keeps the maintenance sweep's static import
 * graph small (it was large enough to break unrelated tests that mock
 * ../projects/git) and keeps the cost off the common path.
 *
 * Spec: docs/specs/2026-08-12-monitors.md.
 */

import { randomUUID } from 'node:crypto';
import { projectMonitorBoxes } from '@kortix/db';
import { eq, sql } from 'drizzle-orm';
import { startComputeSession } from '../../billing/services/compute-metering';
import { type ProviderName, getProvider } from '../../platform/providers';
import { sandboxFrontendBaseUrl } from '../../platform/sandbox-frontend-url';
import { createApiKey } from '../../repositories/api-keys';
import { db } from '../../shared/db';
import { DEFAULT_SANDBOX_SLUG, ensureSandboxImage, resolveTemplate } from '../../snapshots/builder';
import type { GitBackedProject } from '../git/types';
import { listProjectSecretsSnapshotForUser } from '../secrets';
import { resolveProjectAutomationActor } from '../session-lifecycle/actor';
import type { MonitorCatalogRow, MonitorProjectSnapshot } from './monitor-box-core';
import { buildMonitorEnvPayload } from './monitor-box-core';
import { MONITOR_PROVIDER, monitorProviderConfigured } from './monitor-box-provider';
import { isReservedSandboxEnvName } from './sandbox-env-names';
import { resolveSessionSecretGrant } from './secret-grant';
import { deriveKortixApiBase, proxyGitUrl } from './sessions';

/**
 * The monitor box's metering spec fallback. Matched to the session default for
 * the same reason the box boots the session snapshot: it IS a session-class box
 * with a different entrypoint, and the Platinum create path does not accept a
 * per-box machine size today (`resourceSpec` is ignored there). Billing must
 * describe the box that actually runs, not the one the spec table wishes for.
 */
const MONITOR_METERING_SPEC = { cpuCores: 2, memoryGb: 4, diskGb: 20, gpuCount: 0 };

function gitProjectOf(project: MonitorProjectSnapshot): GitBackedProject {
  return {
    projectId: project.projectId,
    repoUrl: project.repoUrl ?? '',
    defaultBranch: project.defaultBranch ?? 'main',
    manifestPath: project.manifestPath ?? 'kortix.yaml',
    gitAuthToken: null,
  };
}

/**
 * Provision one project's monitor box.
 *
 * The row is inserted BEFORE the provider call, guarded by the
 * `project_monitor_boxes_one_live_per_project` partial unique index: two
 * schedulers racing this leave exactly one winner, and the loser's insert
 * conflicts away without ever calling the provider. A create that then fails
 * marks the row `error`, which the next tick converts into a restart.
 */
export async function provisionMonitorBox(
  project: MonitorProjectSnapshot,
  monitors: MonitorCatalogRow[],
  revision: string,
): Promise<void> {
  if (!monitorProviderConfigured()) {
    console.warn(
      `[monitor-box] ${MONITOR_PROVIDER} is not configured; skipping monitor box for ${project.projectId}`,
    );
    return;
  }
  const userId = await resolveProjectAutomationActor(project.accountId);
  if (!userId) {
    console.warn(
      `[monitor-box] no automation actor for account ${project.accountId}; skipping ${project.projectId}`,
    );
    return;
  }

  const boxEpoch = randomUUID();
  const [row] = await db
    .insert(projectMonitorBoxes)
    .values({
      projectId: project.projectId,
      accountId: project.accountId,
      provider: MONITOR_PROVIDER,
      status: 'provisioning',
      boxEpoch,
      manifestRevision: revision,
      metadata: { monitors: monitors.map((monitor) => monitor.slug) },
    })
    .onConflictDoNothing()
    .returning({ boxId: projectMonitorBoxes.boxId });
  // Lost the one-live race. The winner is provisioning; nothing to do.
  if (!row) return;
  const boxId = row.boxId;

  try {
    const gitProject = gitProjectOf(project);
    // The sandbox token is minted against the BOX id, exactly as a session
    // token is minted against its sandbox id. The ingest route resolves the
    // token's sandbox id against `project_monitor_boxes.box_id`.
    const [sandboxKey, image] = await Promise.all([
      createApiKey({
        sandboxId: boxId,
        accountId: project.accountId,
        title: 'Monitor Box Token',
        type: 'sandbox',
      }),
      ensureSandboxImage(gitProject, {
        slug: DEFAULT_SANDBOX_SLUG,
        accountId: project.accountId,
        source: 'session-start',
        provider: MONITOR_PROVIDER,
      }),
    ]);

    const envVars = await buildMonitorBoxEnv({
      project,
      gitProject,
      monitors,
      boxEpoch,
      userId,
      sandboxToken: sandboxKey.secretKey,
    });

    const provider = getProvider(MONITOR_PROVIDER);
    const result = await provider.create({
      accountId: project.accountId,
      userId,
      name: `monitor-${project.projectId.slice(0, 8)}`,
      snapshot: image.snapshotName,
      workloadType: 'monitor',
      // 0 → Platinum `type: 'persistent'`. A monitor that auto-stopped on idle
      // would stop watching exactly when nothing is happening, which is the one
      // moment it must keep watching.
      autoStopInterval: 0,
      envVars,
    });

    const now = new Date();
    await db
      .update(projectMonitorBoxes)
      .set({
        externalId: result.externalId,
        status: 'running',
        startedAt: now,
        lastHeartbeatAt: now,
        updatedAt: now,
      })
      .where(eq(projectMonitorBoxes.boxId, boxId));

    await startComputeSession({
      sandboxId: boxId,
      accountId: project.accountId,
      actorUserId: userId,
      provider: MONITOR_PROVIDER,
      spec: await monitorMeteringSpec(gitProject),
      workloadType: 'monitor',
      metadata: { projectId: project.projectId, monitors: monitors.map((m) => m.slug) },
    });
    console.log(
      `[monitor-box] provisioned ${boxId} (${result.externalId}) for ${project.projectId} with ${monitors.length} monitor(s)`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db
      .update(projectMonitorBoxes)
      .set({
        status: 'error',
        updatedAt: new Date(),
        metadata: sql`coalesce(${projectMonitorBoxes.metadata}, '{}'::jsonb) || ${JSON.stringify({ lastError: message.slice(0, 2_000) })}::jsonb`,
      })
      .where(eq(projectMonitorBoxes.boxId, boxId))
      .catch(() => {});
    throw error;
  }
}

/**
 * The box's environment.
 *
 * Deliberately NOT `buildSessionRuntimeEnv`: that builder is session-shaped
 * (session id, branch name, opencode bootstrap, compiled agent config), and
 * every one of those keys is wrong here. What IS shared is the part that
 * matters — the git-proxy repo URL, the API base, and the project's runtime
 * secrets under the same grant an agent would get.
 */
async function buildMonitorBoxEnv(input: {
  project: MonitorProjectSnapshot;
  gitProject: GitBackedProject;
  monitors: MonitorCatalogRow[];
  boxEpoch: string;
  userId: string;
  sandboxToken: string;
}): Promise<Record<string, string>> {
  const secrets = await resolveMonitorBoxSecrets(input.project, input.gitProject, input.userId);
  return {
    ...secrets,
    KORTIX_SANDBOX_TOKEN: input.sandboxToken,
    // Back-compat alias, same as a session gets.
    KORTIX_TOKEN: input.sandboxToken,
    KORTIX_WORKLOAD: 'monitor',
    KORTIX_MONITORS: buildMonitorEnvPayload(input.monitors),
    KORTIX_MONITOR_BOX_EPOCH: input.boxEpoch,
    KORTIX_PROJECT_ID: input.project.projectId,
    KORTIX_API_URL: deriveKortixApiBase(),
    KORTIX_FRONTEND_URL: sandboxFrontendBaseUrl(),
    KORTIX_SERVICE_PORT: '8000',
    // Clone through the Kortix git proxy, authenticated with the box's own
    // sandbox token. The clone-credential HTTP route is session-scoped and
    // would 403 this box, so the proxy form is the ONLY transport available.
    KORTIX_REPO_URL: proxyGitUrl(input.project.projectId),
    KORTIX_DEFAULT_BRANCH: input.gitProject.defaultBranch,
    KORTIX_BASE_REF: input.gitProject.defaultBranch,
    KORTIX_PROJECT_AUTO_CLONE: '1',
    // No KORTIX_BRANCH_NAME on purpose — the daemon then leaves the checkout on
    // default-branch HEAD instead of minting a session branch.
    KORTIX_CLONE_FILTER: '',
  };
}

/**
 * The project secrets the box may hold: the UNION of the enabled monitors'
 * agent grants.
 *
 * One box runs every monitor, so it cannot hold one agent's grant. The union is
 * the tightest grant that still lets each monitor do what its own agent could
 * — and it is strictly narrower than the 'all' a naive implementation would
 * hand over. If ANY monitor's agent has an unscoped grant the union is
 * unscoped, exactly as that one monitor's session would be.
 *
 * Non-`runtime` secrets are withheld: they are delivered as a per-SESSION
 * handle, and a monitor box has no session (see resolveSecretDelivery's
 * `no_session` verdict). That is the correct fail direction — withhold, never
 * fall back to plaintext.
 */
async function resolveMonitorBoxSecrets(
  project: MonitorProjectSnapshot,
  gitProject: GitBackedProject,
  userId: string,
): Promise<Record<string, string>> {
  let grant: string[] | 'all' | undefined = [];
  const agents = new Set<string>();
  for (const monitor of project.monitors) {
    const agent = (monitor.spec as { agent?: unknown } | null)?.agent;
    agents.add(typeof agent === 'string' && agent.trim() ? agent.trim() : 'default');
  }
  for (const agent of agents) {
    const resolved = await resolveSessionSecretGrant({
      projectId: project.projectId,
      repoUrl: gitProject.repoUrl,
      defaultBranch: gitProject.defaultBranch,
      manifestPath: gitProject.manifestPath,
      sessionAgent: agent,
    });
    // `undefined`/'all' is an UNSCOPED grant. Once one monitor has it, the
    // union is unscoped and narrowing further would starve that monitor.
    if (resolved === undefined || resolved === 'all') {
      grant = resolved;
      break;
    }
    if (Array.isArray(grant)) grant = [...new Set([...grant, ...resolved])];
  }

  const snapshot = await listProjectSecretsSnapshotForUser(
    project.projectId,
    userId,
    grant,
    // No session ⇒ handle-delivered secrets are withheld rather than emitted.
    null,
  );
  const env = { ...snapshot.env };
  // The same guardrail sessions get: a project secret must never clobber the
  // box's own runtime env (KORTIX_*, PATH, …).
  for (const name of Object.keys(env)) {
    if (isReservedSandboxEnvName(name)) delete env[name];
  }
  delete env.SLACK_SIGNING_SECRET;
  delete env.SLACK_BOT_TOKEN;
  return env;
}

/** Metering spec for the box — the project's template size, or the default. */
async function monitorMeteringSpec(gitProject: GitBackedProject) {
  const spec = { ...MONITOR_METERING_SPEC };
  try {
    const template = await resolveTemplate(gitProject, DEFAULT_SANDBOX_SLUG);
    if (template.cpu !== undefined) spec.cpuCores = template.cpu;
    if (template.memoryGb !== undefined) spec.memoryGb = template.memoryGb;
    if (template.diskGb !== undefined) spec.diskGb = template.diskGb;
  } catch {
    // Repo unreachable / parse error. Metering the default is still honest
    // enough to bill; a missing meter would not be.
  }
  return spec;
}
