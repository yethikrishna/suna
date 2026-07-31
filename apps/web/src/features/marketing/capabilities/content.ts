/**
 * Home-page long-form section copy — "The mechanisms underneath".
 *
 * Plain English lives here, not in `apps/web/translations/*.json`, so the copy
 * can iterate before paying the 8-locale parity gate (`pnpm i18n:translations`).
 * Wire i18n keys only once the copy is locked.
 *
 * Voice rules: the `comms` skill.
 *
 * WHAT THIS SECTION IS. The home page is visual: a hero video, a stacked layer
 * card set, a use-case wheel, a slab and a dark trust card. None of it can be
 * READ. This is the one place on the page where a reader who wants substance
 * gets prose.
 *
 * WHAT IT IS NOT is a second telling of the layer stack directly above it. Four
 * entries, each covering ground `how-it-works-content.ts` does not — see the
 * block above `entries` for what was cut and why. Every entry indexes into the
 * sub-page that carries the long form; none restates a whole sub-page, and none
 * may contradict one.
 *
 * ==========================================================================
 * ACCURACY GATE — every claim below was checked against code, not against the
 * sub-page copy it summarises. Do not soften, inflate, or "restore" any of it.
 * ==========================================================================
 *  - SECRETS. Never write that a granted secret is invisible to the model. A
 *    granted RUNTIME secret is a real env value in the session, readable by any
 *    command the agent runs (`docs/ENV_SECRET_EXPOSURE_BASELINE.md`). Only
 *    CONNECTOR credentials never enter the machine — they are `scope='connector'`
 *    and structurally excluded from sandbox env injection
 *    (`apps/api/src/projects/secrets.ts:173` skips them; :226 filters to
 *    `scope='runtime'`). Encryption is AES-256-GCM under an HKDF-SHA256 key
 *    derived per project (`secrets.ts:60,72`).
 *  - EGRESS. Never claim it is controlled at the network. Not implemented.
 *  - microVM. Never a blanket claim — true for Platinum (Cloud Hypervisor) only;
 *    the default provider is not. Write "its own isolated machine".
 *  - CHANNELS are a closed enum of four: `packages/manifest-schema/src/
 *    constants.ts:55` → `['slack','teams','email','voice']`. Slack is live;
 *    Teams is `TEAMS_CHANNEL_ENABLED: optBoolFalse` (`apps/api/src/config.ts:364`);
 *    email and voice are experimental, per-project opt-in. Telegram, WhatsApp,
 *    SMS and Discord are NOT channels, in any tense.
 *  - HARNESS. OpenCode only. ACP, `kortix_version: 3` and the Claude Code /
 *    Codex / Pi harnesses sit behind `KORTIX_ACP_RUNTIME` (`config.ts:272`,
 *    default false) and are not shipped. Never name them. Saying "an agent is
 *    an OpenCode agent" is a statement about depth, not about choice — do not
 *    let it imply a harness menu.
 *  - WHAT AN AGENT IS. Markdown is the FLOOR, never the ceiling. Do not write
 *    "an agent is a markdown file" and stop there. Verified:
 *      · Behavior is a stock OpenCode agent `.md` — Kortix adds no dialect.
 *        `compile-agent-config.ts` passes the frontmatter straight through as
 *        `OpencodeAgentConfig`: description, mode, model, variant, temperature,
 *        top_p, prompt, disable, hidden, options, color, steps, permission.
 *      · `permission` is per-capability, not one switch: read, edit, glob, grep,
 *        list, bash, task, external_directory, lsp, skill, todowrite, question,
 *        webfetch, websearch, doom_loop, plus arbitrary tool names — each
 *        `allow | ask | deny` or a glob→action map
 *        (`index.v2.ts` → `PermissionConfigObjectV2`).
 *      · The rest of the OpenCode surface lives in the same repo and is
 *        editable: `tools/` (real TypeScript, auto-discovered — the starter
 *        ships web_search, scrape_webpage, image_search, memory, show),
 *        `plugins/` (the starter ships a PTY plugin), `skills/`,
 *        `opencode.jsonc` (models, providers), and a real `package.json` that
 *        OpenCode `bun install`s at startup.
 *      · The GRANT covers more than tools. `AgentBlockV2` fields: `sandbox`
 *        (which machine it boots), `connectors` + `connectors_required`,
 *        `secrets`, `skills`, `kortix_cli`, `workspace`, `enabled`. CHANNELS
 *        are covered by `connectors` because a connected channel IS a connector
 *        with `provider: 'channel'` (`apps/api/src/projects/connectors.ts:61`).
 *  - TRIGGER TEMPLATE TOKENS. The cron payload is built in
 *    `apps/api/src/projects/trigger-execution-store.ts:40-49`:
 *    `cron.schedule`, `cron.timezone`, `cron.scheduled_for`, `cron.claimed_at`,
 *    `cron.last_scheduled_for`. There is NO `cron.fired_at`. Do not invent one.
 *  - POLICY. Actions are `always_run | require_approval | block`
 *    (`apps/api/src/executor/policy.ts:20`). `default_mode` falls back to
 *    `allow_all` when a project declares no `policy:` block
 *    (`apps/api/src/projects/policies.ts:73`) — approval gates are OFF by
 *    default. Say "set it", never "it is on".
 *  - MERGE is default-deny for agents, not human-only. `project.cr.merge` is a
 *    grantable capability asserted at `apps/api/src/projects/routes/r9.ts:58`.
 *  - AGENT CEILING. The effective grant at session birth is
 *    `declared ∩ launching-user role` (`apps/api/src/projects/agents.ts:19-21`).
 *  - AUDIT. Recording is never gated; only read/export/stream is
 *    (`apps/api/src/types.ts:129-135`).
 *  - SELF-HOST is NOT air-gapped. `kortix self-host start` pulls images over the
 *    internet and the default sandbox provider is remote. No entry claims this
 *    today — the rule stands in case one is ever re-added.
 *  - LICENCE. Say "open source" and stop. Never name one.
 *  - CERTIFICATION. Never claim one. SOC 2 is in progress; do not mention a
 *    certification on this section at all.
 *  - NUMBERS. No invented metrics, no customer names, no benchmarks. "3,000+
 *    apps" is the only sanctioned figure and the connectors entry that used it
 *    was cut, so this section now carries no figure at all.
 *  - Say "cloud computer" / "agent computer" / "sandbox". NEVER "container".
 */

export const heading = {
  eyebrow: 'In practice',
  title: 'The mechanisms underneath.',
  lede: 'The stack above names the layers. These four are what makes them work — the detail a card cannot hold, each one linking to the page that carries the full argument.',
} as const;

export type Entry = {
  readonly id: string;
  readonly n: string;
  readonly label: string;
  readonly paragraphs: readonly string[];
  readonly facts: readonly string[];
  readonly href: string;
  readonly linkLabel: string;
};

/**
 * FOUR ENTRIES, AND THE FOUR THAT WERE CUT.
 *
 * This section used to run eight. Four of them restated the layer stack that
 * sits one screen above, so a reader met the same material twice — once as
 * cards, once as prose — and the second pass read as length rather than depth.
 * Each cut is recorded here so nobody re-adds one without the argument:
 *
 *  - THE REPO. `how-it-works-content.ts` layer 01 already carries all of it:
 *    "kortix.yaml declares the machine image, the connectors and the triggers",
 *    "Agents and skills are markdown", "grep the whole company, diff any
 *    change, roll any part of it back". The only residue was `kortix init` /
 *    `kortix ship`, which the hero CLI panel and the open-source terminal both
 *    already show.
 *  - THE AGENT COMPUTER. Layer 05 carries all three beats, and its "Session id,
 *    sandbox id and branch name are one and the same string" is sharper than
 *    the paragraph that was here.
 *  - CONNECTORS. Layer 02's three bullets state 3,000+/MCP/OpenAPI/GraphQL/HTTP,
 *    server-side brokering, AND "allow, ask or block — down to the arguments it
 *    was given". The one beat the card could not hold — an approval HOLDS the
 *    call and the run resumes from it rather than failing — moved into
 *    `control` below, which already owns approval gates.
 *  - RUN IT YOURSELF. The open-source section directly beneath this one owns
 *    it: the live star count, the two commands, and a four-row ledger of where
 *    self-hosting stops.
 *
 * What is left is the operational layer the stack gestures at and never
 * explains, in one arc: what an agent really is, where sessions come from, work
 * that starts itself, and what keeps all of it in bounds.
 *
 * `agents` is kept DESPITE layer 04 touching it, deliberately. That card says
 * "How an agent thinks is markdown you can read, diff and edit" — the exact
 * understatement corrected in the accuracy gate above. Cut this entry and the
 * home page states the understatement in a card and corrects it nowhere. The
 * grant surface (the machine it boots, its connectors and channels, its
 * secrets, its skills, its Kortix verbs) appears in no card at all.
 *
 * `control` is the strongest structural case: `how-it-works-content.ts:11-13`
 * says in as many words that "Security and governance is deliberately not a
 * layer here", and the trust section below is badges and pillars, not
 * mechanism. Nothing else on the page explains it.
 */
export const entries: readonly Entry[] = [
  {
    id: 'agents',
    n: '01',
    label: 'Agents and skills',
    paragraphs: [
      'An agent is an OpenCode agent. At baseline that is one markdown file — frontmatter setting its mode, model and per-capability permission tree, a body that is the system prompt — but markdown is the floor, not the ceiling. The whole OpenCode surface sits in the same repo: your own TypeScript tools, plugins that hook the runtime, the model and provider config.',
      'What it may reach is a block in kortix.yaml, and it covers more than tools: which sandbox image it boots, which connectors and channels it can call, which secrets it may receive, which skills it may invoke, and what it may do to Kortix itself. A grant left out resolves to none, and whatever is granted is intersected with the role of whoever launched the session — an agent never exceeds its human.',
    ],
    facts: ['OpenCode agent', 'Tools, plugins, models', 'Deny by default'],
    href: '/agents-and-skills',
    linkLabel: 'Agents and skills',
  },
  {
    id: 'channels',
    n: '02',
    label: 'Channels',
    paragraphs: [
      'Bind a project to Slack and a message in a thread starts a session. The agent picks up its own cloud computer, does the work, and answers in the same thread: the reply streams into one message, files move both directions, and a decision it needs from you arrives as a card with buttons.',
      'A thread is exactly one session — a unique index in the database, not a convention two services agree to honour. Slack is the surface that is live. Microsoft Teams is code-complete behind an operator switch; email and voice are experimental and opt in per project. That is the entire list, because the platform enum is closed at four.',
    ],
    facts: ['Slack, live', 'Teams behind an operator switch', 'Email and voice experimental'],
    href: '/channels',
    linkLabel: 'Channels',
  },
  {
    id: 'automations',
    n: '03',
    label: 'Automations',
    paragraphs: [
      'A trigger starts a session with nobody present. There are two kinds and no third: a cron schedule, stored against an IANA timezone name rather than an offset, or a webhook signed with HMAC-SHA256. A webhook trigger that names no signing secret is rejected at validation, so there is no unsigned path to forget to lock down later.',
      'Both are entries in kortix.yaml, so the 3am job has an author and a history like everything else, and both run as an agent you name. The prompt is a template: a webhook fire renders {{ body.* }}; a cron fire renders {{ cron.schedule }}, {{ cron.timezone }} and {{ cron.scheduled_for }}. Every fire is a clean slate by default, or a trigger can re-prompt a session it already owns, keyed off the payload so one customer keeps one thread.',
    ],
    facts: ['Cron and signed webhook', 'Declared in kortix.yaml', 'Runs as an agent you name'],
    href: '/automations',
    linkLabel: 'Automations',
  },
  {
    id: 'control',
    n: '04',
    label: 'Permissions and secrets',
    paragraphs: [
      'People, groups and service accounts are all principals, and a permission attaches to a principal for an action on a resource type. A service account never inherits the reach of whoever created it. Secrets are sealed with AES-256-GCM under a key derived per project, and a session receives only the intersection of the agent’s grant and the role of the person who started it.',
      'We will not tell you a granted secret is invisible to the model: once delivered it is a real environment value in the session, because that is how a tool uses it. What holds is narrower — connector credentials never enter the machine at all, and the machine is destroyed with everything on it. Account administration — members, billing, creating projects — is outside the set an agent can hold at all.',
      'Approval gates are not on by default, so set the default you want. When one fires it holds the call open rather than failing it, so the run resumes from exactly where it stopped — a gate that errors out just teaches an agent to retry around it. Work reaches main one way: a change request, and merge is refused to every agent unless an admin grants it in kortix.yaml, which is itself an edit a person has to merge.',
    ],
    facts: ['AES-256-GCM per project', 'Default-deny merge', 'Audit recorded on every plan'],
    href: '/security',
    linkLabel: 'Security',
  },
];
