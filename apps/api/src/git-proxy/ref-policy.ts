/**
 * Which refs may a given principal move? — the git proxy's ref-level authority.
 *
 * Until this module existed, git authorization was one boolean for the whole
 * repository: `git-receive-pack` ⇒ "write", and the request body streamed to the
 * upstream unread. Any token that could push at all could push anything — a
 * session agent could commit straight onto `main`, force-rewind it, or delete
 * another session's branch, and the only thing standing in the way was a
 * sentence in a prompt telling the agent not to. Verified on dev 2026-08-31: a
 * sandbox token force-rewound `main` to its root commit through the proxy.
 *
 * The rules below are a per-principal ALLOWLIST, not a protected-branch
 * blocklist. That direction matters. A blocklist ("protect the default branch")
 * has to be configured, can be configured wrong, and leaves every unlisted ref
 * — another session's branch, a long-lived `dev` trunk a team treats as its
 * real base — wide open. An allowlist derived from what the principal IS needs
 * no configuration and cannot drift away from the session model:
 *
 *   session  → exactly its own branch. That is the entire git surface a session
 *              needs: the daemon pushes `HEAD:refs/heads/<branch>` and nothing
 *              else, and work reaches any other ref through a change request a
 *              human merges.
 *   monitor  → nothing. Monitor boxes clone at default-branch HEAD and never
 *              push.
 *   user     → any ref, minus deleting the default branch. A human at a laptop
 *              running `kortix ship` on `main` is a shipped, advertised flow.
 *   internal → unconstrained. Server-side writers (change-request merge,
 *              dashboard config commits) do not traverse this proxy at all;
 *              the variant exists so that "who may move a ref" has exactly one
 *              answer in the codebase rather than four.
 *
 * DELIBERATELY NOT HERE: rejecting a non-fast-forward (force) push. Whether an
 * update is a fast-forward is a question about commit ancestry, and the new
 * commits live in the pack that has not been uploaded yet — the proxy would
 * have to receive and index the pack, i.e. become a git server, to answer it.
 * That check belongs on the upstream, which already has the objects: a GitHub
 * ruleset blocking force-pushes and deletions on the default branch. Such a
 * ruleset does NOT block the change-request merge path, because that path
 * pushes an ordinary fast-forward or merge commit. See the PR description.
 */
import { isDelete, type RefUpdate } from './receive-pack';

/**
 * Who is pushing. Minted by `authorizeGitProxy`, which is the only place that
 * knows which class of credential authenticated the request — before this type
 * existed it collapsed that knowledge into `{ ok: true }` and threw the rest
 * away, which is why no ref rule could be written.
 */
export type GitPrincipal =
  /** A session's sandbox token, or an account token scoped to that session. */
  | { kind: 'session'; sessionId: string; branch: string }
  /** A monitor box's sandbox token — no session row by design. */
  | { kind: 'monitor' }
  /** A human credential: account API key, CLI PAT, dashboard. */
  | { kind: 'user'; userId: string | null }
  /** Server-side Kortix machinery. Never reaches the proxy today. */
  | { kind: 'internal' };

export interface RefPolicyContext {
  /** The project's default branch, e.g. `main`. */
  defaultBranch: string;
}

/** One refused ref update, carrying the reason git will print to the user. */
export interface RefDenial {
  ref: string;
  reason: string;
}

const HEADS_PREFIX = 'refs/heads/';

/**
 * Evaluate every ref update in one push. Returns a denial per refused ref;
 * an empty array means the whole push is allowed.
 *
 * A push is all-or-nothing at the call site: if ANY ref is denied the proxy
 * refuses the request outright rather than forwarding a subset, because the
 * pack is a single stream and splitting it is not possible.
 */
export function evaluateRefUpdates(
  principal: GitPrincipal,
  ctx: RefPolicyContext,
  updates: RefUpdate[],
): RefDenial[] {
  const denials: RefDenial[] = [];
  for (const update of updates) {
    const reason = denyReason(principal, ctx, update);
    if (reason) denials.push({ ref: update.ref, reason });
  }
  return denials;
}

function denyReason(
  principal: GitPrincipal,
  ctx: RefPolicyContext,
  update: RefUpdate,
): string | null {
  switch (principal.kind) {
    case 'internal':
      return null;

    case 'monitor':
      return 'monitor sandboxes have read-only repository access';

    case 'session': {
      const own = `${HEADS_PREFIX}${principal.branch}`;
      if (update.ref !== own) {
        return (
          `a session may only push its own branch (${principal.branch}); ` +
          'commit there and open a change request to land this elsewhere'
        );
      }
      if (isDelete(update)) {
        // The session branch is the head of any change request opened from this
        // session; deleting it strands the CR with an unresolvable head.
        return 'a session may not delete its own branch';
      }
      return null;
    }

    case 'user': {
      if (update.ref === `${HEADS_PREFIX}${ctx.defaultBranch}` && isDelete(update)) {
        return `${ctx.defaultBranch} is the default branch and cannot be deleted`;
      }
      return null;
    }
  }
}

/**
 * Short, stable label for logs and audit rows. Never includes the branch name,
 * which can carry user content.
 */
export function principalLabel(principal: GitPrincipal): string {
  switch (principal.kind) {
    case 'session':
      return `session:${principal.sessionId}`;
    case 'monitor':
      return 'monitor';
    case 'user':
      return principal.userId ? `user:${principal.userId}` : 'user';
    case 'internal':
      return 'internal';
  }
}
