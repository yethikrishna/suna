/**
 * Landing page copy.
 *
 * Plain English lives here, not in `apps/web/translations/*.json`, so the copy
 * can iterate before paying the 8-locale parity gate (`pnpm i18n:translations`).
 * Wire i18n keys only once the copy is locked.
 *
 * Voice rules: the `comms` skill. Category = "AI Management System". Never name
 * a licence. Never claim a certification we do not hold.
 */

export const hero = {
  eyebrow: 'The open-source AI Management System',
  title: 'Give your company a workforce that does the work',
  sub: 'Connect the tools you already run on. Ask in plain language. Agents work on real computers and hand back finished work.',
  ctaPrimary: 'Get started',
  ctaSecondary: 'Request demo',
  trust: 'Open source · Any model, your keys · Self-host, VPC, or on-prem',
} as const;

/**
 * Trust / security block.
 *
 * ACCURACY GATE: SOC 2 Type I and Type II are NOT held — both badges render
 * de-emphasised and carry an explicit "In progress" state. GDPR is a compliance
 * posture the company does hold, so it carries no state and renders bare.
 * Never write "compliant", "certified", or "we are SOC 2" here — the `comms`
 * skill forbids claiming a certification we do not hold. Adding a badge without
 * holding it, or clearing a SOC 2 `state` before the report lands, is a copy bug.
 */
export const trust = {
  eyebrow: 'Security & trust',
  /** Rendered one line each, so the headline breaks the same way at every width. */
  titleLines: [
    'Giving agents real access',
    'is the easy part. Trusting',
    'them with it is the work.',
  ],
  sub: 'Every session runs on its own isolated machine, with credentials it never sees, and lands nothing without a person approving it.',
  ctaLabel: 'How Kortix is secured',
  ctaHref: '/enterprise',
  /** Exactly three. No HIPAA, no ISO — we do not hold them. */
  badges: [
    { id: 'soc2-type-1', line1: 'SOC 2', line2: 'TYPE I', state: 'In progress' },
    { id: 'soc2-type-2', line1: 'SOC 2', line2: 'TYPE II', state: 'In progress' },
    { id: 'gdpr', line1: 'GDPR', line2: '', state: '' },
  ],
  columns: [
    {
      id: 'approve',
      title: 'Nothing merges itself',
      body: 'Work reaches main only through a change request a person reads and approves. Agents propose; people decide.',
    },
    {
      id: 'keys',
      title: 'The agent never holds your keys',
      body: 'Credentials stay encrypted and scoped per person and group, injected into the machine at runtime. The model never sees them, and they never reach a log.',
    },
    {
      id: 'deploy',
      title: 'Yours, down to the metal',
      body: 'Kortix Cloud, your own VPC, on-prem or fully air-gapped. It is open source, so you can read every line of what you are trusting.',
    },
  ],
} as const;

export type StackLayerId =
  | 'models'
  | 'harness'
  | 'computer'
  | 'context'
  | 'control'
  | 'security'
  | 'kortix';

export type StackLayer = {
  id: StackLayerId;
  name: string;
  body: string;
  /** Logo chips shown beside the layer. Keys map to `features/icon`. */
  logos?: readonly string[];
  /** Plain text chips where no logo exists. */
  chips?: readonly string[];
};

export const stack = {
  eyebrow: 'One platform',
  title: 'Every layer an AI workforce needs — unified.',
  sub: 'Most tools hand you one layer and rent you the rest. Kortix is all of them, open source, running wherever you put it.',
  layers: [
    {
      id: 'models',
      name: 'Large Language Models',
      body: 'Run any frontier model and switch between them as they improve. Bring your own API keys, the subscription you already pay for, or your own models running on your hardware. Kortix stays model-agnostic, so every agent uses the best model for the job.',
      logos: ['Claude', 'OpenAI', 'Gemini'],
      chips: ['Bedrock', 'OpenRouter', 'Your own, on-prem'],
    },
    {
      id: 'harness',
      name: 'Agentic Harness',
      body: 'The layer that turns a model into an agent: planning, tool use, and multi-step runs it actually finishes. Fully customizable and powered by OpenCode, so the way your agents think is yours to edit.',
      logos: ['OpenCode'],
    },
    {
      id: 'computer',
      name: 'Agent Computer',
      body: 'Every agent gets its own computer — a microVM-isolated Linux machine, pre-set-up with your repo, tools and dependencies. It can install, run and break anything. Nothing to configure, no local machine required.',
      chips: ['microVM isolated', 'Pre-configured', 'Thousands in parallel'],
    },
    {
      id: 'context',
      name: 'Context & Connections',
      body: 'Every tool your company runs on, connected once and shared across agents and people, so everyone works from the same picture. 3,000+ apps in a click, plus MCP, OpenAPI, GraphQL and raw HTTP.',
      logos: ['Slack', 'Notion', 'Linear', 'Github', 'MicrosoftTeams', 'Gmail'],
    },
    {
      id: 'control',
      name: 'Product / Control Plane',
      body: 'The control plane that ties every layer together: one place to configure, deploy, observe and operate every agent across your whole organization — from the web, Slack, mobile or the CLI.',
      chips: ['Web', 'Slack', 'Teams', 'Mobile', 'CLI', 'API'],
    },
    {
      id: 'security',
      name: 'Security & Governance',
      body: 'SSO, members, groups and role-based access come built in, with per-resource permissions for people and agents, encrypted secrets and a full audit trail. Self-host so the entire platform runs inside your own environment.',
      chips: ['SSO', 'RBAC', 'Secrets vault', 'Audit trail', 'SOC 2 Type II in progress'],
    },
    {
      id: 'kortix',
      name: 'Kortix',
      body: 'Every layer above brought together in one platform your team owns, deploys and scales end to end — from the model to the finished work. That’s Kortix.',
      chips: ['Open source', 'Self-hostable', 'Yours down to the metal'],
    },
  ] satisfies readonly StackLayer[],
} as const;
