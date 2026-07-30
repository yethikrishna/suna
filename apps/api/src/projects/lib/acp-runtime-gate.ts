/**
 * Is `kortix_version: 3` reachable on this deployment?
 *
 * v3 is the ACP multi-harness manifest. It is EXPERIMENTAL and unfinished, and
 * it has no REST path at all: `createProjectSession` answers
 * `409 ACP_RUNTIME_REQUIRED` for a v3 manifest without the `acp_runtime`
 * experiment (projects/lib/sessions.ts). So a v3 project created on a
 * deployment that runs REST is a project that can never start a session.
 *
 * This gate stops that at the only place the platform itself puts a v3 manifest
 * into a repo: the starter scaffold behind `POST /projects/provision`
 * (routes/r1.ts) and `POST /projects/create-repo` (routes/r2.ts). While
 * `KORTIX_ACP_RUNTIME` is off — the default — those routes refuse a v3 starter
 * by name instead of scaffolding a project that cannot boot, and instead of
 * silently substituting the v2 starter the caller did not ask for.
 *
 * It does NOT gate reading a v3 manifest a user wrote themselves. That path
 * already refuses honestly at session create with `ACP_RUNTIME_REQUIRED`, and
 * validation still parses v3 so the error names the real problem.
 *
 * Orthogonal to projects/lib/harness-gate.ts: this decides whether ACP is
 * reachable, that one decides WHICH harness an ACP project may launch.
 */
import { starterTemplate } from '@kortix/starter';

import { config } from '../../config';

export interface AcpRuntimeDisabledError {
  status: 409;
  body: { error: string; code: 'ACP_RUNTIME_DISABLED' };
}

/** Does this starter scaffold a manifest that only runs over ACP? */
export function starterScaffoldsAcpManifest(template: unknown): boolean {
  return starterTemplate(template).manifestVersion >= 3;
}

/**
 * The refusal a caller sees when it asks for a v3 scaffold on a REST
 * deployment. `null` means the scaffold is allowed. `enabled` defaults to
 * `config.KORTIX_ACP_RUNTIME` and is injectable so a test never mutates config.
 */
export function acpStarterRefusal(
  template: unknown,
  enabled: boolean = config.KORTIX_ACP_RUNTIME,
): AcpRuntimeDisabledError | null {
  if (enabled) return null;
  const descriptor = starterTemplate(template);
  if (descriptor.manifestVersion < 3) return null;
  return {
    status: 409,
    body: {
      error:
        `The "${descriptor.label}" starter scaffolds a kortix_version 3 manifest, which runs only over ACP. ` +
        'ACP is experimental and off on this deployment, so that project could never start a session. ' +
        'An operator enables it by setting KORTIX_ACP_RUNTIME=true.',
      code: 'ACP_RUNTIME_DISABLED',
    },
  };
}
