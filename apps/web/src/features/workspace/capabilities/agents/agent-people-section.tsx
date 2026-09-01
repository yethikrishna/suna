'use client';

/**
 * Who may use this agent — the members and groups holding a resource grant
 * on it. This is THE access path in Kortix: a project manager grants a person
 * an agent, never a skill or a secret directly (`object_policies` marks
 * `agent` closed and everything else open — `apps/api/src/iam/authorize.ts`),
 * and the person inherits the agent's connectors and secrets through it.
 * That is why the agent is the object Customize is built around, and why
 * this section sits on the agent's own page.
 *
 * Grants are managed in the account's Access hub, which owns the roster,
 * the roles and the grant dialog. This section is the agent-side mirror plus
 * the one link there — the same destination the tab bar's "Members" link
 * opens, with `from=customize` so the hub's back link returns here.
 *
 * Gated on `project.members.manage`, the leaf the grants endpoint asserts.
 * Someone without it sees nothing rather than a section that 403s.
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EditorSection } from '@/features/workspace/customize/sections/view/agent-editor-primitives';
import { PROJECT_ACTIONS } from '@/lib/project-actions';
import { useProjectCan } from '@/lib/use-project-can';
import { listProjectResourceGrants, type ProjectResourceGrant } from '@kortix/sdk';
import { contract, qk, useProjectAccountId } from '@kortix/sdk/react';
import { ArrowUpRightIcon, UserIcon, UsersIcon } from '@phosphor-icons/react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

/** The grants that name `agentName`. Orphaned rows (agent renamed) are kept —
 *  they are inert, and hiding them would hide the thing to clean up. */
export function grantsForAgent(
  grants: readonly ProjectResourceGrant[],
  agentName: string,
): ProjectResourceGrant[] {
  return grants.filter((g) => g.resource_type === 'agent' && g.resource_id === agentName);
}

/** Where a project's access is managed, opened on this project. */
export function accessHubHref(accountId: string, projectId: string): string {
  return `/accounts/${accountId}?tab=access-projects&project=${projectId}&from=customize`;
}

export function AgentPeopleSection({
  projectId,
  agentName,
}: {
  projectId: string;
  agentName: string;
}) {
  const canManage =
    useProjectCan(projectId, PROJECT_ACTIONS.PROJECT_MEMBERS_MANAGE).allowed === true;
  const accountId = useProjectAccountId(projectId);
  const grantsQuery = useQuery({
    queryKey: qk.project.resourceGrants(projectId),
    queryFn: () => listProjectResourceGrants(projectId),
    enabled: canManage,
    retry: false,
    ...contract('inventory'),
  });
  if (!canManage) return null;

  const assigned = grantsForAgent(grantsQuery.data?.grants ?? [], agentName);

  return (
    <EditorSection
      title="Who can use it"
      description="Members and groups granted this agent. They inherit its connectors and secrets as their own."
    >
      <div className="space-y-3 py-3.5">
        {grantsQuery.isLoading ? (
          <div className="flex flex-wrap gap-1.5">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-5 w-32 rounded-full" />
          </div>
        ) : assigned.length === 0 ? (
          <p className="text-muted-foreground text-xs text-pretty">
            No one is granted this agent yet. Project managers can always use it.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {assigned.map((g) => (
              <Badge key={g.grant_id} variant="outline" size="xs" className="gap-1 font-medium">
                {g.principal_type === 'group' ? (
                  <UsersIcon className="size-3 shrink-0" />
                ) : (
                  <UserIcon className="size-3 shrink-0" />
                )}
                {g.principal_label}
              </Badge>
            ))}
          </div>
        )}
        {accountId ? (
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href={accessHubHref(accountId, projectId)} prefetch>
              Manage access
              <ArrowUpRightIcon className="size-3 opacity-60" aria-hidden />
            </Link>
          </Button>
        ) : null}
      </div>
    </EditorSection>
  );
}
