/**
 * The API call behind every KaaB action this app performs.
 *
 * A reference wrapper's real job is to teach what to call, and a screenshot of a
 * dialog teaches nothing. So each action carries the two forms a wrapper author
 * actually arrives with:
 *
 *  - SDK — the `@kortix/sdk` call this app runs, verbatim.
 *  - HTTP — the request that ends up on the wire, for anyone integrating from a
 *    language with no SDK.
 *
 * Two rules this module exists to keep:
 *
 * 1. NOTHING SECRET IS EVER RENDERED. No secret value, no API key, no bearer
 *    token — the authorization header is always the `$KORTIX_API_KEY`
 *    placeholder and a secret's value is always `SECRET_VALUE_PLACEHOLDER`.
 *    That is why `SnippetContext` accepts a secret's IDENTIFIER and env KEY and
 *    has nowhere to put a value: a demo that teaches people to paste their key
 *    into a screenshot is worse than no demo.
 * 2. THE HTTP FORM SAYS WHO SENDS WHAT. `end_user_ref` is stamped by the proxy
 *    from the signed-in session (`src/server/end-user.ts`) and the browser can
 *    neither set nor change it — so every snippet that carries one names it in
 *    `serverInjected`. A snippet implying the browser sets it would teach
 *    exactly the vulnerability the design prevents.
 *
 * The building is pure and lives here rather than in the panel so what the demo
 * claims it sends can be asserted without rendering anything.
 */

import { NO_OVERRIDES, buildSessionCreateInput, type SessionOverrides } from './session-overrides';

/** Rendered wherever a real secret value would otherwise go. */
export const SECRET_VALUE_PLACEHOLDER = '$SECRET_VALUE';

/** The wrapper's bearer, as a placeholder — never the real key. */
export const AUTHORIZATION_HEADER = 'Authorization: Bearer $KORTIX_API_KEY';

/** Stand-ins for ids a screen may not have yet (the create dialog runs before
 *  any session exists). */
const PLACEHOLDER = {
  projectId: '{projectId}',
  sessionId: '{sessionId}',
  endUserRef: '{end_user_ref}',
  executionId: '{executionId}',
  identifier: '{identifier}',
  envKey: '{ENV_KEY}',
  model: 'anthropic/claude-sonnet-4-5',
} as const;

export const CALL_SNIPPET_IDS = [
  'session.create',
  'session.prompt',
  'session.model',
  'sessions.list',
  'usage.byEndUser',
  'usage.forEndUser',
  'approval.resolve',
  'secret.upsert',
] as const;

export type CallSnippetId = (typeof CALL_SNIPPET_IDS)[number];

export interface SnippetContext {
  projectId?: string;
  sessionId?: string;
  /** The signed-in end-user. Shown so the HTTP form is complete — it is still
   *  the SERVER that puts it on the request. */
  endUserRef?: string;
  /** Alias -> human label for the chosen connections. The dialog passes these to
   *  `buildSessionCreateInput`, so a snippet built without them prints
   *  `{"slack": "prof_9"}` where the app actually sends
   *  `{"slack": "Acme Team Slack"}` — drift on the exact override this panel is
   *  meant to teach. */
  connectionLabels?: Record<string, string>;
  /** The create-only overrides currently chosen, so the create snippet shows
   *  what THIS dialog would send rather than a generic example. */
  overrides?: SessionOverrides;
  /** The agent a prompt would name, when one is picked. */
  agent?: string | null;
  /** The model a mid-session change would move to. */
  model?: string | null;
  executionId?: string;
  /**
   * A secret's addressable parts. There is deliberately NO `value` field: this
   * type is the boundary that keeps secret material out of every snippet.
   */
  secret?: { identifier?: string; name?: string };
}

/**
 * The HTTP form. `runtime` is not a REST call at all — a prompt goes to the
 * session's own runtime through the authenticated session proxy, whose URL the
 * SDK owns and client code is forbidden to build (`scripts/sdk-boundary.mjs`).
 * Printing a path there would teach hand-rolling the one thing the SDK exists
 * to hold.
 */
export type HttpForm =
  | { kind: 'rest'; method: string; path: string; body?: unknown }
  | { kind: 'runtime'; summary: string };

export interface CallSnippet {
  id: CallSnippetId;
  /** Names the action as the UI names it, not as the route names it. */
  title: string;
  /** One line: what this call is for. */
  summary: string;
  /** The `@kortix/sdk` call this app makes. */
  sdk: string;
  http: HttpForm;
  /**
   * Fields or query params the proxy adds server-side. The browser sends none
   * of these, and one that names somebody else is refused rather than corrected.
   */
  serverInjected: string[];
  /** The things the two forms above would otherwise imply wrongly. */
  notes: string[];
}

function json(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/** `GET /usage?...` and friends, with the end-user ref escaped like the SDK does. */
function query(params: Record<string, string>): string {
  const search = new URLSearchParams(params).toString();
  return search ? `?${search}` : '';
}

/**
 * One copy-pasteable request block.
 *
 * The authorization line is part of the block on purpose: the single most
 * common wrapper mistake is forwarding the end user's own token upstream, and
 * seeing `$KORTIX_API_KEY` on every call is the correction.
 */
export function renderHttp(form: HttpForm): string {
  if (form.kind === 'runtime') return form.summary;
  const lines = [`${form.method} ${form.path}`, AUTHORIZATION_HEADER];
  if (form.body === undefined) return lines.join('\n');
  lines.push('Content-Type: application/json', '', json(form.body));
  return lines.join('\n');
}

/** True when the HTTP form is a request someone can copy and run. */
export function isCopyableHttp(form: HttpForm): boolean {
  return form.kind === 'rest';
}

// ── The calls ────────────────────────────────────────────────────────────────

function sessionCreate(ctx: SnippetContext): CallSnippet {
  const sessionId = ctx.sessionId ?? PLACEHOLDER.sessionId;
  // Built by the SAME function the dialog submits with, so the snippet cannot
  // drift from the request: an override the builder omits is omitted here too.
  const body = buildSessionCreateInput(ctx.overrides ?? NO_OVERRIDES, {
    sessionId,
    connectionLabels: ctx.connectionLabels,
  });
  // The app never types a session id — `generateSessionId()` produces it — so
  // the SDK form shows the variable and the HTTP form shows the value.
  const sdkBody = json(body).replace(`"${sessionId}"`, 'sessionId');

  return {
    id: 'session.create',
    title: 'Start a session with overrides',
    summary: 'Everything a session is scoped to is chosen here, once. There is no update path.',
    sdk: [
      "import { generateSessionId } from '@kortix/sdk';",
      '',
      'const sessionId = generateSessionId();',
      `await kortix.project(projectId).sessions.create(${sdkBody});`,
    ].join('\n'),
    http: {
      kind: 'rest',
      method: 'POST',
      path: `/v1/projects/${ctx.projectId ?? PLACEHOLDER.projectId}/sessions`,
      body: { ...body, end_user_ref: ctx.endUserRef ?? PLACEHOLDER.endUserRef },
    },
    serverInjected: ['end_user_ref'],
    notes: [
      'The browser never sends `end_user_ref`. The proxy adds it from the signed-in session (`src/server/end-user.ts`), and a request that names a different one is refused 403 rather than quietly corrected — a client that could choose it could bill another user or replay their session.',
      '`agent_name`, `secrets` and `connector_bindings` are CREATE-ONLY: no route updates them afterwards, which is why they are picked before the session exists.',
      '`secrets` lists secret IDENTIFIERS, not env KEYs. Two identifiers may share one KEY, and naming both in one create is refused 409 SECRET_IDENTIFIER_KEY_COLLISION.',
      '`inherit_unbound: true` accompanies any binding so the aliases nobody chose keep their project default instead of being switched off.',
      'The create body also accepts the session model, under a field named after the session runtime — the same field `changeModel()` writes on a running session.',
    ],
  };
}

function sessionPrompt(ctx: SnippetContext): CallSnippet {
  const agent = ctx.agent ?? null;
  return {
    id: 'session.prompt',
    title: 'Send a prompt (and switch agent per message)',
    summary: 'Each message names the agent that runs it — the one override that moves mid-session.',
    sdk: [
      'await kortix',
      '  .session(projectId, sessionId)',
      agent
        ? `  .send('Refund order 4182', { agent: '${agent}' });`
        : "  .send('Refund order 4182');",
      '',
      '// Or make the choice sticky for every following message:',
      `kortix.session(projectId, sessionId).setAgent(${agent ? `'${agent}'` : "'support'"});`,
    ].join('\n'),
    http: {
      kind: 'runtime',
      summary:
        'A prompt is not a REST call. It goes to the session runtime through the authenticated session proxy, and the SDK owns that URL — `ensureReady()` resolves the runtime, then sends the message. Client code is forbidden from building the path (scripts/sdk-boundary.mjs), so integrate through the SDK rather than reconstructing it.',
    },
    serverInjected: [],
    notes: [
      'The agent is per MESSAGE, not per session: `send(text, { agent })` overrides the sticky pick for that one turn.',
      'A switch to an agent with a DIFFERENT secrets grant is refused 409 AGENT_SWITCH_REQUIRES_NEW_SESSION. Retrying cannot work — the sandbox is already provisioned for the agent it booted with, and re-scoping now cannot un-read what that agent loaded. The remedy is a new session.',
    ],
  };
}

function sessionModel(ctx: SnippetContext): CallSnippet {
  const model = ctx.model ?? PLACEHOLDER.model;
  const projectId = ctx.projectId ?? PLACEHOLDER.projectId;
  const sessionId = ctx.sessionId ?? PLACEHOLDER.sessionId;

  return {
    id: 'session.model',
    title: 'Change the model mid-session',
    summary: 'The one create-time override that is still movable once a session is running.',
    sdk: [
      '// Server side (src/app/api/session-model/route.ts):',
      `await kortix.session(projectId, sessionId).changeModel('${model}');`,
      '',
      '// Browser side — this app goes through its own route, so the runtime-named',
      '// field stays server-side and client code says `model`:',
      `await fetch('/api/session-model?projectId=${projectId}&sessionId=${sessionId}', {`,
      "  method: 'PUT',",
      `  body: JSON.stringify({ model: '${model}' }),`,
      '});',
    ].join('\n'),
    http: {
      kind: 'rest',
      method: 'PUT',
      path: `/v1/projects/${projectId}/sessions/${sessionId}/model`,
      body: { '<runtime>_model': model },
    },
    serverInjected: [],
    notes: [
      'The upstream body field is named after the session runtime; `changeModel()` writes it for you. This app never spells it in client code (scripts/sdk-boundary.mjs keeps provider terminology out of the browser bundle) — the real field name is in `src/app/api/session-model/route.ts`.',
      'The reply carries `applied_live`. False means the model was stored and applies at the NEXT start; telling someone the model changed when their next answer comes from the old one is a lie worth avoiding.',
      'A live change restarts the runtime, which ends any in-flight turn.',
    ],
  };
}

function sessionsList(ctx: SnippetContext): CallSnippet {
  const endUserRef = ctx.endUserRef ?? PLACEHOLDER.endUserRef;
  return {
    id: 'sessions.list',
    title: "List one end-user's sessions",
    summary: 'The read that keeps two signed-in people apart when one API key makes every call.',
    sdk: 'await kortix.project(projectId).sessions.list();',
    http: {
      kind: 'rest',
      method: 'GET',
      path: `/v1/projects/${ctx.projectId ?? PLACEHOLDER.projectId}/sessions${query({
        end_user_ref: endUserRef,
      })}`,
    },
    serverInjected: ['end_user_ref'],
    notes: [
      'The browser asks for nothing: the proxy rewrites the query to the signed-in `end_user_ref` before it goes upstream. Without that, any signed-in user could read every other one\'s session list by adding the parameter themselves.',
      'A browser that names somebody else is refused 403 — the attempt surfaces rather than looking like it worked. The Isolation panel fires exactly that request so the refusal can be seen rather than trusted.',
      'A wrapper calling upstream directly with its own key DOES send this parameter — filtering happens server-side, so it never has to fetch a whole project to answer "show me this customer\'s sessions".',
    ],
  };
}

function usageByEndUser(): CallSnippet {
  return {
    id: 'usage.byEndUser',
    title: 'Read usage split per end-user',
    summary: 'Upstream bills the account once; this is what splits that bill back out.',
    sdk: "await kortix.billing.usageRollup({ groupBy: 'end_user_ref' });",
    http: {
      kind: 'rest',
      method: 'GET',
      path: `/v1/usage${query({ group_by: 'end_user_ref' })}`,
    },
    serverInjected: [],
    notes: [
      'Account-wide, so this runs SERVER-side in `/api/usage` and is not reachable from the browser: `src/server/policy.ts` is deny-by-default and permits no `/usage` route to an end user.',
      'Spend with no `end_user_ref` (dashboard sessions, anything predating the field) has a NULL key and is excluded from the grouping — the rows do NOT add up to the account total, and the difference is the unattributed remainder.',
    ],
  };
}

function usageForEndUser(ctx: SnippetContext): CallSnippet {
  const endUserRef = ctx.endUserRef ?? PLACEHOLDER.endUserRef;
  return {
    id: 'usage.forEndUser',
    title: 'Read one end-user’s usage',
    summary: 'The query a wrapper runs to answer "what does this customer owe me".',
    sdk: `await kortix.billing.usageRollup({ endUserRef: '${endUserRef}' });`,
    http: {
      kind: 'rest',
      method: 'GET',
      path: `/v1/usage${query({ end_user_ref: endUserRef })}`,
    },
    serverInjected: ['end_user_ref'],
    notes: [
      'Narrowing applies to the TOTALS as well as the breakdown, so this is one end-user’s bill rather than the account’s total with one row highlighted.',
      'The ref is the signed-in identity, taken from the verified session server-side — the same value the proxy stamps on session creates, which is what makes the two numbers comparable.',
    ],
  };
}

function approvalResolve(ctx: SnippetContext): CallSnippet {
  const projectId = ctx.projectId ?? PLACEHOLDER.projectId;
  const executionId = ctx.executionId ?? PLACEHOLDER.executionId;
  return {
    id: 'approval.resolve',
    title: 'Resolve an approval',
    summary: 'A `require_approval` gate ends the agent’s turn until a person decides.',
    sdk: `await kortix.project(projectId).approvals.resolve('${executionId}', 'approve', 'once');`,
    http: {
      kind: 'rest',
      method: 'POST',
      path: `/v1/projects/${projectId}/approvals/${executionId}`,
      body: { decision: 'approve', scope: 'once' },
    },
    serverInjected: [],
    notes: [
      'Three scopes, three different promises: `once` decides this call, `session` stops asking for THIS connector+action for the rest of the session, `session_all` stops asking for anything.',
      'The pending set is read from the per-SESSION audit, not the project-wide approval inbox: in wrapper mode one operator credential makes every call, so the inbox would hand this browser other end-users’ execution ids — and an execution id is all this route needs.',
      'Some refusals cannot be retried with the same credential at all; they need a decision from a signed-in person. A wrapper has no personal upstream identity, which is also why `require_connectors` is refused 403 REQUIRE_CONNECTORS_INTERACTIVE_ONLY.',
    ],
  };
}

function secretUpsert(ctx: SnippetContext): CallSnippet {
  const identifier = ctx.secret?.identifier ?? PLACEHOLDER.identifier;
  const name = ctx.secret?.name ?? PLACEHOLDER.envKey;
  const body = { identifier, name, value: SECRET_VALUE_PLACEHOLDER };

  return {
    id: 'secret.upsert',
    title: 'Create or rotate a secret',
    summary: 'One call does both — the identifier is what decides which.',
    sdk: `await kortix.project(projectId).secrets.upsert(${json(body)});`,
    http: {
      kind: 'rest',
      method: 'POST',
      path: `/v1/projects/${ctx.projectId ?? PLACEHOLDER.projectId}/secrets`,
      body,
    },
    serverInjected: [],
    notes: [
      `The value is never rendered here: \`${SECRET_VALUE_PLACEHOLDER}\` is a placeholder, and this builder has nowhere to put a real one. Read it from your own environment at the call site.`,
      'A new `identifier` creates; an existing one rotates in place, keeping its env KEY so every agent grant and session allowlist that names it keeps working.',
      'Pointing an existing identifier at a DIFFERENT env KEY is refused — the identifier is a stable handle, and re-aiming it would silently re-aim every grant that names it.',
      'Rotation reaches running sessions late: their agent already started with the old environment, and a live process cannot have its environment rewritten.',
    ],
  };
}

const BUILDERS: Record<CallSnippetId, (ctx: SnippetContext) => CallSnippet> = {
  'session.create': sessionCreate,
  'session.prompt': sessionPrompt,
  'session.model': sessionModel,
  'sessions.list': sessionsList,
  'usage.byEndUser': usageByEndUser,
  'usage.forEndUser': usageForEndUser,
  'approval.resolve': approvalResolve,
  'secret.upsert': secretUpsert,
};

/** One action's snippet, filled in with whatever the screen actually knows. */
export function callSnippet(id: CallSnippetId, ctx: SnippetContext = {}): CallSnippet {
  return BUILDERS[id](ctx);
}

/** Every snippet, in the order a wrapper author meets them. */
export function callSnippets(ctx: SnippetContext = {}): CallSnippet[] {
  return CALL_SNIPPET_IDS.map((id) => callSnippet(id, ctx));
}
