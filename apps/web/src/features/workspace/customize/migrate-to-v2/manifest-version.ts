'use client';

/**
 * Manifest-version state for the upgrade surfaces — a thin read of the SERVER's
 * verdict, with no client-side inference whatsoever.
 *
 * This file used to sniff the version out of `config.manifest_raw` with a regex
 * and default every miss to v1. That predicate reported four different "I don't
 * know" cases as "v1, needs migrating": no manifest text, unparseable text,
 * text with no `kortix_version`, and a config the caller may not read. A
 * freshly provisioned v3 project hits the first case whenever its repo has not
 * been read yet, so the sidebar advertised a v1→v2 migration on projects that
 * were already v3. It also clamped every version >= 2 to 2, making v3
 * indistinguishable from v2.
 *
 * The manifest declares its own version (`kortix_version` is required by
 * `kortix.v1/v2/v3.schema.json`), so the API now reads it and returns
 * `config.manifest_version` — the version, the platform's latest, whether a
 * migration is offered, and the version it targets. Unknown stays unknown here:
 * `migrationOffered` is false and the surfaces render nothing.
 */

import { type ProjectManifestVerdict, getProjectDetail, manifestMigrationOffer } from '@kortix/sdk';
import { useQuery } from '@tanstack/react-query';

export interface ManifestUpgradeState {
  /** Declared manifest version. `null` = the server could not determine it. */
  version: number | null;
  /** Render an upgrade surface only when this is true. */
  migrationOffered: boolean;
  /** Version the offered migration produces. `null` when none is offered. */
  targetVersion: number | null;
  /** True for v2+ — the governance-first `agents:` map shape. Never true for
   *  an unknown version, so declarative-only UI stays hidden rather than
   *  guessing. */
  isGovernanceFirst: boolean;
  /** Manifest file the server actually read (e.g. `kortix.yaml`). `null` when
   *  no manifest was read — callers must not substitute a guess. */
  manifestFilename: string | null;
}

const UNKNOWN: ManifestUpgradeState = {
  version: null,
  migrationOffered: false,
  targetVersion: null,
  isGovernanceFirst: false,
  manifestFilename: null,
};

/** Project-detail config shape this module needs. Kept structural so the
 *  helper is callable with a `ProjectConfigSummary` or a bare verdict holder. */
type ManifestVerdictHolder = { manifest_version?: ProjectManifestVerdict | null };

/** Normalize the server verdict for rendering. Fails closed on anything the
 *  server did not state outright. */
export function manifestUpgradeState(
  config: ManifestVerdictHolder | null | undefined,
): ManifestUpgradeState {
  const verdict = config?.manifest_version;
  if (!verdict) return UNKNOWN;
  const offer = manifestMigrationOffer(config);
  const path = typeof verdict.path === 'string' && verdict.path ? verdict.path : null;
  return {
    version: offer.currentVersion,
    migrationOffered: offer.offered,
    targetVersion: offer.targetVersion,
    isGovernanceFirst: offer.currentVersion !== null && offer.currentVersion >= 2,
    manifestFilename: path ? path.split('/').pop() || null : null,
  };
}

/**
 * Badge label naming the manifest file and the agent-declaration shape it uses
 * (`agents:` map from v2 on, `[[agents]]` array in v1). Returns `null` for an
 * unknown manifest — the old code claimed `kortix.toml [[agents]]` for anything
 * it could not read, which was wrong for every v3 project.
 */
export function manifestScopeLabel(state: ManifestUpgradeState): string | null {
  if (state.version === null || !state.manifestFilename) return null;
  const shape = state.isGovernanceFirst ? 'agents:' : '[[agents]]';
  return `${state.manifestFilename} ${shape}`;
}

export interface ProjectManifestUpgrade extends ManifestUpgradeState {
  /** True while the project-detail read is in flight. Surfaces render nothing
   *  until it resolves — `UNKNOWN` already offers no migration. */
  isLoading: boolean;
}

/**
 * Reads the SAME `['project-detail', projectId]` query the rest of Customize
 * already fetches, so this adds no network request when that query is warm;
 * react-query dedupes on the identical key + queryFn.
 */
export function useProjectManifestUpgrade(projectId: string): ProjectManifestUpgrade {
  const detail = useQuery({
    queryKey: ['project-detail', projectId],
    queryFn: () => getProjectDetail(projectId),
    enabled: !!projectId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  return { ...manifestUpgradeState(detail.data?.config), isLoading: detail.isLoading };
}
