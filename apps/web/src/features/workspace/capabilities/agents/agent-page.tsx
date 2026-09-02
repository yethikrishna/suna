'use client';

/**
 * /projects/[id]/agent/[name] — one agent, as a page. The core screen of
 * Customize.
 *
 * Customize is agent-centric (Marko, 2026-09-01): the agent is the only
 * object a project manager grants a person or a group, so every other
 * decision — which model, which skills, which connectors and secrets, when it
 * runs, who may use it — hangs off it. This page puts all of them on one
 * routed screen, laid out as a DOCUMENT with a CONFIGURATION PANE:
 *
 *   ┌ Agents › name          [Start session] [⋯] ┃ Configuration            ┐
 *   │ ◼ Name  chips                               ┃ Model Triggers Access … │
 *   │                                             ┠─────────────────────────┤
 *   │ Description                                 ┃ Model                   │
 *   │ Instructions            [Edit | Preview]    ┃ Triggers                │
 *   │  (the system prompt — the whole column,     ┃ Access                  │
 *   │   because it IS the agent)                  ┃ Who can use it          │
 *   │                                             ┃ Workspace · Tools · …   │
 *   ├─────────────────────────────────────────────┸─────────────────────────┤
 *   │ Unsaved changes · commits to the repo             [Discard] [Save ⌘S] │
 *   └───────────────────────────────────────────────────────────────────────┘
 *
 * ## How it scrolls
 *
 * On `lg` the two columns are two SCROLLERS. The document scrolls on the
 * left; the pane scrolls on the right, under its own header, so the model
 * picker and the grants stay reachable however long the instructions run —
 * the same shape as the reference (a document with a fixed "Overview" pane).
 * Below `lg` there is one scroller and the pane follows the document.
 *
 * Scrolling the document past its header condenses it: a compact bar with the
 * avatar, the name and the same two actions slides in at the top of the
 * document scroller, so "which agent" and "start it" never leave the screen.
 * The pane's header carries a jump bar over its sections with a scroll spy,
 * so a long pane reads as a table of contents rather than a wall.
 *
 * The save bar is OUTSIDE both scrollers, across the foot of the page. It
 * exists only while the draft is dirty.
 *
 * Two bodies behind one header:
 *
 *  - **Editable** — a v2 (kortix.yaml) project and a caller with
 *    `project.agent.write`. Every field is live; Save round-trips the whole
 *    `agents.<name>` block through the agent-config route, which commits it to
 *    the project repo. State lives in `useAgentDraft`; the pane is
 *    `AgentConfigSections` with the page's own Triggers and People sections
 *    slotted in.
 *  - **Read-only** — a v1 project, or a caller without write. The document is
 *    the agent's source file; the pane keeps the two v1 cards (`AgentModel`,
 *    `AgentScope`) plus Triggers and People, and a v1 project gets the
 *    upgrade hint. We degrade, never blank.
 *
 * The page is keyed on the agent name by its route, so switching agents
 * remounts every draft rather than carrying one agent's edits onto another.
 */

import { AgentAvatar } from '@/components/ui/agent-avatar';
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
import Hint from '@/components/ui/hint';
import { InfoBanner } from '@/components/ui/info-banner';
import { Kbd } from '@/components/ui/kbd';
import { Label } from '@/components/ui/label';
import Loading from '@/components/ui/loading';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { errorToast, successToast } from '@/components/ui/toast';
import { HighlightedCode } from '@/components/markdown/code';
import { MarkdownWithFrontmatter } from '@/components/markdown/markdown-frontmatter';
import { EmptyState } from '@/features/layout/section/empty-state';
import { ErrorState } from '@/features/layout/section/error-state';
import { configEntitySourcePath } from '@/features/workspace/customize/sections/component/config-entity-source-path';
import {
  AGENT_CONFIG_SECTIONS,
  AgentConfigSections,
  type AgentConfigSectionKey,
  agentConfigSectionId,
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
import { useRouter } from 'next/navigation';
import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { capabilityTabHref } from '@/features/workspace/capabilities/shared/capability-tab-routes';
import { isMarkdownPath, languageForPath } from '@/features/workspace/capabilities/shared/entity/entity-files';

import { AgentModel, AgentScope } from './agent-detail-aside';
import { AgentPeopleSection } from './agent-people-section';
import { AgentTriggersSection } from './agent-triggers-section';

type Agent = ProjectConfigSummary['agents'][number];

/** The pane's width on `lg`. One constant, because the pane, the skeleton
 *  and the compact bar's right edge all have to agree on it. */
const PANE_WIDTH = 'lg:w-[26rem]';

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
      <CenteredState>
        <ErrorState
          size="sm"
          title="Couldn't load this project's agents"
          action={
            <Button variant="outline" size="sm" onClick={() => detailQuery.refetch()}>
              Retry
            </Button>
          }
        />
      </CenteredState>
    );
  }

  if (!agent) {
    return (
      <CenteredState>
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
      </CenteredState>
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
    />
  );
}

// ─── Frame ─────────────────────────────────────────────────────────────────

/**
 * The two-scroller frame. `document` is the left column's content, `pane`
 * the right column's; `paneHeader` sits above the pane's own scroller and
 * `footer` spans the foot of the whole page (the save bar).
 *
 * Below `lg` the frame's body is the one scroller and the pane follows the
 * document as a normal block. On `lg` the body stops scrolling
 * (`lg:overflow-hidden`) and each column scrolls itself.
 */
function AgentPageFrame({
  document: doc,
  pane,
  paneHeader,
  footer,
  documentRef,
  paneRef,
}: {
  document: ReactNode;
  pane: ReactNode;
  paneHeader?: ReactNode;
  footer?: ReactNode;
  documentRef?: RefObject<HTMLDivElement | null>;
  paneRef?: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto lg:flex lg:overflow-hidden">
        <div
          ref={documentRef}
          className="relative min-w-0 flex-1 lg:min-h-0 lg:overflow-y-auto"
        >
          {doc}
        </div>
        <aside
          className={cn(
            'border-border/60 flex w-full shrink-0 flex-col border-t',
            'lg:min-h-0 lg:border-t-0 lg:border-l',
            PANE_WIDTH,
          )}
        >
          {paneHeader}
          <div ref={paneRef} className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            <div className="px-5 py-5 pb-24 lg:pb-16">{pane}</div>
          </div>
        </aside>
      </div>
      {footer}
    </div>
  );
}

/** The document column's own padding and measure. */
function DocumentColumn({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-3xl px-6 pt-6 pb-24 lg:px-10 lg:pt-8">{children}</div>;
}

function CenteredState({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-6 py-16">{children}</div>
    </div>
  );
}

function AgentPageSkeleton() {
  return (
    <AgentPageFrame
      document={
        <DocumentColumn>
          <div className="space-y-4">
            <Skeleton className="h-4 w-32 rounded-sm" />
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-md" />
              <Skeleton className="h-8 w-56 rounded-sm" />
            </div>
          </div>
          <div className="mt-8 space-y-6">
            <Skeleton className="h-11 w-full rounded-md" />
            <Skeleton className="h-96 w-full rounded-md" />
          </div>
        </DocumentColumn>
      }
      paneHeader={
        <div className="border-border/60 border-b px-5 py-3">
          <Skeleton className="h-4 w-28 rounded-sm" />
        </div>
      }
      pane={
        <div className="space-y-6">
          <Skeleton className="h-28 w-full rounded-md" />
          <Skeleton className="h-40 w-full rounded-md" />
          <Skeleton className="h-28 w-full rounded-md" />
        </div>
      }
    />
  );
}

// ─── Header ────────────────────────────────────────────────────────────────

/**
 * The two actions every agent has, shared by the full header and the
 * compact bar so the two cannot offer different things.
 *
 * "Start session" creates a session booted on THIS agent through the same
 * hook the sidebar's New session button uses — the same guard against double
 * clicks, the same billing gate, the same navigation. It is the page's
 * primary action because an agent exists to be run. A subagent is called by
 * other agents, never picked for a session — the composer hides it — so the
 * button is disabled with the reason, not offered.
 */
function AgentActions({
  projectId,
  agent,
  config,
  canWrite,
}: {
  projectId: string;
  agent: Agent;
  config: ProjectConfigSummary;
  canWrite: boolean;
}) {
  const queryClient = useQueryClient();
  const startSession = useNewProjectSession(projectId);
  const configure = useConfigureThread(projectId);
  const [confirmEditSource, setConfirmEditSource] = useState(false);
  const isDefault = config.open_code_default_agent === agent.name;
  const mode = agent.mode?.toLowerCase();
  const startBlocked =
    agent.enabled === false
      ? 'This agent is disabled.'
      : mode === 'subagent'
        ? 'Subagents are called by other agents, not started directly.'
        : null;

  const makeDefault = useMutation({
    mutationFn: () => updateProjectDefaultAgent(projectId, agent.name),
    onSuccess: async (result) => {
      successToast(`${capitalizeWords(result.default_agent)} is now the project default`);
      await queryClient.invalidateQueries({ queryKey: qk.project.detail(projectId) });
    },
    onError: (error: Error) => errorToast(error.message || 'Failed to update default agent'),
  });

  return (
    <div className="flex shrink-0 items-center gap-2">
      {startBlocked ? (
        <Hint label={startBlocked}>
          {/* A span, so the tooltip still fires over a disabled button. */}
          <span className="inline-flex">
            <Button size="sm" disabled>
              <PlayIcon weight="fill" className="size-3.5 shrink-0" />
              Start session
            </Button>
          </span>
        </Hint>
      ) : (
        <Button size="sm" onClick={() => startSession({ create: { agent_name: agent.name } })}>
          <PlayIcon weight="fill" className="size-3.5 shrink-0" />
          Start session
        </Button>
      )}
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
            <DropdownMenuItem disabled={configure.pending} onSelect={() => setConfirmEditSource(true)}>
              Edit source in a chat
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

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
    </div>
  );
}

/** The status chips beside the name. Only states worth flagging. */
function AgentChips({ agent, config, size }: { agent: Agent; config: ProjectConfigSummary; size: 'sm' | 'xs' }) {
  const mode = agent.mode?.toLowerCase();
  const isDefault = config.open_code_default_agent === agent.name;
  return (
    <span className="flex items-center gap-1.5">
      {mode && mode !== 'primary' ? (
        <Badge variant="outline" size={size} className="text-muted-foreground font-medium">
          {formatMode(agent.mode ?? '')}
        </Badge>
      ) : null}
      {isDefault ? (
        <Badge variant="outline" size={size} className="text-muted-foreground gap-1 font-medium">
          <StarIcon weight="fill" className="text-kortix-orange size-3 shrink-0" />
          Default
        </Badge>
      ) : null}
      {agent.enabled === false ? (
        <Badge variant="muted" size={size}>
          Disabled
        </Badge>
      ) : null}
    </span>
  );
}

/**
 * Breadcrumb, avatar, name, chips, actions — the full header at the top of
 * the document. `children` is rendered under the title; the read-only body
 * passes the description there.
 */
function AgentHeader({
  projectId,
  agent,
  config,
  canWrite,
  children,
}: {
  projectId: string;
  agent: Agent;
  config: ProjectConfigSummary;
  canWrite: boolean;
  children?: ReactNode;
}) {
  const isDefault = config.open_code_default_agent === agent.name;
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
        <AgentActions projectId={projectId} agent={agent} config={config} canWrite={canWrite} />
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="flex items-center gap-3">
            {/* The same tile the session list and the composer draw for this
                agent, so the page is recognisably the thing you picked there. */}
            <AgentAvatar agentName={agent.name} isDefault={isDefault} size={40} />
            <h1 className="text-foreground text-2xl font-semibold tracking-tight text-balance">
              {capitalizeWords(agent.name)}
            </h1>
          </span>
          <AgentChips agent={agent} config={config} size="sm" />
        </div>
        {children}
      </div>
    </header>
  );
}

/**
 * The condensed header. Lives at the top of the document scroller as a
 * zero-height sticky slot, so it costs no layout while hidden and overlays
 * the document while shown. It appears once the full header has scrolled
 * out (`visible`), with the same avatar, name and actions — not a second set.
 */
function CompactBar({
  visible,
  projectId,
  agent,
  config,
  canWrite,
}: {
  visible: boolean;
  projectId: string;
  agent: Agent;
  config: ProjectConfigSummary;
  canWrite: boolean;
}) {
  const isDefault = config.open_code_default_agent === agent.name;
  return (
    <div className="sticky top-0 z-10 h-0">
      <AnimatePresence initial={false}>
        {visible ? (
          <m.div
            key="compact"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', duration: 0.28, bounce: 0 }}
            className="bg-background/90 border-border/60 absolute inset-x-0 top-0 border-b shadow-sm backdrop-blur"
          >
            <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-6 py-2 lg:px-10">
              <span className="flex min-w-0 items-center gap-2.5">
                <AgentAvatar agentName={agent.name} isDefault={isDefault} size={24} />
                <span className="text-foreground truncate text-sm font-medium">
                  {capitalizeWords(agent.name)}
                </span>
                <AgentChips agent={agent} config={config} size="xs" />
              </span>
              <AgentActions projectId={projectId} agent={agent} config={config} canWrite={canWrite} />
            </div>
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/**
 * Whether a scroller has scrolled past `threshold`. Listens on the element
 * itself, so it works for whichever box is scrolling at the current
 * breakpoint — below `lg` that is the frame's body, not the document column,
 * so the hook listens on both and reports the deeper of the two.
 */
function useScrolledPast(refs: RefObject<HTMLDivElement | null>[], threshold: number): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const nodes = refs.map((r) => r.current).filter((n): n is HTMLDivElement => n !== null);
    // The frame's body is the document column's parent; it scrolls below `lg`.
    const bodies = nodes.map((n) => n.parentElement).filter((n): n is HTMLElement => n !== null);
    const targets = [...nodes, ...bodies];
    let raf = 0;
    const measure = () => {
      raf = 0;
      setScrolled(targets.some((t) => t.scrollTop > threshold));
    };
    const onScroll = () => {
      if (raf === 0) raf = requestAnimationFrame(measure);
    };
    for (const t of targets) t.addEventListener('scroll', onScroll, { passive: true });
    measure();
    return () => {
      for (const t of targets) t.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [refs, threshold]);
  return scrolled;
}

// ─── Pane header: jump bar ─────────────────────────────────────────────────

/**
 * "Configuration" and a row of section chips. The active chip follows the
 * pane's scroll (a spy over `[data-agent-section]`), and a click scrolls the
 * section's anchor into view. `keys` is whatever the pane actually rendered,
 * so a slot the page left empty never gets a dead chip.
 */
function PaneHeader({
  paneRef,
  keys,
}: {
  paneRef: RefObject<HTMLDivElement | null>;
  keys: readonly AgentConfigSectionKey[];
}) {
  const [active, setActive] = useState<AgentConfigSectionKey | null>(keys[0] ?? null);

  useEffect(() => {
    const root = paneRef.current;
    if (!root) return;
    const sections = [...root.querySelectorAll<HTMLElement>('[data-agent-section]')];
    if (sections.length === 0) return;
    let raf = 0;
    const measure = () => {
      raf = 0;
      // The section whose top is nearest the pane's top edge, allowing for
      // the anchor's own scroll margin. The last one wins once the pane is
      // scrolled to its end, so the final chip can actually light up.
      const top = root.getBoundingClientRect().top + 24;
      let current: string | null = null;
      for (const el of sections) {
        if (el.getBoundingClientRect().top <= top) current = el.dataset.agentSection ?? null;
      }
      const atEnd = root.scrollTop + root.clientHeight >= root.scrollHeight - 2;
      if (atEnd) current = sections[sections.length - 1].dataset.agentSection ?? current;
      setActive((current ?? sections[0].dataset.agentSection ?? null) as AgentConfigSectionKey | null);
    };
    const onScroll = () => {
      if (raf === 0) raf = requestAnimationFrame(measure);
    };
    root.addEventListener('scroll', onScroll, { passive: true });
    measure();
    return () => {
      root.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [paneRef, keys]);

  const jump = (key: AgentConfigSectionKey) => {
    const el = paneRef.current?.querySelector<HTMLElement>(`#${agentConfigSectionId(key)}`);
    el?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    setActive(key);
  };

  const chips = AGENT_CONFIG_SECTIONS.filter((s) => keys.includes(s.key));

  return (
    <div className="border-border/60 bg-background sticky top-0 z-10 shrink-0 border-b lg:static">
      <div className="flex items-center justify-between gap-3 px-5 pt-3 pb-1">
        <span className="text-foreground text-sm font-medium">Configuration</span>
      </div>
      {/* Chips wrap: seven of them do not fit one 26rem line, and a row that
          scrolls sideways hides the last two behind an edge nobody drags. */}
      <div
        role="tablist"
        aria-label="Configuration sections"
        className="flex flex-wrap items-center gap-1 px-4 pb-2.5"
      >
        {chips.map((s) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={active === s.key}
            onClick={() => jump(s.key)}
            className={cn(
              'shrink-0 rounded-full px-2.5 py-1 text-xs whitespace-nowrap',
              'transition-[color,background-color,transform] active:scale-[0.96]',
              active === s.key
                ? 'bg-primary/[0.08] text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
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

  const documentRef = useRef<HTMLDivElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  // A stable list, so the scroll hook subscribes once rather than on every
  // render (`useMemo`, not a ref read during render).
  const scrollRefs = useMemo(() => [documentRef], []);
  const condensed = useScrolledPast(scrollRefs, 96);

  const onSave = useCallback(async () => {
    if (!editor.isDirty || update.isPending) return;
    try {
      const response = await update.mutateAsync(editor.draft);
      editor.commit(response.block ?? editor.draft);
      successToast(`${capitalizeWords(agent.name)} saved`);
    } catch (e) {
      errorToast((e as Error)?.message ?? 'Failed to save configuration');
    }
  }, [editor, update, agent.name]);

  const leaveGuard = useUnsavedChangesGuard(editor.isDirty);
  useSaveShortcut(onSave);

  return (
    <AgentPageFrame
      documentRef={documentRef}
      paneRef={paneRef}
      document={
        <>
          <CompactBar
            visible={condensed}
            projectId={projectId}
            agent={agent}
            config={config}
            canWrite
          />
          <DocumentColumn>
            <AgentHeader projectId={projectId} agent={agent} config={config} canWrite />

            <div className="mt-8 space-y-8">
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

              <InstructionsPanel
                value={editor.oc.prompt ?? ''}
                onChange={(next) => editor.setOc('prompt', next)}
              />
            </div>
          </DocumentColumn>
        </>
      }
      paneHeader={<PaneHeader paneRef={paneRef} keys={AGENT_CONFIG_SECTIONS.map((s) => s.key)} />}
      pane={
        <AgentConfigSections
          editor={editor}
          options={options}
          skillsOptions={skillsOptions}
          triggers={<AgentTriggersSection projectId={projectId} agentName={agent.name} />}
          people={<AgentPeopleSection projectId={projectId} agentName={agent.name} />}
        />
      }
      footer={
        <>
          <SaveBar
            dirty={editor.isDirty}
            pending={update.isPending}
            onDiscard={() => setConfirmDiscard(true)}
            onSave={onSave}
          />

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

          {/* The same question, asked by a link click while dirty — the
              sidebar, a tab, the breadcrumb. Confirming leaves; cancelling
              stays put. */}
          <ConfirmDialog
            open={leaveGuard.pendingHref !== null}
            onOpenChange={(open) => {
              if (!open) leaveGuard.stay();
            }}
            title="Leave without saving?"
            description={`Your changes to ${capitalizeWords(agent.name)} are not saved. Leave now and they are lost.`}
            confirmLabel="Leave"
            cancelLabel="Keep editing"
            confirmVariant="destructive"
            onConfirm={leaveGuard.leave}
          />
        </>
      }
    />
  );
}

/**
 * The instructions — the agent's system prompt, and the thing that most IS
 * the agent. Two views of one field: Edit is the textarea, Preview renders
 * the markdown the way the agent's source file reads. It opens on Preview
 * when there is something to read and on Edit when there is not; the toggle
 * is a segmented pair at the section's right edge, the same control the list
 * pages use for their filters.
 */
function InstructionsPanel({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [view, setView] = useState<'edit' | 'preview'>(value.trim() ? 'preview' : 'edit');
  return (
    <section className="space-y-2.5">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-1">
          <Label>Instructions</Label>
          <p className="text-muted-foreground text-xs leading-relaxed text-pretty">
            Told to this agent at the start of every session. Markdown. Leave empty to use the
            default instructions.
          </p>
        </div>
        <Tabs value={view} onValueChange={(next) => setView(next as 'edit' | 'preview')}>
          <TabsList aria-label="Instructions view">
            <TabsTrigger value="edit">Edit</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {view === 'edit' ? (
        <Textarea
          aria-label="Instructions"
          value={value}
          placeholder={'You are…\n\nGoal: …\n\nSteps:\n1. …'}
          minHeight={400}
          autoFocus={value.trim().length > 0}
          className="font-mono text-xs leading-relaxed"
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <div className="bg-popover min-h-[400px] rounded-md border px-5 py-4">
          <MarkdownWithFrontmatter content={value} />
        </div>
      )}
    </section>
  );
}

/**
 * The save bar. Exists only while there is something to save — an always-on
 * disabled pair of buttons is chrome that never earns its row. It sits across
 * the foot of the page, outside both scrollers, so it is reachable from any
 * point in a long instruction set and from anywhere in the pane.
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
          className="bg-background/95 border-border/60 z-10 shrink-0 border-t shadow-sm backdrop-blur"
        >
          <div className="flex w-full items-center justify-between gap-3 px-6 py-3 lg:px-10">
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
                <Kbd className="ml-1">⌘S</Kbd>
              </Button>
            </div>
          </div>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}

/**
 * Mod+S saves. The page is a document you edit, and every editor a person
 * has used saves on that chord; without it the browser offers to save the
 * HTML, which is never what anyone meant.
 */
function useSaveShortcut(onSave: () => void) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key === 's') {
        event.preventDefault();
        onSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onSave]);
}

/**
 * Holds a dirty page on the page until the person decides.
 *
 * Two exits, two guards. A tab close or a reload reaches only `beforeunload`,
 * so that is armed while dirty. An in-app link — the sidebar, a tab, the
 * breadcrumb — never fires it, and the App Router has no navigation event to
 * cancel, so anchor clicks are intercepted in the capture phase instead: the
 * click is swallowed, the target href is parked, and the page asks. `leave`
 * pushes the parked href; `stay` drops it. Modified clicks (new tab) and
 * external links pass through — nothing is lost by opening a second tab.
 */
function useUnsavedChangesGuard(isDirty: boolean) {
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.origin !== window.location.origin) return;
      const href = anchor.pathname + anchor.search + anchor.hash;
      if (href === window.location.pathname + window.location.search + window.location.hash) return;
      event.preventDefault();
      event.stopPropagation();
      setPendingHref(href);
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [isDirty]);

  return {
    pendingHref,
    stay: () => setPendingHref(null),
    leave: () => {
      const href = pendingHref;
      setPendingHref(null);
      if (href) router.push(href);
    },
  };
}

// ─── Read-only body ────────────────────────────────────────────────────────

function ReadOnlyAgentPage({
  projectId,
  agent,
  config,
  canWrite,
  showUpgradeHint,
}: {
  projectId: string;
  agent: Agent;
  config: ProjectConfigSummary;
  canWrite: boolean;
  showUpgradeHint: boolean;
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
  const documentRef = useRef<HTMLDivElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  // A stable list, so the scroll hook subscribes once rather than on every
  // render (`useMemo`, not a ref read during render).
  const scrollRefs = useMemo(() => [documentRef], []);
  const condensed = useScrolledPast(scrollRefs, 96);

  return (
    <AgentPageFrame
      documentRef={documentRef}
      paneRef={paneRef}
      document={
        <>
          <CompactBar
            visible={condensed}
            projectId={projectId}
            agent={agent}
            config={config}
            canWrite={canWrite}
          />
          <DocumentColumn>
            <AgentHeader projectId={projectId} agent={agent} config={config} canWrite={canWrite}>
              {agent.description ? (
                <p className="text-muted-foreground max-w-2xl text-sm text-pretty">
                  {agent.description}
                </p>
              ) : null}
            </AgentHeader>

            <div className="mt-8 space-y-2.5">
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
          </DocumentColumn>
        </>
      }
      paneHeader={<PaneHeader paneRef={paneRef} keys={['triggers', 'people']} />}
      pane={
        <div className="space-y-6">
          {showUpgradeHint ? (
            <InfoBanner tone="info" title="Upgrade for the full agent editor">
              This project uses a v1 manifest. Migrate to{' '}
              <span className="font-mono">kortix.yaml</span> (kortix_version 2) to edit this
              agent's instructions, model, tool permissions and access here.
            </InfoBanner>
          ) : null}
          <AgentModel projectId={projectId} agentName={agent.name} />
          <AgentScope projectId={projectId} agentName={agent.name} scope={agent.scope} />
          <div className="space-y-10">
            <div id={agentConfigSectionId('triggers')} data-agent-section="triggers" className="scroll-mt-4">
              <AgentTriggersSection projectId={projectId} agentName={agent.name} />
            </div>
            <div id={agentConfigSectionId('people')} data-agent-section="people" className="scroll-mt-4">
              <AgentPeopleSection projectId={projectId} agentName={agent.name} />
            </div>
          </div>
        </div>
      }
    />
  );
}
