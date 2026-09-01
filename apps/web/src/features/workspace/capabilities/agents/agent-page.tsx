'use client';

/**
 * /projects/[id]/agent/[name] — one agent, as a page. The core screen of
 * Customize.
 *
 * Customize is agent-centric (Marko, 2026-09-01): the agent is the only
 * object a project manager grants a person or a group, so every other
 * decision — which model, which skills, which connectors and secrets, when it
 * runs, who may use it — hangs off it. This page puts all of them on one
 * routed screen, laid out the way an agent is read:
 *
 *   ┌ Agents › name                       [Start session] [⋯] ┐
 *   │ ● Name  chips                                            │
 *   ├──────────────────────────────┬───────────────────────────┤
 *   │ Description                  │ Model                     │
 *   │ Instructions                 │ Triggers                  │
 *   │  (the system prompt, the     │ Access (skills, connectors│
 *   │   whole column — it IS the   │   secrets, project actions│
 *   │   agent)                     │ Who can use it            │
 *   │                              │ Workspace · Tools · Basics│
 *   └──────────────────────────────┴───────────────────────────┘
 *     Unsaved changes · commits to the repo    [Discard] [Save]
 *
 * Two bodies behind one header:
 *
 *  - **Editable** — a v2 (kortix.yaml) project and a caller with
 *    `project.agent.write`. Every field is live; Save round-trips the whole
 *    `agents.<name>` block through the agent-config route, which commits it to
 *    the project repo. State lives in `useAgentDraft`; the right column is
 *    `AgentConfigSections` with the page's own Triggers and People sections
 *    slotted in.
 *  - **Read-only** — a v1 project, or a caller without write. The left column
 *    shows the agent's source file; the right column keeps the two v1 cards
 *    (`AgentModel`, `AgentScope`) plus Triggers and People, and a v1 project
 *    gets the upgrade hint. We degrade, never blank.
 *
 * The page is keyed on the agent name by its route, so switching agents
 * remounts every draft rather than carrying one agent's edits onto another.
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { InfoBanner } from '@/components/ui/info-banner';
import { Label } from '@/components/ui/label';
import Loading from '@/components/ui/loading';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { errorToast, successToast } from '@/components/ui/toast';
import { HighlightedCode } from '@/components/markdown/code';
import { MarkdownWithFrontmatter } from '@/components/markdown/markdown-frontmatter';
import { EmptyState } from '@/features/layout/section/empty-state';
import { ErrorState } from '@/features/layout/section/error-state';
import { configEntitySourcePath } from '@/features/workspace/customize/sections/component/config-entity-source-path';
import {
  AgentConfigSections,
  THEME_COLOR_SWATCH,
  THEME_COLORS,
  useAgentDraft,
  useAgentEditorOptions,
} from '@/features/workspace/customize/sections/view/agent-editor';
import { formatMode, toArray } from '@/features/workspace/customize/shared/utils';
import {
  editConfigPrompt,
  useConfigureThread,
} from '@/features/workspace/customize/use-configure-thread';
import { useAgentConfig, useUpdateAgentConfig } from '@/hooks/projects/use-agent-config';
import { useNewProjectSession } from '@/hooks/projects/use-new-project-session';
import { PROJECT_ACTIONS } from '@/lib/project-actions';
import { useProjectCan } from '@/lib/use-project-can';
import { cn } from '@/lib/utils';
import {
  type AgentConfigBlock,
  getProjectDetail,
  type ProjectConfigSummary,
  readProjectFile,
  updateProjectDefaultAgent,
} from '@kortix/sdk';
import { contract, qk, useProjectAccountId } from '@kortix/sdk/react';
import { capitalizeWords } from '@kortix/shared';
import {
  CaretRightIcon,
  DotsThreeIcon,
  PlayIcon,
  RobotIcon,
  StarIcon,
} from '@phosphor-icons/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, m } from 'motion/react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { capabilityTabHref } from '@/features/workspace/capabilities/shared/capability-tab-routes';
import { isMarkdownPath, languageForPath } from '@/features/workspace/capabilities/shared/entity/entity-files';

import { AgentModel, AgentScope } from './agent-detail-aside';
import { AgentPeopleSection } from './agent-people-section';
import { AgentTriggersSection } from './agent-triggers-section';

type Agent = ProjectConfigSummary['agents'][number];

export function AgentPage({ projectId, agentName }: { projectId: string; agentName: string }) {
  // `accountId` skips useProjectCan's own getProject and lets the IAM probe
  // run on the first render instead of waiting a round-trip for it.
  const accountId = useProjectAccountId(projectId);
  const canWrite =
    useProjectCan(projectId, PROJECT_ACTIONS.PROJECT_AGENT_WRITE, { accountId }).allowed === true;

  const detailQuery = useQuery({
    queryKey: qk.project.detail(projectId),
    queryFn: () => getProjectDetail(projectId),
    ...contract('config'),
  });
  const config = detailQuery.data?.config ?? null;
  const agent = toArray(config?.agents).find((a) => a.name === agentName) ?? null;

  const configQuery = useAgentConfig(projectId, agent ? agentName : undefined);

  if (detailQuery.isLoading || (agent && configQuery.isLoading)) {
    return <AgentPageSkeleton />;
  }

  if (detailQuery.isError || !config) {
    return (
      <AgentPageFrame>
        <ErrorState
          size="sm"
          title="Couldn't load this project's agents"
          action={
            <Button variant="outline" size="sm" onClick={() => detailQuery.refetch()}>
              Retry
            </Button>
          }
        />
      </AgentPageFrame>
    );
  }

  if (!agent) {
    return (
      <AgentPageFrame>
        <EmptyState
          icon={RobotIcon}
          size="sm"
          title={`No agent named ${agentName}`}
          description="It may have been renamed or removed from the project's configuration."
          action={
            <Button asChild variant="outline" size="sm">
              <Link href={capabilityTabHref(projectId, 'agent')}>All agents</Link>
            </Button>
          }
        />
      </AgentPageFrame>
    );
  }

  const editable = canWrite && configQuery.data?.editable === true;
  const isV1 = configQuery.data !== undefined && configQuery.data.editable !== true;

  return editable ? (
    <EditableAgentPage
      projectId={projectId}
      agent={agent}
      config={config}
      initial={configQuery.data?.block ?? {}}
    />
  ) : (
    <ReadOnlyAgentPage
      projectId={projectId}
      agent={agent}
      config={config}
      canWrite={canWrite}
      showUpgradeHint={isV1}
      // A v1 project's block still carries the runtime colour, when it has one.
      color={configQuery.data?.block?.opencode?.color}
    />
  );
}

// ─── Frame ─────────────────────────────────────────────────────────────────

/**
 * The page's scroll container and column. `max-w-5xl` matches
 * `CapabilityPageShell`, so the Agents list and one agent's page share one
 * column width and the transition between them does not reflow the header.
 */
function AgentPageFrame({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-4 pt-8 pb-24 lg:pt-10">{children}</div>
      {footer}
    </div>
  );
}

function AgentPageSkeleton() {
  return (
    <AgentPageFrame>
      <div className="space-y-3">
        <Skeleton className="h-4 w-32 rounded-sm" />
        <Skeleton className="h-8 w-64 rounded-sm" />
      </div>
      <div className="mt-8 flex flex-col gap-10 lg:flex-row lg:gap-12">
        <div className="min-w-0 flex-1 space-y-6">
          <Skeleton className="h-11 w-full rounded-md" />
          <Skeleton className="h-80 w-full rounded-md" />
        </div>
        <div className="w-full shrink-0 space-y-6 lg:w-[22rem]">
          <Skeleton className="h-28 w-full rounded-md" />
          <Skeleton className="h-40 w-full rounded-md" />
          <Skeleton className="h-28 w-full rounded-md" />
        </div>
      </div>
    </AgentPageFrame>
  );
}

// ─── Header ────────────────────────────────────────────────────────────────

/** The agent's badge tint as a class (named theme colour) or a style (hex). */
function colorSwatch(color: string | undefined): { className?: string; style?: React.CSSProperties } {
  if (!color) return { className: 'bg-muted-foreground/40' };
  if ((THEME_COLORS as readonly string[]).includes(color)) {
    return { className: THEME_COLOR_SWATCH[color as (typeof THEME_COLORS)[number]] };
  }
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return { style: { backgroundColor: color } };
  return { className: 'bg-muted-foreground/40' };
}

/**
 * Breadcrumb, name, status chips, and the two actions every agent has: start
 * a session with it, and the overflow (default, edit source).
 *
 * "Start session" creates a session booted on THIS agent through the same
 * hook the sidebar's New session button uses — the same guard against double
 * clicks, the same billing gate, the same navigation. It is the page's
 * primary action because an agent exists to be run.
 */
function AgentHeader({
  projectId,
  agent,
  config,
  color,
  canWrite,
  children,
}: {
  projectId: string;
  agent: Agent;
  config: ProjectConfigSummary;
  color: string | undefined;
  canWrite: boolean;
  /** Rendered under the title — the read-only body passes the description. */
  children?: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const startSession = useNewProjectSession(projectId);
  const configure = useConfigureThread(projectId);
  const [confirmEditSource, setConfirmEditSource] = useState(false);
  const isDefault = config.open_code_default_agent === agent.name;
  const mode = agent.mode?.toLowerCase();
  const swatch = colorSwatch(color);

  const makeDefault = useMutation({
    mutationFn: () => updateProjectDefaultAgent(projectId, agent.name),
    onSuccess: async (result) => {
      successToast(`${capitalizeWords(result.default_agent)} is now the project default`);
      await queryClient.invalidateQueries({ queryKey: qk.project.detail(projectId) });
    },
    onError: (error: Error) => errorToast(error.message || 'Failed to update default agent'),
  });

  return (
    <header className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-sm">
          <Link
            href={capabilityTabHref(projectId, 'agent')}
            prefetch
            className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
          >
            Agents
          </Link>
          <CaretRightIcon aria-hidden className="text-muted-foreground/50 size-3.5 shrink-0" />
          <span className="text-foreground truncate font-medium">{capitalizeWords(agent.name)}</span>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            disabled={agent.enabled === false}
            onClick={() => startSession({ create: { agent_name: agent.name } })}
          >
            <PlayIcon weight="fill" className="size-3.5 shrink-0" />
            Start session
          </Button>
          {canWrite ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon-sm" aria-label="More actions">
                  <DotsThreeIcon className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={isDefault || agent.enabled === false || makeDefault.isPending}
                  onSelect={() => makeDefault.mutate()}
                >
                  <StarIcon className="size-4" />
                  {isDefault ? 'Project default' : 'Make project default'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={configure.pending}
                  onSelect={() => setConfirmEditSource(true)}
                >
                  Edit source in a chat
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="flex items-center gap-2.5">
            <span
              aria-hidden
              className={cn('size-3 shrink-0 rounded-full', swatch.className)}
              style={swatch.style}
            />
            <h1 className="text-foreground text-2xl font-semibold tracking-tight text-balance">
              {capitalizeWords(agent.name)}
            </h1>
          </span>
          <span className="flex items-center gap-1.5">
            {mode && mode !== 'primary' ? (
              <Badge variant="outline" size="sm" className="text-muted-foreground font-medium">
                {formatMode(agent.mode ?? '')}
              </Badge>
            ) : null}
            {isDefault ? (
              <Badge variant="outline" size="sm" className="text-muted-foreground gap-1 font-medium">
                <StarIcon weight="fill" className="text-kortix-orange size-3.5 shrink-0" />
                Default
              </Badge>
            ) : null}
            {agent.enabled === false ? (
              <Badge variant="muted" size="sm">
                Disabled
              </Badge>
            ) : null}
          </span>
        </div>
        {children}
      </div>

      {/* Sending a prompt opens a whole new chat, which is a bigger commitment
          than a menu row implies — confirm first, like the entity modal did. */}
      <ConfirmDialog
        open={confirmEditSource}
        onOpenChange={setConfirmEditSource}
        title="Edit this agent's source in a chat?"
        description={`This starts a new session that edits ${agent.name}'s source file for you.`}
        confirmLabel="Start chat"
        cancelLabel="Cancel"
        onConfirm={() => {
          setConfirmEditSource(false);
          configure.start(editConfigPrompt('agent', agent.name, agent.path));
        }}
      />
    </header>
  );
}

// ─── Editable body ─────────────────────────────────────────────────────────

function EditableAgentPage({
  projectId,
  agent,
  config,
  initial,
}: {
  projectId: string;
  agent: Agent;
  config: ProjectConfigSummary;
  initial: AgentConfigBlock;
}) {
  const editor = useAgentDraft(initial);
  const options = useAgentEditorOptions(projectId, initial);
  const update = useUpdateAgentConfig(projectId, agent.name);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const skillsOptions = toArray(config.skills).map((skill) => ({
    id: skill.name,
    label: skill.name,
  }));

  // A tab closed with edits in flight used to lose them silently. The browser
  // prompt is the only guard that reaches a close or a reload; in-app links
  // are covered by the Discard confirm below.
  useEffect(() => {
    if (!editor.isDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [editor.isDirty]);

  const onSave = async () => {
    try {
      const response = await update.mutateAsync(editor.draft);
      editor.commit(response.block ?? editor.draft);
      successToast(`${capitalizeWords(agent.name)} saved`);
    } catch (e) {
      errorToast((e as Error)?.message ?? 'Failed to save configuration');
    }
  };

  return (
    <AgentPageFrame
      footer={
        <SaveBar
          dirty={editor.isDirty}
          pending={update.isPending}
          onDiscard={() => setConfirmDiscard(true)}
          onSave={onSave}
        />
      }
    >
      <AgentHeader
        projectId={projectId}
        agent={agent}
        config={config}
        color={editor.oc.color}
        canWrite
      />

      <div className="mt-8 flex flex-col gap-10 lg:flex-row lg:gap-12">
        {/* Left — what the agent IS. The description is one line; the
            instructions are the whole column, because they are the agent. */}
        <div className="min-w-0 flex-1 space-y-8">
          <section className="space-y-2.5">
            <div className="space-y-1">
              <Label>Description</Label>
              <p className="text-muted-foreground text-xs leading-relaxed text-pretty">
                {editor.oc.mode === 'subagent'
                  ? 'Required. This is how other agents decide to call it.'
                  : 'One line on what this agent is for. Other agents read it when picking a subagent.'}
              </p>
            </div>
            <Textarea
              aria-label="Description"
              value={editor.oc.description ?? ''}
              placeholder="What this agent is for"
              minHeight={44}
              className="text-sm"
              onChange={(e) => editor.setOc('description', e.target.value)}
            />
          </section>

          <section className="space-y-2.5">
            <div className="space-y-1">
              <Label>Instructions</Label>
              <p className="text-muted-foreground text-xs leading-relaxed text-pretty">
                Told to this agent at the start of every session. Leave empty to use the default
                instructions.
              </p>
            </div>
            <Textarea
              aria-label="Instructions"
              value={editor.oc.prompt ?? ''}
              placeholder={'You are…\n\nGoal: …\n\nSteps:\n1. …'}
              minHeight={400}
              className="text-sm leading-relaxed"
              onChange={(e) => editor.setOc('prompt', e.target.value)}
            />
          </section>
        </div>

        {/* Right — everything the agent draws on and everyone who draws on it. */}
        <aside className="w-full shrink-0 lg:w-[22rem]">
          <AgentConfigSections
            editor={editor}
            options={options}
            skillsOptions={skillsOptions}
            triggers={<AgentTriggersSection projectId={projectId} agentName={agent.name} />}
            people={<AgentPeopleSection projectId={projectId} agentName={agent.name} />}
          />
        </aside>
      </div>

      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Discard your changes?"
        description={`${capitalizeWords(agent.name)} keeps its saved configuration. Anything you changed here is lost.`}
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        confirmVariant="destructive"
        onConfirm={() => {
          setConfirmDiscard(false);
          editor.discard();
        }}
      />
    </AgentPageFrame>
  );
}

/**
 * The save bar. Exists only while there is something to save — an always-on
 * disabled pair of buttons is chrome that never earns its row. Sticky to the
 * foot of the page's own scroll container, so it is reachable from any point
 * in a long instruction set without scrolling to the bottom.
 */
function SaveBar({
  dirty,
  pending,
  onDiscard,
  onSave,
}: {
  dirty: boolean;
  pending: boolean;
  onDiscard: () => void;
  onSave: () => void;
}) {
  return (
    <AnimatePresence initial={false}>
      {dirty ? (
        <m.div
          key="save-bar"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
          className="bg-background/95 sticky bottom-0 z-10 border-t shadow-sm backdrop-blur"
        >
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
            <p className="text-muted-foreground min-w-0 truncate text-xs">
              <span className="text-foreground font-medium">Unsaved changes.</span> Saving commits
              to your project repo.
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline-ghost" size="sm" onClick={onDiscard} disabled={pending}>
                Discard
              </Button>
              <Button size="sm" onClick={onSave} disabled={pending}>
                {pending ? <Loading className="size-3.5 shrink-0" /> : null}
                Save
              </Button>
            </div>
          </div>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}

// ─── Read-only body ────────────────────────────────────────────────────────

function ReadOnlyAgentPage({
  projectId,
  agent,
  config,
  canWrite,
  showUpgradeHint,
  color,
}: {
  projectId: string;
  agent: Agent;
  config: ProjectConfigSummary;
  canWrite: boolean;
  showUpgradeHint: boolean;
  color: string | undefined;
}) {
  // The real repo path, with any manifest anchor stripped. Agents declared in
  // the manifest rather than as their own file carry one
  // (`kortix.yaml#agents.<name>`), and reading that verbatim is a 404.
  const sourcePath = configEntitySourcePath(agent.path);
  const fileQuery = useQuery({
    queryKey: ['entity-file-content', projectId, sourcePath],
    queryFn: () => readProjectFile(projectId, sourcePath),
    staleTime: 30_000,
  });

  return (
    <AgentPageFrame>
      <AgentHeader projectId={projectId} agent={agent} config={config} color={color} canWrite={canWrite}>
        {agent.description ? (
          <p className="text-muted-foreground max-w-2xl text-sm text-pretty">{agent.description}</p>
        ) : null}
      </AgentHeader>

      <div className="mt-8 flex flex-col gap-10 lg:flex-row lg:gap-12">
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="space-y-1">
            <Label>Instructions</Label>
            <p className="text-muted-foreground text-xs">
              <span className="font-mono">{sourcePath}</span>
            </p>
          </div>
          <div className="bg-popover rounded-md border">
            {fileQuery.isLoading ? (
              <div className="space-y-2.5 p-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-10/12" />
                <Skeleton className="h-4 w-9/12" />
              </div>
            ) : fileQuery.isError ? (
              <div className="p-4">
                <ErrorState
                  size="sm"
                  title="Couldn't load the source"
                  description={
                    fileQuery.error instanceof Error
                      ? fileQuery.error.message
                      : 'You may not have permission to read this file.'
                  }
                  action={
                    <Button variant="outline" size="sm" onClick={() => fileQuery.refetch()}>
                      Retry
                    </Button>
                  }
                />
              </div>
            ) : isMarkdownPath(sourcePath) ? (
              <div className="p-4">
                <MarkdownWithFrontmatter content={fileQuery.data?.content ?? ''} />
              </div>
            ) : (
              <pre
                className={cn(
                  'overflow-x-auto p-4',
                  'text-foreground font-mono text-sm leading-[1.65]',
                  '[&_code]:border-none [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-inherit',
                  '[&_.shiki]:!bg-transparent [&_span]:border-none [&_span]:!bg-transparent [&_span]:outline-none',
                )}
              >
                <HighlightedCode
                  code={fileQuery.data?.content ?? ''}
                  language={languageForPath(sourcePath)}
                />
              </pre>
            )}
          </div>
        </div>

        <aside className="w-full shrink-0 space-y-6 lg:w-[22rem]">
          {showUpgradeHint ? (
            <InfoBanner tone="info" title="Upgrade for the full agent editor">
              This project uses a v1 manifest. Migrate to{' '}
              <span className="font-mono">kortix.yaml</span> (kortix_version 2) to edit this
              agent's instructions, model, tool permissions and access here.
            </InfoBanner>
          ) : null}
          <AgentModel projectId={projectId} agentName={agent.name} />
          <AgentScope projectId={projectId} agentName={agent.name} scope={agent.scope} />
          <div className="space-y-8">
            <AgentTriggersSection projectId={projectId} agentName={agent.name} />
            <AgentPeopleSection projectId={projectId} agentName={agent.name} />
          </div>
        </aside>
      </div>
    </AgentPageFrame>
  );
}
