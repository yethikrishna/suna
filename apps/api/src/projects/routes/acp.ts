import { sessionSandboxes } from '@kortix/db';
import { isHarnessId } from '@kortix/shared/harnesses';
import { and, eq } from 'drizzle-orm';
import type { Context } from 'hono';

import { PROJECT_ACTIONS } from '../../iam';
import type { ProviderName } from '../../platform/providers';
import { invalidateSandbox } from '../../sandbox-proxy/backend';
import { db } from '../../shared/db';
import type { AppEnv } from '../../types';
import { assertProjectCapability, loadProjectForUser, loadVisibleSession } from '../lib/access';
import { createPersistedAcpSseProxy } from '../lib/acp-sse-proxy';
import { appendAcpEnvelope, loadAcpTranscript } from '../lib/acp-transcript';
import { projectsApp } from '../lib/app';
import { callerKortixSessionId } from '../lib/caller-session';
import { syncSandboxEnvForPrompt } from '../lib/sandbox-env-sync';
import { sandboxRuntimeEndpoint } from '../runtime-inspection';
import { isSandboxAuthored, observeTurnStart } from '../sandbox-deadline';
import {
  type PromptInfo,
  generateSessionTitleFromFirstPrompt,
  promptInfoFromEnvelope,
} from '../session-title-generate';

type AcpSessionBinding = {
  projectId: string;
  accountId: string;
  sessionId: string;
  acpServerId: string;
  runtimeHarness: 'claude' | 'codex' | 'opencode' | 'pi';
  /** `metadata.native_agent` — the HARNESS-native agent this session committed
   *  to at create (compile-runtime-config.ts → sessions.ts). Null when the
   *  project's Kortix agent maps to no harness agent, so the harness runs its
   *  own default. Immutable for the session's life; the grant on
   *  `account_tokens.agent_grant` was minted from it. */
  nativeAgent: string | null;
  userId: string;
  canManageSharing: boolean;
};

/**
 * Would this envelope re-point the session's ACTING AGENT?
 *
 * `session/set_config_option` is the one relayed method that can change WHO
 * runs, and the API used to forward it verbatim (only `session/prompt` was ever
 * inspected). On OpenCode the `mode` option selects the harness AGENT — the
 * built-ins `build` / `plan` plus every project agent declared `mode: primary`,
 * which is what a marketplace template installs. That harness agent IS the
 * Kortix identity `account_tokens.agent_grant` was minted for, and the connector
 * / Kortix-CLI / secret gates read that row at CALL time
 * (executor/router.ts, iam/engine-v2.ts, secrets/strategy.ts). So relaying a
 * foreign `mode` runs agent B for the rest of the session under agent A's grant
 * — the escalation projects/lib/session-token-grant.ts documents.
 *
 * Refused rather than re-minted, matching the REST path's existing
 * agent-immutability contract (409 AGENT_SWITCH_REQUIRES_NEW_SESSION, see
 * sandbox-proxy/routes/preview.ts): a re-mint can re-scope connectors and CLI
 * powers, but it cannot un-read the secrets agent A already pulled into the
 * box's env, its shells and its context. There is no per-turn ACP re-mint hook
 * to hang one on either — the mode persists for the session, not the turn.
 *
 * PER-HARNESS RULE. Only OpenCode is policed:
 *   - `opencode` — `mode` is the agent. ENFORCE against the committed one.
 *   - `claude` — `mode` is the PERMISSION mode (`default`, `acceptEdits`,
 *     `plan`, `bypassPermissions`). The acting agent is fixed by the harness
 *     config dir at process launch and no mode value moves it.
 *   - `codex` — `mode` is the approval preset (`agent`, `agent-full-access`).
 *     Same reasoning.
 *   - `pi` — advertises no `mode` option at all.
 * Policing the value on those three would 409 an ordinary permission change,
 * which is a legitimate user action and not a privilege change at all. The value
 * alone cannot be classified ("plan" is BOTH an OpenCode agent and a Claude
 * permission mode), so the decision is made from `runtime_harness`, which the
 * session fixed at create and a caller cannot influence.
 *
 * A session with NO committed native agent is not policed either: its Kortix
 * agent is not an OpenCode agent, so the only reachable modes are OpenCode's own
 * built-ins, which carry no grant. That is also the only shape a legitimate
 * `build` ⇄ `plan` switch can have — the product's own clients send `mode` ONLY
 * as the committed native agent (sdk session-controller.ts,
 * session-lifecycle/headless-acp.ts), so nothing the product does is refused.
 */
export function foreignAgentModeSwitch(
  binding: Pick<AcpSessionBinding, 'runtimeHarness' | 'nativeAgent'>,
  envelope: Record<string, unknown>,
): { expectedAgent: string; requestedAgent: string } | null {
  if (binding.runtimeHarness !== 'opencode') return null;
  const committed = binding.nativeAgent?.trim();
  if (!committed) return null;
  if (envelope.method !== 'session/set_config_option') return null;
  const params =
    envelope.params && typeof envelope.params === 'object' && !Array.isArray(envelope.params)
      ? (envelope.params as Record<string, unknown>)
      : {};
  if (params.configId !== 'mode') return null;
  const requested = typeof params.value === 'string' ? params.value.trim() : '';
  if (requested === committed) return null;
  // A non-string value cannot prove it names the committed agent. Refuse rather
  // than pass it through and hope the harness rejects it.
  return { expectedAgent: committed, requestedAgent: requested || String(params.value) };
}

function decodedResponseHeaders(upstream: Response): Headers {
  const headers = new Headers(upstream.headers);
  headers.delete('content-encoding');
  headers.delete('content-length');
  headers.delete('transfer-encoding');
  return headers;
}

async function resolveAcpBinding(
  c: Context<AppEnv>,
  action: 'read' | 'session',
  capability: string,
): Promise<AcpSessionBinding | null> {
  const projectId = c.req.param('projectId');
  const sessionId = c.req.param('sessionId');
  if (!projectId || !sessionId) return null;
  const loaded = await loadProjectForUser(c, projectId, action);
  if (!loaded) return null;
  await assertProjectCapability(c, loaded.userId, loaded.row.accountId, projectId, capability);
  const visible = await loadVisibleSession(loaded, sessionId, c.get('sessionId') ?? null);
  if (!visible) return null;
  const metadata = (visible.row.metadata ?? {}) as Record<string, unknown>;
  if (
    metadata.runtime_transport !== 'acp' ||
    typeof metadata.acp_server_id !== 'string' ||
    !isHarnessId(metadata.runtime_harness)
  ) {
    return null;
  }
  return {
    projectId,
    accountId: loaded.row.accountId,
    sessionId,
    acpServerId: metadata.acp_server_id,
    runtimeHarness: metadata.runtime_harness,
    nativeAgent: typeof metadata.native_agent === 'string' ? metadata.native_agent : null,
    userId: loaded.userId,
    canManageSharing: visible.canManageSharing,
  };
}

async function resolveAcpTarget(
  c: Context<AppEnv>,
  action: 'read' | 'session',
  capability: string,
) {
  const binding = await resolveAcpBinding(c, action, capability);
  if (!binding) return null;
  const [sandbox] = await db
    .select({
      externalId: sessionSandboxes.externalId,
      provider: sessionSandboxes.provider,
    })
    .from(sessionSandboxes)
    .where(
      and(
        eq(sessionSandboxes.projectId, binding.projectId),
        eq(sessionSandboxes.sessionId, binding.sessionId),
      ),
    )
    .limit(1);
  if (!sandbox?.externalId) return null;
  const endpoint = await sandboxRuntimeEndpoint(sandbox.externalId, binding.userId);
  if (!endpoint) return null;
  return {
    ...binding,
    externalId: sandbox.externalId,
    provider: sandbox.provider as ProviderName,
    endpoint,
  };
}

type AcpTarget = NonNullable<Awaited<ReturnType<typeof resolveAcpTarget>>>;

function acpUpstreamUrl(target: AcpTarget): string {
  return (
    `${target.endpoint.url}/kortix/acp/${encodeURIComponent(target.acpServerId)}` +
    `?agent=${encodeURIComponent(target.runtimeHarness)}`
  );
}

async function refreshAcpTargetIngress(target: AcpTarget): Promise<AcpTarget | null> {
  invalidateSandbox(target.externalId);
  const endpoint = await sandboxRuntimeEndpoint(target.externalId, target.userId);
  return endpoint ? { ...target, endpoint } : null;
}

async function fetchAcpUpstreamWithIngressRefresh(
  target: AcpTarget,
  createInit: (target: AcpTarget) => RequestInit,
): Promise<{ target: AcpTarget; upstream: Response }> {
  let activeTarget = target;
  let upstream = await fetch(acpUpstreamUrl(activeTarget), createInit(activeTarget));
  if (upstream.status !== 401 && upstream.status !== 403) {
    return { target: activeTarget, upstream };
  }

  const refreshed = await refreshAcpTargetIngress(activeTarget);
  if (!refreshed) return { target: activeTarget, upstream };
  activeTarget = refreshed;
  upstream = await fetch(acpUpstreamUrl(activeTarget), createInit(activeTarget));
  return { target: activeTarget, upstream };
}

async function syncPromptEnvWithIngressRefresh(target: AcpTarget): Promise<AcpTarget> {
  const sync = (activeTarget: AcpTarget) =>
    syncSandboxEnvForPrompt({
      projectId: activeTarget.projectId,
      sessionId: activeTarget.sessionId,
      serviceKey: activeTarget.endpoint.serviceKey,
      previewUrl: activeTarget.endpoint.url,
      providerHeaders: activeTarget.endpoint.providerHeaders,
      providerName: activeTarget.provider,
    });

  try {
    await sync(target);
    return target;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/\benv sync failed: (?:401|403)\b/.test(message)) throw error;
    const refreshed = await refreshAcpTargetIngress(target);
    if (!refreshed) throw error;
    await sync(refreshed);
    return refreshed;
  }
}

projectsApp.get('/:projectId/sessions/:sessionId/acp/transcript', async (c) => {
  const binding = await resolveAcpBinding(c, 'read', PROJECT_ACTIONS.PROJECT_SESSION_READ);
  if (!binding) return c.json({ error: 'ACP session not found' }, 404);
  const rawAfter = c.req.query('after')?.trim();
  const afterOrdinal = rawAfter ? Number(rawAfter) : 0;
  if (!Number.isSafeInteger(afterOrdinal) || afterOrdinal < 0) {
    return c.json({ error: 'after must be a non-negative integer' }, 400);
  }
  const envelopes = await loadAcpTranscript({
    projectId: binding.projectId,
    sessionId: binding.sessionId,
    afterOrdinal,
  });
  return c.json({
    runtime_id: binding.sessionId,
    envelopes,
  });
});

projectsApp.on(['GET', 'POST', 'DELETE'], '/:projectId/sessions/:sessionId/acp', async (c) => {
  const method = c.req.method.toUpperCase();
  let target = await resolveAcpTarget(
    c,
    method === 'GET' ? 'read' : 'session',
    method === 'GET'
      ? PROJECT_ACTIONS.PROJECT_SESSION_READ
      : method === 'DELETE'
        ? PROJECT_ACTIONS.PROJECT_SESSION_STOP
        : PROJECT_ACTIONS.PROJECT_SESSION_START,
  );
  if (!target) return c.json({ error: 'ACP session runtime not found' }, 404);

  if (method === 'POST') {
    let envelope: Record<string, unknown>;
    try {
      const parsed = await c.req.json();
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('not an object');
      }
      envelope = parsed as Record<string, unknown>;
    } catch {
      return c.json({ error: 'request body must be JSON' }, 400);
    }

    // WHO RUNS, before anything else. This must precede the transcript append
    // and the relay: a refused switch may not be recorded as if the harness had
    // accepted it, and must never reach the box. See foreignAgentModeSwitch.
    const foreignAgent = foreignAgentModeSwitch(target, envelope);
    if (foreignAgent) {
      return c.json(
        {
          error: 'agent switch requires a new session',
          code: 'AGENT_SWITCH_REQUIRES_NEW_SESSION',
          expected_agent: foreignAgent.expectedAgent,
          requested_agent: foreignAgent.requestedAgent,
        },
        409,
      );
    }

    // The web UI's send path for every managed-ACP session. It does not go
    // through the sandbox proxy, so this is where its first prompt becomes
    // known server-side — but only ONCE the box has accepted it. Titling a
    // prompt the agent never saw would name the session after a message the
    // user is about to retype, permanently (the proxy hook holds the same
    // contract).
    let titlePrompt: PromptInfo | null = null;
    if (envelope.method === 'session/prompt') {
      try {
        target = await syncPromptEnvWithIngressRefresh(target);
      } catch (error) {
        return c.json(
          {
            error: 'project env sync failed',
            detail: error instanceof Error ? error.message : String(error),
          },
          502,
        );
      }
      titlePrompt = promptInfoFromEnvelope(envelope);
      // OBSERVE THE TURN START BEFORE RELAYING IT. Same contract as the proxy
      // edge (sandbox-proxy/routes/preview.ts): this is the ONE observation the
      // control plane makes of a run beginning, it must never come from the box's
      // own credential, and at the 24-hour absolute run cap the box must be
      // REFUSED rather than handed a prompt it is about to be killed mid-way
      // through. `parkBoxAtRunCap` is left to the reaper here — this route has no
      // provider handle of its own and the next prompt auto-resumes the box.
      // `callerKortixSessionId`, NEVER the raw `c.get('sessionId')`. This route
      // is mounted under `supabaseAuth`, which sets that context var to the
      // SUPABASE AUTH SESSION id (which browser login is this) for every human.
      // Reading it raw made `isSandboxAuthored` true for every browser user, so
      // this observation — the ONLY deadline extension an ACP session has, and
      // the at-cap refusal — was dead code for the entire web product.
      if (!isSandboxAuthored(c.get('apiKeyType'), callerKortixSessionId(c))) {
        const observed = await observeTurnStart({ sessionId: target.sessionId });
        if (observed === 'at_cap') {
          return c.json(
            {
              error: 'This sandbox has reached its 24-hour continuous run limit and is restarting.',
              code: 'sandbox_run_cap_reached',
              retry: true,
            },
            503,
          );
        }
      }
    }

    await appendAcpEnvelope({
      projectId: target.projectId,
      sessionId: target.sessionId,
      runtimeInstanceId: target.acpServerId,
      direction: 'client_to_agent',
      envelope,
    });
    const body = JSON.stringify(envelope);
    const { upstream } = await fetchAcpUpstreamWithIngressRefresh(target, (activeTarget) => {
      const headers = new Headers(activeTarget.endpoint.headers);
      headers.set('Content-Type', 'application/json');
      return {
        method: 'POST',
        headers,
        body,
        signal: c.req.raw.signal,
      };
    });
    if (upstream.ok && titlePrompt?.text) {
      void generateSessionTitleFromFirstPrompt({
        sessionId: target.sessionId,
        projectId: target.projectId,
        accountId: target.accountId,
        userId: target.userId,
        firstPromptText: titlePrompt.text,
        modelHint: titlePrompt.model ?? undefined,
      });
    }
    if (upstream.ok && upstream.status !== 202 && upstream.status !== 204) {
      const body = await upstream.text();
      try {
        const responseEnvelope = JSON.parse(body) as Record<string, unknown>;
        await appendAcpEnvelope({
          projectId: target.projectId,
          sessionId: target.sessionId,
          runtimeInstanceId:
            upstream.headers.get('x-kortix-acp-runtime-instance') ?? target.acpServerId,
          direction: 'agent_to_client',
          envelope: responseEnvelope,
        });
      } catch (error) {
        console.warn('[acp] failed to persist direct response', {
          sessionId: target.sessionId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return new Response(body, {
        status: upstream.status,
        headers: decodedResponseHeaders(upstream),
      });
    }
    return new Response(upstream.body, {
      status: upstream.status,
      headers: decodedResponseHeaders(upstream),
    });
  }

  if (method === 'GET') {
    const rawAfter = c.req.header('last-event-id')?.trim();
    const afterOrdinal = rawAfter ? Number(rawAfter) : 0;
    if (!Number.isSafeInteger(afterOrdinal) || afterOrdinal < 0) {
      return c.json({ error: 'Last-Event-ID must be a non-negative integer' }, 400);
    }
    const { upstream } = await fetchAcpUpstreamWithIngressRefresh(target, (activeTarget) => {
      const headers = new Headers(activeTarget.endpoint.headers);
      headers.set('Accept', 'text/event-stream');
      // Always replay the active process from its first event. The durable
      // unique key removes duplicates and the DB ordinal remains monotonic
      // when a restarted harness begins a new upstream sequence.
      headers.set('Last-Event-ID', '0');
      return {
        method: 'GET',
        headers,
        signal: c.req.raw.signal,
      };
    });
    if (!upstream.ok || !upstream.body) {
      return new Response(upstream.body, {
        status: upstream.status,
        headers: decodedResponseHeaders(upstream),
      });
    }
    const runtimeInstanceId =
      upstream.headers.get('x-kortix-acp-runtime-instance') ?? target.acpServerId;
    const body = createPersistedAcpSseProxy(upstream.body, {
      afterOrdinal,
      replay: () =>
        loadAcpTranscript({
          projectId: target.projectId,
          sessionId: target.sessionId,
          afterOrdinal,
        }),
      persist: (upstreamEventId, envelope) =>
        appendAcpEnvelope({
          projectId: target.projectId,
          sessionId: target.sessionId,
          runtimeInstanceId,
          direction: 'agent_to_client',
          upstreamEventId,
          envelope,
        }),
    });
    const responseHeaders = decodedResponseHeaders(upstream);
    responseHeaders.set('Cache-Control', 'no-cache, no-transform');
    responseHeaders.set('Content-Type', 'text/event-stream');
    responseHeaders.set('X-Accel-Buffering', 'no');
    return new Response(body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  }

  if (!target.canManageSharing) {
    return c.json(
      { error: 'Only the session owner or an account owner/admin can stop this session' },
      403,
    );
  }
  const { upstream } = await fetchAcpUpstreamWithIngressRefresh(target, (activeTarget) => ({
    method: 'DELETE',
    headers: activeTarget.endpoint.headers,
    signal: c.req.raw.signal,
  }));
  return new Response(upstream.body, {
    status: upstream.status,
    headers: decodedResponseHeaders(upstream),
  });
});
