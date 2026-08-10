const SAFE_GIT_REF = /^(?!-)(?!.*\.\.)(?!.*@\{)[A-Za-z0-9][A-Za-z0-9._/-]*$/;

export function normalizeAgentGitBaseRef(baseRef: string | null | undefined): string {
  const candidate = baseRef?.trim() || 'main';
  if (candidate.startsWith('refs/heads/')) return 'main';
  return SAFE_GIT_REF.test(candidate) ? candidate : 'main';
}

export function buildAgentGitReconciliationPrompt(baseRef: string | null | undefined): string {
  const safeBaseRef = normalizeAgentGitBaseRef(baseRef);

  return `Synchronize this session branch with the latest \`origin/${safeBaseRef}\`, resolve any Git conflicts, verify the result, and reload the agent configuration.

Follow this contract:

1. Inspect the current branch, \`git status\`, configured remotes, and existing changes before modifying anything.
2. Preserve all current work, including committed, uncommitted, and untracked files. Do not use destructive Git commands or discard either side of a conflict wholesale.
3. Fetch \`origin/${safeBaseRef}\`. Integrate it into the current session branch without rewriting published history. Use a merge unless this repository explicitly requires another non-destructive method.
4. Resolve every conflict semantically. Read both sides and keep the intended behavior from this session and the base branch. Do not select "ours" or "theirs" for all files.
5. Confirm that \`git diff --diff-filter=U --name-only\` returns no files. Review the final diff for conflict markers and accidental deletions.
6. Run the relevant tests for every changed area. Fix failures caused by the reconciliation.
7. Commit the completed reconciliation on the current session branch with a clear message. Do not open or merge a change request unless I ask.
8. Before the final command, summarize the resolution and warn me that the runtime reload ends this turn. Tell me to send "continue" after the runtime returns.
9. As the final action, run exactly:

\`kortix sessions reload "$KORTIX_SESSION_ID" --project "$KORTIX_PROJECT_ID" --no-repo --force --yes\`

The final command must remain last. It reloads the already-reconciled files and replaces the agent runtime. Do not run more commands after it.`;
}
