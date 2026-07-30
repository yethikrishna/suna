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

/**
 * Hero variants. The product pitch — what Kortix IS — not a use-case pitch.
 * Anchored on the README's opening: "The open-source AI Management System".
 *
 * Append `?hero=1` (or 2, 3, 4) to the URL to preview an alternative; the
 * selector is dev-only and renders nothing in production.
 */
export const heroVariants = [
  {
    id: 'category',
    label: 'Category (recommended)',
    title: 'The open-source AI Management System',
    sub: 'Connect the tools your company already runs on, ask in plain language, and agents do the work on their own computers — then hand back the finished thing for you to approve.',
  },
  {
    id: 'category-workforce',
    label: 'Category + workforce',
    title: 'The AI Management System for your whole company',
    sub: 'One place to run a workforce of agents: connect every tool once, ask in plain language, and review what comes back. Open source, any model, yours to host.',
  },
  {
    id: 'own-it',
    label: 'Ownership-first',
    title: 'An AI workforce your company actually owns',
    sub: 'Agents work on their own computers, use credentials they never see, and land nothing without a person approving it. Open source, any model, anywhere.',
  },
  {
    id: 'workforce',
    label: 'Outcome-first (previous)',
    title: 'Give your company a workforce that does the work',
    sub: 'Connect the tools you already run on. Ask in plain language. Agents work on real computers and hand back finished work.',
  },
] as const;

/** The eyebrow renders as a row with the two competitor marks, so its parts
 *  live separately. "more extensible" is a fact (open source, self-hostable,
 *  any model); avoid "better", which is an unverifiable superlative. */
export const heroEyebrow = {
  lead: 'The open-source alternative to',
  rivals: [
    { id: 'cowork', icon: 'Claude', label: 'Claude Cowork' },
    { id: 'chatgpt-work', icon: 'OpenAI', label: 'ChatGPT Work' },
  ],
  tail: '— and fully extensible',
} as const;

export const hero = {
  ...heroVariants[0],
  ctaPrimary: 'Get started',
  ctaSecondary: 'Request demo',
  trust: 'Open source · Any model, your keys · Self-host, VPC, or on-prem',
} as const;

/** Closing CTA. Same block the page has always ended with. */
export const cta = {
  badge: 'Get started',
  title: 'Run your whole company from one repo you own.',
  sub: 'Start with one job, connect the tools it needs, and let your team reach it from Slack, the web, or the CLI. Self-host for free, or managed cloud from $20 / seat + usage.',
  trust: 'Open source · SSO, RBAC & on-prem · Any model, your keys · No lock-in',
  ctaPrimary: 'Get started',
  ctaSecondary: 'Request demo',
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

export type UseCase = {
  id: string;
  /** Department. Rendered mono + uppercase; it is the only differentiator. */
  tag: string;
  /** One line, bold. The job the agent does for that team. */
  headline: string;
  /** One sentence. How it does it. */
  body: string;
  /** What a person types into the thread. */
  ask: string;
  /** What lands back: a file name, a change request, or a counted result. */
  artifact: string;
};

/**
 * The use-case wheel — ten teams, one per card, rendered on a scroll-driven arc.
 *
 * ACCURACY GATE: every counterparty named in a thread line is a fictional
 * placeholder (Northwind, Globex, Initech, Umbrella, Vandelay). Never swap one
 * for a real customer, prospect, or vendor — we neither name customers nor have
 * permission to. Numbers and file names are illustrative and must stay plausible
 * rather than impressive; they are read as examples, not as published results.
 */
export const useCases = {
  eyebrow: 'Any job, any team',
  title: 'It picks up work from every team and runs it start to finish.',
  sub: 'Engineering, finance, legal, support — same agents, same isolated machines, same review before anything lands.',
  /** Micro-labels on the thread mock inside each card. */
  askLabel: 'Ask',
  artifactLabel: 'Back',
  cards: [
    {
      id: 'engineering',
      tag: 'Engineering',
      headline: 'Fixes the bug, opens the change request.',
      body: 'It reproduces the failure on its own machine, writes the patch, runs the suite, and leaves you a diff to read.',
      ask: 'Checkout 500s on expired cards. Fix it.',
      artifact: 'session/fix-checkout · 4 files · tests pass · awaiting review',
    },
    {
      id: 'finance',
      tag: 'Finance',
      headline: 'Closes the month while you sleep.',
      body: 'It reconciles the payout ledger against the bank, chases what is unpaid, and leaves the workbook ready to sign off.',
      ask: 'Close July. Flag anything that does not reconcile.',
      artifact: 'stripe-payouts-2026-07.csv · 14 invoices chased · Vandelay 31 days late',
    },
    {
      id: 'sales',
      tag: 'Sales',
      headline: 'Keeps the pipeline honest.',
      body: 'It reads the calls and the CRM together, then separates the deals that actually moved from the ones that only look alive.',
      ask: 'What really moved this week?',
      artifact: '7 deals advanced · 2 slipped · at risk: Northwind, Globex',
    },
    {
      id: 'marketing',
      tag: 'Marketing',
      headline: 'Turns the changelog into the launch.',
      body: 'It reads what actually shipped, then drafts the post, the deck and the thread in your voice, ready for you to edit.',
      ask: 'Ship the v0.11 launch off the changelog.',
      artifact: 'launch-post.md · launch-deck.pptx · 6 social drafts',
    },
    {
      id: 'support',
      tag: 'Support',
      headline: 'Triages the queue before standup.',
      body: 'It reads every ticket that came in overnight, labels and merges the duplicates, and escalates only what needs a person.',
      ask: 'Triage the overnight queue.',
      artifact: '38 tickets triaged · 11 duplicates merged · 6 escalated',
    },
    {
      id: 'recruiting',
      tag: 'Recruiting',
      headline: 'Screens every applicant the same way.',
      body: 'It runs each application against the same written rubric and shows its reasoning, so the shortlist is comparable.',
      ask: 'Screen the 42 backend applicants against the rubric.',
      artifact: '42 screened · 9 shortlisted · scorecards.xlsx',
    },
    {
      id: 'data',
      tag: 'Data',
      headline: 'Answers the question with the actual numbers.',
      body: 'It writes the query, runs it against the warehouse, sanity-checks the result, and hands back the sheet instead of a guess.',
      ask: 'Did Q2 retention improve for the self-serve cohort?',
      artifact: 'q2-cohort-retention.xlsx · +4.1pp vs Q1',
    },
    {
      id: 'legal',
      tag: 'Legal',
      headline: 'Reads the contract you do not have time to read.',
      body: 'It diffs an incoming agreement against your standard terms and marks every clause that drifts, with the reason.',
      ask: 'Redline the Initech MSA against our template.',
      artifact: '4 non-standard clauses flagged · initech-msa-redline.docx',
    },
    {
      id: 'ops',
      tag: 'Ops',
      headline: 'Watches the things nobody remembers to watch.',
      body: 'It runs on a schedule across vendors, renewals, seats and spend, and speaks up only when something needs a decision.',
      ask: 'Anything expiring in the next 30 days?',
      artifact: '3 renewals due · Umbrella auto-renews Aug 12 · vendor-review.md',
    },
    {
      id: 'exec',
      tag: 'Exec',
      headline: 'Has the brief ready before you ask.',
      body: 'It pulls the week out of the systems your teams already work in and hands you one page on Monday morning.',
      ask: 'What do I need to know before Monday?',
      artifact: 'weekly-brief-2026-07-27.pdf · 5 decisions pending',
    },
  ] satisfies readonly UseCase[],
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
