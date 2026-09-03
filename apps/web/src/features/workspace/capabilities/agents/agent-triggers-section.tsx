'use client';

/**
 * The Triggers section of the agent page — every project trigger that starts
 * THIS agent, and the way to add one.
 *
 * A trigger is a project resource that names an agent (`trigger.agent`, the
 * manifest key). The Triggers tab lists them all; this section is the same
 * list filtered to one agent, because "when does this agent run on its own?"
 * is a question about the agent, and the person configuring one should not
 * have to leave its page to answer it. Creating one here opens the same
 * wizard the Triggers tab opens, with the agent pre-selected.
 *
 * Rows link to the Triggers tab rather than opening the detail sheet here:
 * the sheet is a 1,000-line component with its own mutations, and a second
 * mount of it would mean a second code path for pause, run and delete.
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { successToast } from '@/components/ui/toast';
import { ScheduleCreateModal } from '@/components/projects/schedule/schedule-create-modal';
import {
  describeWhen,
  triggerName,
} from '@/components/projects/schedule/schedule-copy';
import { EditorSection } from '@/features/workspace/customize/sections/view/agent-editor-primitives';
import { capabilityTabHref } from '@/features/workspace/capabilities/shared/capability-tab-routes';
import { PROJECT_ACTIONS } from '@/lib/project-actions';
import { useProjectCan } from '@/lib/use-project-can';
import { cn } from '@/lib/utils';
import { listProjectTriggers, type ProjectTrigger } from '@kortix/sdk';
import { contract, qk } from '@kortix/sdk/react';
import { PlusIcon, PulseIcon, TimerIcon, WebhooksLogoIcon, type Icon } from '@phosphor-icons/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';

const KIND_ICON: Record<ProjectTrigger['type'], Icon> = {
  cron: TimerIcon,
  webhook: WebhooksLogoIcon,
  monitor: PulseIcon,
};

/**
 * Whether `trigger` starts `agentName`. A trigger that names no agent is
 * stored as `default` (the manifest sentinel, `apps/api/src/projects/lib/
 * triggers.ts`), which means "the project's default agent" — so the default
 * agent's page owns those rows too, or a trigger created with the agent left
 * on its default would show up nowhere.
 */
export function triggerStartsAgent(
  trigger: Pick<ProjectTrigger, 'agent'>,
  agentName: string,
  defaultAgent: string | null | undefined,
): boolean {
  if (trigger.agent === agentName) return true;
  return trigger.agent === 'default' && !!defaultAgent && defaultAgent === agentName;
}

/** The triggers that start `agentName`, in the order the API lists them. */
export function triggersForAgent(
  triggers: readonly ProjectTrigger[],
  agentName: string,
  defaultAgent: string | null | undefined = null,
): ProjectTrigger[] {
  return triggers.filter((trigger) => triggerStartsAgent(trigger, agentName, defaultAgent));
}

export function AgentTriggersSection({
  projectId,
  agentName,
  defaultAgent,
}: {
  projectId: string;
  agentName: string;
  /** The project's default agent name — see `triggerStartsAgent`. */
  defaultAgent?: string | null;
}) {
  const queryClient = useQueryClient();
  const canCreate =
    useProjectCan(projectId, PROJECT_ACTIONS.PROJECT_TRIGGER_CREATE).allowed === true;
  const [createOpen, setCreateOpen] = useState(false);

  // Same key and fetcher as the Triggers tab, so a trigger created there shows
  // here on the next focus without a second cache to reconcile.
  const triggersQuery = useQuery({
    queryKey: qk.project.triggers(projectId),
    queryFn: () => listProjectTriggers(projectId),
    ...contract('config'),
  });
  const mine = useMemo(
    () => triggersForAgent(triggersQuery.data?.triggers ?? [], agentName, defaultAgent),
    [triggersQuery.data, agentName, defaultAgent],
  );

  return (
    <EditorSection title="Triggers" description="When this agent starts on its own.">
      <div className="space-y-3 py-3.5">
        {triggersQuery.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-11 w-full rounded-md" />
            <Skeleton className="h-11 w-full rounded-md" />
          </div>
        ) : mine.length === 0 ? (
          <p className="text-muted-foreground text-xs text-pretty">
            Nothing starts this agent automatically yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {mine.map((trigger) => {
              const KindIcon = KIND_ICON[trigger.type] ?? TimerIcon;
              return (
                <li key={trigger.slug}>
                  <Link
                    href={capabilityTabHref(projectId, 'triggers')}
                    className={cn(
                      'group bg-popover flex items-center gap-3 rounded-md border px-3 py-2',
                      'hover:border-border transition-[background-color,border-color] hover:bg-accent',
                      'focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-sm',
                        trigger.enabled ? 'bg-kortix-green/15' : 'bg-muted',
                      )}
                    >
                      <KindIcon
                        weight="fill"
                        className={cn(
                          'size-4',
                          trigger.enabled ? 'text-kortix-green' : 'text-muted-foreground',
                        )}
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="text-foreground block truncate text-sm font-medium">
                        {triggerName(trigger)}
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {describeWhen(trigger)}
                      </span>
                    </span>
                    {!trigger.enabled ? (
                      <Badge variant="muted" size="xs">
                        Paused
                      </Badge>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {canCreate ? (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setCreateOpen(true)}
          >
            <PlusIcon className="size-3.5 shrink-0" />
            Add trigger
          </Button>
        ) : null}
      </div>

      {canCreate ? (
        <ScheduleCreateModal
          projectId={projectId}
          open={createOpen}
          onOpenChange={setCreateOpen}
          initialAgent={agentName}
          onCreated={() => {
            void queryClient.invalidateQueries({ queryKey: qk.project.triggers(projectId) });
            successToast('Trigger created');
          }}
        />
      ) : null}
    </EditorSection>
  );
}
