/**
 * Scroll-synced platform section. Each step is one layer of the stack, in the
 * order a reader needs them: your tools first, then the model, the harness that
 * drives it, the machine it runs on, the plane you operate it from, and the
 * governance around all of it.
 *
 *   01 Context & Connections → every tool your company runs on, connected once
 *   02 Large Language Models → any model, your keys, or your own hardware
 *   03 Agentic Harness       → planning and tool use, powered by OpenCode
 *   04 Agent Computer        → one isolated machine and git branch per session
 *   05 Control Plane         → one place to run and watch all of it
 *   06 Security & Governance → permissions, secrets, audit, self-hosting
 *
 * Three bullets per step, each a fact rather than a claim. `id` values are
 * consumed by `StepShowcaseFor` in how-it-works.tsx.
 */

/**
 * Kept here rather than in `translations/*.json`: the section changed from a
 * request-to-finished-work walkthrough into the platform layers, and the seven
 * non-English locales still hold the old translated heading. Local copy avoids
 * shipping a heading that contradicts the section in every other language.
 */
export const SECTION = {
  title: 'Every layer an AI workforce needs — unified.',
  description:
    'Most tools hand you one layer and rent you the rest. Kortix is all of them: your tools, any model, the harness, the machine it runs on, and the governance around it. Open source, running wherever you put it.',
} as const;

export type Step = {
  id: string;
  step: string;
  label: string;
  title: string;
  description: string;
  bullets: string[];
};

export const STEPS: Step[] = [
  {
    id: 'connect',
    step: '01',
    label: 'Context & Connections',
    title: 'Every tool your company runs on.',
    description:
      'Connect Slack, docs, tickets, CRM, databases and code once — for the whole company, with scoped access.',
    bullets: [
      '3,000+ apps in a click, plus MCP, OpenAPI, GraphQL and raw HTTP',
      'Credentials stay brokered by Kortix and never enter a session',
      'Scope every tool per project, per agent, per connector',
    ],
  },
  {
    id: 'ask',
    step: '02',
    label: 'Large Language Models',
    title: 'Run any model. Keep your keys.',
    description:
      'Kortix is model-agnostic, so every agent uses the best model for the job and you switch as they improve.',
    bullets: [
      'Bring your own API key from any provider',
      'Or the ChatGPT, Claude or Cursor subscription you already pay for',
      'Or your own models, running on your own hardware',
    ],
  },
  {
    id: 'skills',
    step: '03',
    label: 'Agentic Harness',
    title: 'The part that turns a model into an agent.',
    description:
      'Planning, tool use and multi-step runs it actually finishes — powered by OpenCode, and fully customizable.',
    bullets: [
      'How your agents think is a file in your repo you can edit',
      'Skills encode how your company does a job, reused every session',
      'Not locked in: the harness is open source, like the rest of it',
    ],
  },
  {
    id: 'work',
    step: '04',
    label: 'Agent Computer',
    title: 'Every session gets its own computer.',
    description:
      'Its own isolated Linux machine, pre-configured with your repo and tools. Nothing to set up, no local machine involved.',
    bullets: [
      'Its own git branch, so every change is versioned and reversible',
      'The agent can install, run and break anything — only commits survive',
      'Thousands run in parallel with no crossover between them',
    ],
  },
  {
    id: 'review',
    step: '05',
    label: 'Control Plane',
    title: 'One place to run all of it.',
    description:
      'Configure, deploy, watch and operate every agent across the organization — and reach it from wherever your team already works.',
    bullets: [
      'Web, Slack, Teams, mobile, CLI and API all start the same work',
      'Cron and signed webhooks start sessions without anyone asking',
      'Work lands on main only through a change request a human approves',
    ],
  },
  {
    id: 'memory',
    step: '06',
    label: 'Security & Governance',
    title: 'Built to survive a security review.',
    description:
      'SSO, groups and role-based access come built in, with per-resource permissions for people and agents.',
    bullets: [
      'Connector credentials brokered server-side, so they never enter the machine',
      'Full audit trail, with approval gates on the actions that matter',
      'Self-host in your VPC or on-prem · SOC 2 Type II in progress',
    ],
  },
];
