/**
 * Copy for the scroll-pinned platform stack.
 *
 * Deliberately local rather than in `translations/*.json`: this section is new
 * and the non-English locales carry no keys for it, so a translated file would
 * ship empty strings in seven languages.
 *
 * ACCURACY GATE — every line here is checked against `.claude/skills/comms`:
 *   - SOC 2 Type II is "in progress", never "compliant" or "certified".
 *   - No "egress controlled at the network" claim — nothing implements it.
 *   - No blanket "microVM isolation" — true for Platinum, not for the default
 *     provider. The sanctioned phrasing is "its own isolated machine".
 *   - Connector credentials are brokered server-side and never enter the
 *     machine. A granted runtime secret IS readable in the session, so no
 *     "never visible to the model" claim appears anywhere below.
 *   - "open source", never a licence name.
 *   - OpenCode is the harness. No other harness is named.
 */

/** Keys of the shared `Icon` map that this section is allowed to render. */
export type LogoName =
  | 'Claude'
  | 'OpenAI'
  | 'Gemini'
  | 'OpenCode'
  | 'Slack'
  | 'Notion'
  | 'Linear'
  | 'Github'
  | 'Gmail'
  | 'MicrosoftTeams';

export type StackLayer = {
  /** Stable id, also used as the DOM test hook. */
  id: string;
  /** Two-digit ordinal shown in the left gutter. */
  ordinal: string;
  name: string;
  /** One or two sentences. Shown only while the layer is expanded. */
  description: string;
  /** Brand logos for the layer, rendered as small tiles. */
  logos?: LogoName[];
  /** Mono word-chips, used where a layer has no logos to show. */
  chips?: string[];
};

export const SECTION = {
  eyebrow: 'The Kortix stack',
  title: 'Every layer an AI workforce needs, in one platform you own.',
  description:
    'Most tools hand you one layer and rent you the rest. Kortix is all of them — open source, running wherever you put it.',
  skipLabel: 'Skip section',
} as const;

export const LAYERS: StackLayer[] = [
  {
    id: 'context',
    ordinal: '01',
    name: 'Context & Connections',
    description:
      'Connect the tools your company already runs on — 3,000+ apps in a click, plus MCP, OpenAPI, GraphQL and raw HTTP. Connector credentials are brokered server-side and never enter the machine.',
    logos: ['Slack', 'MicrosoftTeams', 'Notion', 'Linear', 'Github', 'Gmail'],
  },
  {
    id: 'models',
    ordinal: '02',
    name: 'Large Language Models',
    description:
      'Any model, your own keys — or the ChatGPT, Claude or Cursor subscription you already pay for. Switch as the models improve and nothing else in the stack changes.',
    logos: ['Claude', 'OpenAI', 'Gemini'],
  },
  {
    id: 'harness',
    ordinal: '03',
    name: 'Agentic Harness',
    description:
      'The part that turns a model into an agent: planning, tool use and multi-step runs it actually finishes. Powered by OpenCode — open source, and a file in your repo you can edit.',
    logos: ['OpenCode'],
  },
  {
    id: 'computer',
    ordinal: '04',
    name: 'Agent Computer',
    description:
      'Every session runs on its own isolated machine, preloaded with your repo and tools. The agent can install, run and break anything — only what it commits survives.',
    chips: ['Its own isolated machine', 'One git branch per session', 'Thousands in parallel'],
  },
  {
    id: 'control-plane',
    ordinal: '05',
    name: 'Control Plane',
    description:
      'One place to configure, deploy and watch every agent across the organization. Work reaches the main branch only through a change request a human approves.',
    chips: ['Web', 'Slack', 'Mobile', 'CLI', 'API', 'Cron & webhooks'],
  },
  {
    id: 'governance',
    ordinal: '06',
    name: 'Security & Governance',
    description:
      'Members, groups and per-resource permissions for people and agents. Set approval gates on the actions that matter, keep a full audit trail, and self-host in your VPC or on-prem.',
    chips: ['SSO (SAML 2.0)', 'Groups & roles', 'Audit trail', 'SOC 2 Type II — in progress'],
  },
  {
    id: 'kortix',
    ordinal: '07',
    name: 'Kortix',
    description:
      'Every layer above, in one platform you own. It lives in a git repo you can read end to end, and it runs on your infrastructure or ours. That is Kortix.',
    chips: ['Open source', 'Self-hostable', 'Your models, your data'],
  },
];
