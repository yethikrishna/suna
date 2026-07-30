/**
 * Tracks which session currently owns each bare OpenCode session id in the
 * compatibility sync store. OpenCode ids are local to a sandbox. A restored
 * snapshot can therefore expose the same id from two different sandboxes.
 *
 * `kortix:<projectId>/<sessionId>` is authoritative because that consumer
 * knows the platform session. `runtime:<sandboxId>` is a fallback for a
 * standalone consumer that only knows the active runtime.
 *
 * These scope kinds can describe the same active session. They must not evict
 * each other. Two scopes of the same kind still conflict when their values
 * differ.
 */

const owners = new Map<string, string>();
const AUTHORITATIVE_PREFIX = 'kortix:';

function isAuthoritative(ownerScope: string): boolean {
  return ownerScope.startsWith(AUTHORITATIVE_PREFIX);
}

export function resolveSessionCacheOwnerScope(
  runtimeScope: string,
  kortixSessionScope?: string,
): string | null {
  if (kortixSessionScope) return `${AUTHORITATIVE_PREFIX}${kortixSessionScope}`;
  if (!runtimeScope || runtimeScope === 'none') return null;
  return `runtime:${runtimeScope}`;
}

export function sessionCacheOwnerScopesConflict(
  first: string | null,
  second: string | null,
): boolean {
  if (!first || !second || first === second) return false;
  return isAuthoritative(first) === isAuthoritative(second);
}

export function getSessionCacheOwnership(sessionId: string): string | null {
  return owners.get(sessionId) ?? null;
}

export function claimSessionCacheOwnership(
  sessionId: string,
  ownerScope: string,
): { changed: boolean; previousOwnerScope: string | null } {
  const previousOwnerScope = getSessionCacheOwnership(sessionId);
  if (previousOwnerScope === ownerScope) {
    return { changed: false, previousOwnerScope };
  }
  if (
    previousOwnerScope !== null &&
    !isAuthoritative(ownerScope) &&
    isAuthoritative(previousOwnerScope)
  ) {
    return { changed: false, previousOwnerScope };
  }
  owners.set(sessionId, ownerScope);
  return { changed: true, previousOwnerScope };
}

export function resetSessionCacheOwnership(): void {
  owners.clear();
}
