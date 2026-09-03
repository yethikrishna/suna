'use client';

/**
 * The agent editor — every field of one `agents.<name>` block in a
 * kortix_version 2 manifest (agent-first spec §2.2), as three reusable parts
 * and no shell of its own.
 *
 * The shell is `/projects/[id]/agent/[name]`
 * (`capabilities/agents/agent-page.tsx`): a routed page, two columns, the
 * instructions on the left and everything else on the right. It used to be a
 * pane swapped into the agent detail MODAL, one level under the Agents grid.
 * Customize is agent-centric now (Marko, 2026-09-01) — the agent is the object
 * a person is granted, so its editor is the core screen of Customize and gets
 * a URL, not a modal — and this module was split so the page can lay the
 * fields out its own way:
 *
 *  - `useAgentDraft` owns the draft, the baseline, the two writers (`set` for
 *    the Kortix block, `setOc` for the nested runtime block) and the dirty
 *    check. Pure state; no shell.
 *  - `useAgentEditorOptions` loads the three option lists the sections need
 *    (secrets, connectors, sandbox templates).
 *  - `AgentConfigSections` composes the right-hand column: Model, Access,
 *    Workspace, Tools, Basics — every section except the two the page
 *    promotes into its own header and left column (description, prompt).
 *
 * Saves round-trip the whole block to kortix.yaml via the agent-config route,
 * validated server-side against the manifest-schema validator before commit.
 *
 * ── How the sections are organised, and why ────────────────────────────────
 * The editor used to open with two headings, "Kortix" and "OpenCode", each
 * with an icon and a sentence naming the file it wrote to. That is a storage
 * taxonomy: to find "model" you first had to know that models are an OpenCode
 * concern. The sections are the questions you actually ask about an agent —
 * Model, Access, Workspace, Tools, Basics — and every field still writes to
 * exactly the same place it always did. `set` writes the Kortix block, `setOc`
 * writes the nested runtime block; that split is a fact about the code, not a
 * heading in the UI.
 *
 * Field blocks live in agent-editor-basics-fields.tsx (Basics + Model),
 * agent-editor-access-fields.tsx (Access + Workspace) and permission-editor.tsx
 * (Tools). Layout primitives are in agent-editor-primitives.tsx, the
 * all/pick/none grant control in grant-mode-field.tsx.
 */

import {
  type AgentConfigBlock,
  type AgentGrantSetV2,
  listConnectors,
  listProjectSandboxTemplates,
  listProjectSecrets,
  type RuntimeAgentConfig,
} from '@kortix/sdk';
import { contract, qk } from '@kortix/sdk/react';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { AccessSection, WorkspaceSection } from './agent-editor-access-fields';
import { BasicsSection, ModelSection } from './agent-editor-basics-fields';
import { EditorSectionStyleProvider } from './agent-editor-primitives';
import { ToolsSection } from './permission-editor';

export {
  AGENT_MODE_HELP,
  AGENT_MODE_LABEL,
  AGENT_MODES,
  KORTIX_CLI_CATALOG,
  PERMISSION_ACTION_LABEL,
  PERMISSION_ACTION_ONLY_GROUP_LABEL,
  PERMISSION_ACTION_ONLY_KEYS,
  PERMISSION_ACTIONS,
  PERMISSION_KEY_HELP,
  PERMISSION_KEY_LABEL,
  PERMISSION_RULE_GROUPS,
  PERMISSION_RULE_KEYS,
  THEME_COLOR_SWATCH,
  THEME_COLORS,
  WORKSPACE_MODE_HELP,
  WORKSPACE_MODE_LABEL,
  WORKSPACE_MODES,
} from './agent-editor-catalog';

/**
 * Order-independent serialization, for the dirty check.
 *
 * `set`/`setOc` clear a field with `delete`, which drops the key and re-adds it
 * at the END of the object when the field is set again. Plain
 * `JSON.stringify(draft) !== JSON.stringify(baseline)` therefore reported
 * "Unsaved changes" — and enabled Save — for a field the user had cleared and
 * then typed back exactly as it was. Sorting keys at every level takes
 * insertion order out of the comparison.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(',')}}`;
}

export type SetKortix = <K extends keyof AgentConfigBlock>(
  key: K,
  value: AgentConfigBlock[K],
) => void;
export type SetRuntime = <K extends keyof RuntimeAgentConfig>(
  key: K,
  value: RuntimeAgentConfig[K],
) => void;

export interface AgentDraft {
  draft: AgentConfigBlock;
  /** The runtime block, never undefined — sections read `oc.model` etc. */
  oc: RuntimeAgentConfig;
  set: SetKortix;
  setOc: SetRuntime;
  isDirty: boolean;
  /** Throw the draft away and return to the baseline. */
  discard: () => void;
  /** A save landed: the server's block is the new baseline AND the new draft. */
  commit: (saved: AgentConfigBlock) => void;
}

/**
 * The draft of one agent block. `initial` is read once — the caller keys the
 * component on the agent name so switching agents remounts rather than leaks.
 */
export function useAgentDraft(initial: AgentConfigBlock): AgentDraft {
  const [draft, setDraft] = useState<AgentConfigBlock>(initial);
  const [baseline, setBaseline] = useState<AgentConfigBlock>(initial);
  const isDirty = useMemo(
    () => stableStringify(draft) !== stableStringify(baseline),
    [draft, baseline],
  );

  // No governance field is a plain string anymore (that was `description`/
  // `model`, both moved to the runtime block) — clearing is undefined-only.
  const set = useCallback<SetKortix>((key, value) => {
    setDraft((d) => {
      const next = { ...d };
      if (value === undefined) delete next[key];
      else next[key] = value;
      return next;
    });
  }, []);

  // Runtime fields live nested under `draft.opencode` — same clear-on-empty
  // semantics as `set`, folded into the sub-object.
  const setOc = useCallback<SetRuntime>((key, value) => {
    setDraft((d) => {
      const oc: RuntimeAgentConfig = { ...(d.opencode ?? {}) };
      if (value === undefined || value === '') delete oc[key];
      else oc[key] = value;
      const next = { ...d };
      if (Object.keys(oc).length > 0) next.opencode = oc;
      else delete next.opencode;
      return next;
    });
  }, []);

  const discard = useCallback(() => setDraft(baseline), [baseline]);
  const commit = useCallback((saved: AgentConfigBlock) => {
    setBaseline(saved);
    setDraft(saved);
  }, []);

  return { draft, oc: draft.opencode ?? {}, set, setOc, isDirty, discard, commit };
}

export interface AgentEditorOptions {
  secretOptions: { id: string; label: string }[];
  connectorOptions: { id: string; label: string }[];
  sandboxOptions: { id: string; label: string }[];
}

/**
 * The option lists behind the Access and Workspace pickers. `initial.sandbox`
 * is kept in the sandbox list even when the template no longer exists, so a
 * stale value shows as itself rather than snapping to "Project default" and
 * silently rewriting the manifest on the next save.
 */
export function useAgentEditorOptions(
  projectId: string,
  initial: Pick<AgentConfigBlock, 'sandbox'>,
): AgentEditorOptions {
  const secretsQuery = useQuery({
    queryKey: qk.project.secrets(projectId),
    queryFn: () => listProjectSecrets(projectId),
    ...contract('config'),
  });
  const connectorsQuery = useQuery({
    queryKey: qk.project.connectors(projectId),
    queryFn: () => listConnectors(projectId),
    ...contract('config'),
  });
  const sandboxesQuery = useQuery({
    queryKey: qk.project.sandboxTemplates(projectId),
    queryFn: () => listProjectSandboxTemplates(projectId),
    ...contract('config'),
  });
  const secretOptions = useMemo(
    () =>
      [...new Set((secretsQuery.data?.items ?? []).map((s) => s.identifier))]
        .sort()
        .map((identifier) => ({ id: identifier, label: identifier })),
    [secretsQuery.data],
  );
  const connectorOptions = useMemo(
    () =>
      (connectorsQuery.data?.connectors ?? [])
        .map((c) => ({ id: c.slug, label: c.name || c.slug }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [connectorsQuery.data],
  );
  const sandboxOptions = useMemo(() => {
    const options = new Map<string, string>([['default', 'Platform default']]);
    for (const template of sandboxesQuery.data?.items ?? []) {
      options.set(template.slug, template.is_default ? 'Platform default' : template.name);
    }
    if (initial.sandbox && !options.has(initial.sandbox)) {
      options.set(initial.sandbox, initial.sandbox);
    }
    return [...options].map(([id, label]) => ({ id, label }));
  }, [initial.sandbox, sandboxesQuery.data]);

  return { secretOptions, connectorOptions, sandboxOptions };
}

/**
 * The right-hand column of the agent page: how it thinks, what it may reach,
 * where it runs, which tools it may call, and the switches that say whether
 * it can run at all. Description and prompt are NOT here — the page gives
 * those the header and the whole left column, so the two sections that carry
 * them are told to leave them out.
 *
 * Order is the order you configure an agent in once its instructions exist:
 * Model first (the one thing every agent needs), then the grants, then the
 * environment, then the tool rules most agents never touch, then the
 * housekeeping switches. `children` slots page-owned sections (triggers,
 * people) into the same stack so the column reads as one list.
 */
/**
 * The pane's tabs, in order. Access leads: which skills, connectors and
 * secrets an agent may reach — and who may reach the agent — is the decision
 * Customize exists for (Marko, 2026-09-02); the model and the sampling knobs
 * are set once and rarely revisited, so they sit further down.
 */
export const AGENT_CONFIG_SECTIONS = [
  // People first: granting an agent to a person or a group IS the access
  // path in Kortix (Marko, 2026-09-03), so who may use it leads, and what it
  // may reach — which those people inherit — follows on its own tab.
  { key: 'people', label: 'People' },
  { key: 'access', label: 'Access' },
  { key: 'triggers', label: 'Triggers' },
  { key: 'model', label: 'Model' },
  { key: 'workspace', label: 'Workspace' },
  { key: 'tools', label: 'Tools' },
  { key: 'basics', label: 'Basics' },
] as const;

export type AgentConfigSectionKey = (typeof AGENT_CONFIG_SECTIONS)[number]['key'];

/** The tab the pane opens on, and the one an unknown `?section=` falls back to. */
export const DEFAULT_AGENT_CONFIG_SECTION: AgentConfigSectionKey = 'people';

export function isAgentConfigSectionKey(value: string | null): value is AgentConfigSectionKey {
  return AGENT_CONFIG_SECTIONS.some((s) => s.key === value);
}

/**
 * One tab of the configuration pane. The draft is shared across tabs — a
 * switch never drops an edit — and the save bar below the pane is global, so
 * a tab is a view, not a form of its own.
 *
 * People and Access are two tabs (Marko, 2026-09-03: "split the member
 * grants and the access to what the agent has"): who may use the agent, and
 * what the agent — and therefore they — may reach.
 */
export function AgentConfigSections({
  section,
  editor,
  options,
  skillsOptions,
  triggers,
  people,
}: {
  section: AgentConfigSectionKey;
  editor: AgentDraft;
  options: AgentEditorOptions;
  skillsOptions: { id: string; label: string }[];
  /** The agent's triggers — a page-owned section, the Triggers tab. */
  triggers?: React.ReactNode;
  /** Who may use the agent — a page-owned section, the People tab. */
  people?: React.ReactNode;
}) {
  const { draft, oc, set, setOc } = editor;
  // Every section is a card (`EditorSectionStyle` 'panel'), so a tab holding
  // two of them — Access holds the people and the grants — shows two blocks.
  const body = (() => {
    switch (section) {
      case 'people':
        return <>{people}</>;
      case 'access':
        return (
          <AccessSection
            draft={draft}
            set={set}
            skillsOptions={skillsOptions}
            connectorOptions={options.connectorOptions}
            secretOptions={options.secretOptions}
          />
        );
      case 'triggers':
        return <>{triggers}</>;
      case 'model':
        return <ModelSection oc={oc} setOc={setOc} showPrompt={false} />;
      case 'workspace':
        return <WorkspaceSection draft={draft} set={set} sandboxOptions={options.sandboxOptions} />;
      case 'tools':
        return (
          <ToolsSection permission={oc.permission} onChange={(next) => setOc('permission', next)} />
        );
      case 'basics':
        return (
          <BasicsSection draft={draft} set={set} oc={oc} setOc={setOc} showDescription={false} />
        );
    }
  })();
  return (
    <EditorSectionStyleProvider value="panel">
      <div className="space-y-4">{body}</div>
    </EditorSectionStyleProvider>
  );
}

/** Summarize a grant set — "All", "None", "3 picked" — for compact cards. */
export function grantSummary(v: AgentGrantSetV2 | undefined): {
  label: string;
  tone: 'muted' | 'outline';
} {
  if (v === 'all') return { label: 'All', tone: 'outline' };
  if (v === undefined || v === 'none' || (Array.isArray(v) && v.length === 0))
    return { label: 'None', tone: 'muted' };
  return { label: `${(v as string[]).length} picked`, tone: 'outline' };
}
