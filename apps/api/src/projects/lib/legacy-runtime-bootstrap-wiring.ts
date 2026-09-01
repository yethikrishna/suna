/**
 * Production wiring for the legacy runtime bootstrap: DB row → health probe →
 * provider exec → metadata + audit. The policy lives in
 * legacy-runtime-bootstrap.ts and is tested without any of this.
 */
import { sessionSandboxes } from '@kortix/db';
import { eq } from 'drizzle-orm';
import { getProvider, type ProviderName } from '../../platform/providers';
import { readFileSync } from 'node:fs';
import { runtimeAssetsManifest, runtimeEntrypointPath } from '../../runtime-assets/manifest';
import { resolveSandboxIngress } from '../../sandbox-proxy/backend';
import { recordAuditEvent } from '../../shared/audit';
import { db } from '../../shared/db';
import { OPENCODE_PRIMARY_PORT } from '../../shared/opencode-ports';
import { mergeMetadata } from '../reaping/sandbox-state-sync';
import {
  bootstrapLegacyRuntime,
  type LegacyBootstrapDeps,
  type LegacyBootstrapResult,
} from './legacy-runtime-bootstrap';

const SANDBOX_SERVICE_PORT = 8000;
const HEALTH_TIMEOUT_MS = 8_000;

export interface LegacyBootstrapRow {
  sandboxId: string;
  sessionId: string | null;
  accountId: string | null;
  projectId?: string | null;
  provider: ProviderName | string;
  externalId: string;
  metadata: Record<string, unknown> | null;
}

/** Kill switch + scope, read per call so a `kubectl set env` takes effect without a rebuild. */
export function legacyRuntimeBootstrapEnabled(): boolean {
  const raw = (process.env.LEGACY_RUNTIME_BOOTSTRAP ?? 'on').trim().toLowerCase();
  return !['0', 'false', 'off', 'no'].includes(raw);
}

/** Concurrent bootstraps per API replica. Each one downloads ~100 MB into a box and holds a poll loop. */
const MAX_IN_FLIGHT = Number(process.env.LEGACY_RUNTIME_BOOTSTRAP_CONCURRENCY ?? '2') || 2;
const inFlight = new Set<string>();

async function fetchJson(url: string, headers: Record<string, string>): Promise<unknown> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.json().catch(() => null);
  } catch {
    return null;
  }
}

export function buildLegacyBootstrapDeps(row: LegacyBootstrapRow): LegacyBootstrapDeps {
  const provider = getProvider(row.provider as ProviderName);
  return {
    now: () => Date.now(),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    manifestBuild: async () => {
      try {
        return (await runtimeAssetsManifest()).build;
      } catch {
        return null;
      }
    },
    fetchHealth: async () => {
      const { url, headers } = await resolveSandboxIngress(row.externalId, {
        port: SANDBOX_SERVICE_PORT,
        transport: 'http',
      });
      return fetchJson(`${url.replace(/\/$/, '')}/kortix/health`, headers);
    },
    fetchOpencodeStatus: async () => {
      const { url, headers } = await resolveSandboxIngress(row.externalId, {
        port: OPENCODE_PRIMARY_PORT,
        transport: 'http',
      });
      const body = await fetchJson(`${url.replace(/\/$/, '')}/session/status`, headers);
      return body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
    },
    entrypointSource: () => {
      try {
        return readFileSync(runtimeEntrypointPath(), 'utf8');
      } catch {
        return null;
      }
    },
    exec: async (command, timeoutMs) => {
      if (!provider.exec) throw new Error(`provider ${row.provider} has no exec channel`);
      return provider.exec(row.externalId, command, { timeoutMs });
    },
    patchMetadata: async (patch) => {
      await db
        .update(sessionSandboxes)
        .set({ metadata: mergeMetadata(patch) })
        .where(eq(sessionSandboxes.sandboxId, row.sandboxId));
    },
    audit: async (event) => {
      await recordAuditEvent({
        accountId: row.accountId ?? null,
        projectId: row.projectId ?? null,
        sessionId: row.sessionId ?? null,
        actorType: 'system',
        source: 'legacy-runtime-bootstrap',
        action: 'sandbox.runtime.legacy_bootstrap',
        phase: event.phase,
        resourceType: 'sandbox',
        resourceId: row.sandboxId,
        outcome: event.outcome,
        outputSummary: { externalId: row.externalId, provider: row.provider, ...event.summary },
        errorMessage: event.error ?? null,
      }).catch((err) =>
        console.warn(
          '[legacy-bootstrap] audit write failed:',
          err instanceof Error ? err.message : err,
        ),
      );
    },
    log: (message, context) => console.log(`[legacy-bootstrap] ${message}`, context ?? ''),
  };
}

/** Run one bootstrap to completion. Used by the operator sweep and by the reaper's scheduler. */
export async function runLegacyRuntimeBootstrap(
  row: LegacyBootstrapRow,
  reason: string,
  opts: { force?: boolean } = {},
): Promise<LegacyBootstrapResult> {
  return bootstrapLegacyRuntime(
    {
      sandboxId: row.sandboxId,
      externalId: row.externalId,
      provider: row.provider,
      metadata: row.metadata,
      reason,
      force: opts.force,
    },
    buildLegacyBootstrapDeps(row),
  );
}

/**
 * Reaper entry point: fire-and-forget with a per-replica concurrency cap. The
 * policy's own gates (recent-check TTL, cooldown, budget, busy) make this
 * cheap on a converged fleet — one health probe per box per 6 h.
 */
export function scheduleLegacyRuntimeBootstrap(row: LegacyBootstrapRow, reason = 'reaper'): boolean {
  if (!legacyRuntimeBootstrapEnabled()) return false;
  if (!row.externalId) return false;
  if (inFlight.has(row.sandboxId) || inFlight.size >= MAX_IN_FLIGHT) return false;
  inFlight.add(row.sandboxId);
  void runLegacyRuntimeBootstrap(row, reason)
    .catch((err) =>
      console.warn(
        `[legacy-bootstrap] ${row.sandboxId} failed:`,
        err instanceof Error ? err.message : err,
      ),
    )
    .finally(() => inFlight.delete(row.sandboxId));
  return true;
}

/** Test seam. */
export function legacyBootstrapInFlightCount(): number {
  return inFlight.size;
}
