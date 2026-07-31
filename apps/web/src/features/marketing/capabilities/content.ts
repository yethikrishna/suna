/**
 * Home-page long-form section copy — "The long version".
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
 * gets prose — one entry per capability, each an index into the sub-page that
 * carries the long form. It deliberately does NOT restate a whole sub-page, and
 * it must never contradict one.
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
 *    default false) and are not shipped. Never name them.
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
 *    internet and the default sandbox provider is remote. Route isolated
 *    topologies to Enterprise.
 *  - LICENCE. Say "open source" and stop. Never name one.
 *  - CERTIFICATION. Never claim one. SOC 2 is in progress; do not mention a
 *    certification on this section at all.
 *  - NUMBERS. "3,000+ apps" is the only sanctioned figure used here. No invented
 *    metrics, no customer names, no benchmarks. Note what is deliberately NOT
 *    quantified: `/self-hosted` says the first run asks "six questions", but the
 *    ordering comment in `apps/cli/src/commands/self-host.ts:382-393` numbers
 *    six STEPS while `promptFeatureFlags` is itself two questions. The count is
 *    soft, so this section says "the handful of things only you can know".
 *  - Say "cloud computer" / "agent computer" / "sandbox". NEVER "container".
 */

export const heading = {
  eyebrow: 'What it does',
  title: 'The long version.',
  lede: 'The stack above names the layers. This is what each one actually is, in the order you meet it — and the page behind it when you want the whole argument.',
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

export const entries: readonly Entry[] = [
  {
    id: 'repo',
    n: '01',
    label: 'The repo',
    paragraphs: [
      'A Kortix project is a git repository, and that repository is the company. kortix.yaml is the Kortix layer — the machine a session boots on, the connectors, the triggers, the secret names, and what each agent may touch. The OpenCode config beside it is the runtime the agents think in. Everything past those two files is markdown.',
      'So the whole company answers to grep. Every agent prompt, every skill, every remembered fact and every grant is a line in a file with an author, a timestamp and a diff, and undo is git revert. kortix init turns any directory into a Kortix; kortix ship checks it compiles, asks for the secrets it is missing, and brings it live.',
    ],
    facts: ['kortix.yaml', 'OpenCode config', 'kortix init', 'kortix ship'],
    href: '/company-as-code',
    linkLabel: 'Company as code',
  },
  {
    id: 'agents',
    n: '02',
    label: 'Agents and skills',
    paragraphs: [
      'An agent is a markdown file carrying a persona and a permission tree, plus a governance block in kortix.yaml saying what it may reach. A skill is a directory with a SKILL.md at its root — how your company does one specific job, written once and loaded by every session that needs it.',
      'Grants are deny by default: leave one out and it resolves to none. Above that sits a ceiling nothing in the config can lift, because the grant applied at session start is what the agent declared intersected with the role of the person who launched it. An agent can edit kortix.yaml — it is a file — but the edit only reaches sessions started after a person merges it.',
    ],
    facts: ['Markdown', 'Deny by default', 'Agent ≤ human'],
    href: '/agents-and-skills',
    linkLabel: 'Agents and skills',
  },
  {
    id: 'computer',
    n: '03',
    label: 'The agent computer',
    paragraphs: [
      'Start a session and its own isolated Linux machine boots. It clones the project repo into /workspace, cuts a branch named after the session, and starts OpenCode as the agent harness. The agent gets the whole machine — a shell, a package manager, a filesystem, the network. Nothing runs on your laptop and nothing needs setting up.',
      'The machine is disposable, so a bad install or a wiped directory goes away with it and only what the agent commits survives. And because one session is one machine on one branch, two sessions cannot touch each other. Run one, or run thousands at once, each a different version of the company working at the same time.',
    ],
    facts: ['1 session = 1 computer = 1 branch', 'OpenCode harness', 'Disposable by design'],
    href: '/agent-computer',
    linkLabel: 'The agent computer',
  },
  {
    id: 'connectors',
    n: '04',
    label: 'Connectors',
    paragraphs: [
      'Connect a tool once, for the whole project: 3,000+ apps through their own OAuth screens, or your own APIs through an OpenAPI or Postman spec, a GraphQL endpoint, a remote MCP server, or a bare HTTP base URL. Kortix reads the source, works out the authentication, and turns every operation into a tool an agent can call.',
      'The credential never travels. The machine carries exactly one project-scoped Kortix token; the third-party key is decrypted server-side and attached to the outbound request, so nothing in the sandbox is a secret of yours. Every action gets one of three answers — allow, ask, or block — and a rule can read the arguments rather than only the tool name, so "only to this domain" is a thing you can actually express. An ask holds the call open instead of failing it, and the agent resumes exactly where it stopped.',
    ],
    facts: ['3,000+ apps', 'MCP · OpenAPI · GraphQL · HTTP', 'Allow / Ask / Block'],
    href: '/integrations',
    linkLabel: 'Connectors',
  },
  {
    id: 'channels',
    n: '05',
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
    n: '06',
    label: 'Automations',
    paragraphs: [
      'A trigger starts a session with nobody present. There are two kinds and no third: a cron schedule, stored against an IANA timezone name rather than an offset, or a webhook signed with HMAC-SHA256. A webhook trigger that names no signing secret is rejected at validation, so there is no unsigned path to forget to lock down later.',
      'Both are entries in kortix.yaml, so the 3am job has an author and a history like everything else, and both inherit exactly the reach of the agent they name. The prompt is a template: a webhook fire renders {{ body.* }}, a cron fire renders {{ cron.schedule }}, {{ cron.timezone }} and {{ cron.scheduled_for }}. Every fire is a clean slate by default, or a trigger can re-prompt a session it already owns, keyed off the payload so one customer keeps one thread.',
    ],
    facts: ['Cron and signed webhook', 'Declared in kortix.yaml', 'Runs as an agent you name'],
    href: '/automations',
    linkLabel: 'Automations',
  },
  {
    id: 'control',
    n: '07',
    label: 'Permissions and secrets',
    paragraphs: [
      'People, groups and service accounts are all principals, and a permission attaches to a principal for an action on a resource type. A service account is evaluated purely against its own policies — it never inherits the reach of whoever created it. Secrets are sealed with AES-256-GCM under a key derived per project, and a session receives only the intersection of the agent’s declared grant and the role of the person who started it.',
      'We will not tell you a granted secret is invisible to the model: once delivered it is a real environment value inside the session, because that is how a tool uses it. What holds is narrower and true — connector credentials never enter the machine at all, and the machine is destroyed with everything on it. Approval gates are not on by default, so set the default you want. And work reaches main exactly one way: a change request. Merging one is a capability of its own, refused to every agent unless an admin grants it in kortix.yaml — and widening that grant is itself a change someone has to approve.',
    ],
    facts: ['AES-256-GCM per project', 'Default-deny merge', 'Audit recorded on every plan'],
    href: '/security',
    linkLabel: 'Security',
  },
  {
    id: 'selfhost',
    n: '08',
    label: 'Run it yourself',
    paragraphs: [
      'All of it is open source. One command brings up a single Docker Compose stack built from the same images the managed cloud runs, and the database, the file storage, every project repo, the secrets, the policies and the audit record sit on disk you control. The CLI asks the handful of things only you can know, and generates every port, URL, password and signing key itself.',
      'Two limits, stated plainly. Agent sandboxes run on the provider you configure and the stack pulls its images over the internet, so this is not an air-gapped deployment — isolated topologies get scoped with us instead. And SAML SSO, SCIM directory sync, custom roles, groups and reading the audit log switch on with an Enterprise licence. Models are yours either way: any provider and your own keys, or the ChatGPT, Claude or Cursor subscription you already pay for.',
    ],
    facts: ['One Compose stack', 'Same images as the cloud', 'Any model, your keys'],
    href: '/self-hosted',
    linkLabel: 'Self-hosted',
  },
];

export const closer =
  'Nothing above is a roadmap item. Every line of it is running today, and every page it points at is written against the code rather than the pitch.';
