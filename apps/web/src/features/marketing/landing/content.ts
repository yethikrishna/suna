/**
 * Landing page copy.
 *
 * Plain English lives here, not in `apps/web/translations/*.json`, so the copy
 * can iterate before paying the 8-locale parity gate (`pnpm i18n:translations`).
 * Wire i18n keys only once the copy is locked.
 *
 * Voice rules: the `comms` skill. Category = "AI Management System". Never name
 * a licence. Never claim a metric that is not in the sanctioned proof points.
 */

export const hero = {
  eyebrow: 'The open-source AI Management System',
  title: 'Give your company a workforce that does the work',
  sub: 'Connect the tools you already run on. Ask in plain language. Agents work on real cloud computers and hand back finished work.',
  ctaPrimary: 'Get started',
  ctaSecondary: 'Request demo',
  trust: 'Open source · Any model, your keys · Self-host, VPC, or on-prem',
} as const;

/** Tembo's best idea, told with our layers. The layer nobody else can claim is
 *  "Your company as code" — that one is deliberately the loudest. */
export const stack = {
  eyebrow: 'The stack',
  title: 'Everything an AI workforce needs. All of it yours.',
  sub: 'Most tools give you one layer and rent you the rest. Kortix is the whole stack, open source, running wherever you put it.',
  layers: [
    {
      id: 'models',
      name: 'Models',
      body: 'Any frontier model, your own API keys — or the ChatGPT, Claude, or Cursor subscription you already pay for. Switch as they improve.',
      meta: 'Anthropic · OpenAI · Google · Bedrock · OpenRouter',
    },
    {
      id: 'harness',
      name: 'Agent harness',
      body: 'The layer that turns a model into an agent: planning, tools, scoped permissions, and a todo list it actually finishes.',
      meta: 'Plan · Tools · Permissions · Approval gates',
    },
    {
      id: 'runtime',
      name: 'Cloud computers',
      body: 'Every session boots its own microVM-isolated Linux machine. The agent can install, run and break anything; only what it commits survives.',
      meta: 'microVM isolation · thousands in parallel',
    },
    {
      id: 'context',
      name: 'Context & connectors',
      body: '3,000+ apps in a click, plus MCP, OpenAPI, GraphQL and raw HTTP — all brokered server-side through one scoped token.',
      meta: 'Slack · Gmail · Notion · Linear · Salesforce · HubSpot',
    },
    {
      id: 'code',
      name: 'Your company as code',
      body: 'Agents, skills, memory, connectors and automations are files in one git repo that is the company. Versioned, diffable, owned outright.',
      meta: 'The layer no one else has',
      accent: true,
    },
    {
      id: 'surfaces',
      name: 'Surfaces',
      body: 'Reach it from the web, Slack, Teams, mobile, the CLI, or the API. Cron and signed webhooks start sessions without anyone asking.',
      meta: 'Web · Slack · Teams · Mobile · CLI · API · Triggers',
    },
    {
      id: 'governance',
      name: 'Security & governance',
      body: 'Members, groups and roles that match your org. Per-resource permissions for people and agents, encrypted secrets, and a full audit trail.',
      meta: 'SSO · RBAC · Secrets · Audit · Approval gates',
    },
  ],
} as const;

/** Pancake's "Any job, in any tool" — four departments, each with a real ask
 *  and a real deliverable. Counterparties are fictional placeholders. */
export const departments = {
  eyebrow: 'Any job, any team',
  title: 'It picks up work from every team and runs it start to finish',
  sub: 'Not a chat box. Agents act in your tools and hand back the artifact.',
  cards: [
    {
      tag: 'Finance',
      title: 'Closes the month while you sleep.',
      body: 'It reconciles the payouts, chases every overdue invoice, and leaves the workbook in the repo.',
      ask: '@kortix reconcile July payouts and chase anything 60+ days late',
      output: 'finance/stripe-payouts-2026-07.csv · 14 invoices chased · $38,400 outstanding',
    },
    {
      tag: 'Sales',
      title: 'Keeps the pipeline honest.',
      body: 'It pulls the CRM, flags what slipped, drafts the follow-ups, and opens a change request with the report.',
      ask: '@kortix what moved in the pipeline this week?',
      output: '7 deals advanced, 2 slipped · at risk: Northwind, Globex',
    },
    {
      tag: 'Engineering',
      title: 'Fixes it and opens the change request.',
      body: 'Report the bug on your way to bed. Wake up to a tested fix on its own branch, waiting for review.',
      ask: '@kortix checkout 500s on empty session — take it',
      output: 'session/fix-checkout · 4 files · tests pass · awaiting approval',
    },
    {
      tag: 'Marketing',
      title: 'Turns the changelog into the launch.',
      body: 'Give it what shipped. Get the post, the thread and the deck — grounded in your own docs.',
      ask: '@kortix turn this week’s changelog into a launch post and deck',
      output: 'kortix-pitch.pptx · launch-plan-v3.md · 10 slides',
    },
  ],
} as const;

export const repo = {
  eyebrow: 'Everything is code you own',
  title: 'Your whole company, as files',
  sub: 'One repo holds the agents, the skills they share, every fact the company has learned, and the machines it runs on. `grep` it, diff it, own it outright.',
} as const;

export const workforce = {
  eyebrow: 'Org-scale, in parallel',
  title: 'The future isn’t one assistant. It’s a workforce.',
  sub: 'Every request fans out into isolated sessions, each on its own cloud computer on its own branch. They run in parallel, then land back into one shared `main` through a change request a human approves.',
  points: [
    {
      title: 'Isolated and parallel',
      body: 'Thousands of sessions at once, each walled off in its own microVM. No crossover, no shared state to corrupt.',
    },
    {
      title: 'Reviewed into main',
      body: 'Durable work lands only through an approved change request you can read and diff. Nothing merges itself.',
    },
    {
      title: 'Compounds over time',
      body: 'Every approved change adds to the same repo, so skills and memory grow instead of scattering across tools.',
    },
  ],
} as const;

/** Pancake's security block, told with our mechanisms. */
export const trust = {
  eyebrow: 'Open & yours',
  title: 'Your keys, your machines, your company.',
  sub: 'Nothing about how your company works has to leave it.',
  cards: [
    {
      title: 'Secrets it never sees',
      body: 'Credentials are encrypted, scoped per person and group, and injected into the sandbox at runtime — never shown to the model, never written to a log.',
    },
    {
      title: 'A sealed machine per session',
      body: 'Every session gets its own microVM-isolated cloud computer. Nothing is shared between sessions, between teams, or between customers.',
    },
    {
      title: 'Run it wherever you want',
      body: 'Kortix Cloud, your own VPC, on-prem, or fully air-gapped. It is open source, so you can read every line and fork it if we ever let you down.',
    },
  ],
} as const;

export const cta = {
  title: 'Give your company a workforce.',
  sub: 'Start with one job. Connect the tools it needs. Let your team reach it from Slack, the web, or the CLI.',
  ctaPrimary: 'Get started',
  ctaSecondary: 'Request demo',
  trust: 'Free to self-host · Managed cloud from $20 / seat + usage',
} as const;
