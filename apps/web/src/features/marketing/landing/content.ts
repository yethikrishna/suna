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
export const hero = {
  title: 'The open-source AI Management System',
  sub: 'Your agents, their skills, your company memory and every integration in one platform. Any model, your keys, self-hosted or managed cloud.',
  ctaPrimary: 'Get started',
  ctaSecondary: 'Request demo',
  trust: 'Open source · Any model, your keys · Self-host, VPC, or on-prem',
} as const;

/** The eyebrow renders as a row with the two competitor marks, so its parts
 *  live separately. "leading" is the one superlative we use, and it rests on
 *  20,000+ GitHub stars — cite that number if the claim is ever challenged.
 *  Never add "better"; extensibility belongs in the sub, as a fact. */
export const heroEyebrow = {
  lead: 'The leading open-source alternative to',
  rivals: [
    { id: 'cowork', icon: 'Claude', label: 'Claude Cowork' },
    { id: 'chatgpt-work', icon: 'OpenAI', label: 'ChatGPT Work' },
  ],
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
  /**
   * ACCURACY: do NOT restore "the model never sees them". A granted runtime
   * secret is a real env value inside the session and is readable by any
   * command the agent runs — see docs/ENV_SECRET_EXPOSURE_BASELINE.md. The
   * true, narrower claim is the one below: CONNECTOR credentials are brokered
   * server-side and never enter the machine.
   * Do NOT restore "scoped per person and group" either — retired by migration
   * 20260706_secrets_v2_identifier_model.sql.
   */
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
      title: 'Merging is a separate power',
      body: 'Agents open change requests. Merge is default-deny for an agent and granted explicitly in kortix.yaml — so an agent cannot widen its own reach without a change someone else approves.',
    },
    {
      id: 'keys',
      title: 'Connector keys never enter the machine',
      body: 'Third-party credentials stay server-side and are brokered through one scoped token, so the raw key never reaches the sandbox. Delivery is gated by role and by the agent grant.',
    },
    {
      id: 'deploy',
      title: 'Yours, down to the metal',
      // ACCURACY: never restore "air-gapped". `kortix self-host start` pulls
      // images from docker.io and reaches a sandbox provider over egress, so a
      // fully disconnected install is not a shipped capability.
      body: 'Kortix Cloud, your own VPC, or your own on-prem network. It is open source, so you can read every line of what you are trusting.',
    },
  ],
} as const;

/**
 * Semantic tone inside an artifact. It encodes something true about the work
 * product — a score band, a delta's direction, how late an invoice is — and is
 * the only place colour is allowed in this section. The card frame, borders,
 * type and spacing stay on the achromatic tokens.
 */
export type ArtifactTone = 'up' | 'down' | 'warn' | 'info';

export type SheetRow = {
  cells: readonly string[];
  /** Colours the cell at `toneColumn`. Omit for a plain row. */
  tone?: ArtifactTone;
  /** Renders as a totals row: heavier weight, top rule. */
  total?: boolean;
};

/**
 * The work product a card shows. It is rendered as markup, never as an image of
 * a screen — a card must never imply a Kortix UI that does not exist. What is
 * mocked is the ARTIFACT (a sheet, a diff, an outreach draft), which is a sample
 * of the agent's output, not a picture of the product. Each `kind` is formatted
 * like the file type it claims to be, not as prose in a box.
 */
export type UseCaseArtifact = {
  /** File name the work lands as. Rendered mono in the frame's title bar. */
  file: string;
  /** One line under the body: what the artifact adds up to. */
  footer: string;
} & (
  | {
      kind: 'sheet';
      columns: readonly string[];
      /** CSS percentages, one per column. Sized so no cell clips. */
      widths: readonly string[];
      /** Per-column alignment. Text reads left, figures read right. */
      aligns: readonly ('left' | 'right')[];
      rows: readonly SheetRow[];
      /** Index of the column a row's `tone` colours. Defaults to the last. */
      toneColumn?: number;
    }
  | {
      kind: 'diff';
      /** A leading `+` or `-` renders the line as an added / removed row. */
      lines: readonly string[];
      stat: string;
    }
  | {
      kind: 'thread';
      to: string;
      time: string;
      subject: string;
      lines: readonly string[];
      /** The hold state. Nothing sends until a person approves it. */
      status: string;
    }
  | {
      kind: 'checks';
      items: readonly { label: string; value: string; tone: ArtifactTone }[];
    }
  | {
      kind: 'chart';
      caption: string;
      /** `pct` is the bar length as a percentage of the track. */
      bars: readonly { label: string; value: string; pct: number; tone: ArtifactTone }[];
    }
);

export type UseCase = {
  id: string;
  /** Department. Rendered mono + uppercase; it is the only differentiator. */
  tag: string;
  /** One line, bold. The job the agent does for that team. */
  headline: string;
  /** One sentence. How it does it. */
  body: string;
  /** What lands back, shown on the card. */
  artifact: UseCaseArtifact;
};

/**
 * The use-case wheel — ten jobs, one per card, rendered on a scroll-driven arc.
 *
 * THE BAR A CARD HAS TO CLEAR. A job a company already pays somebody to do, that
 * an agent with its own Linux machine, a git repo and connectors into the
 * company's tools can genuinely run end to end, whose output is one concrete
 * artifact. If you cannot name the artifact in three words, it is not a card.
 * Judgement-bound, liability-heavy work — contract review is the obvious one —
 * fails on credibility no matter how good the demo looks, and stays off.
 *
 * Each card shows that OUTPUT, not the Kortix UI. Four accuracy rules govern
 * everything below and none of them is negotiable.
 *
 * 1. COUNTERPARTIES ARE FICTIONAL. Northwind, Globex, Initech, Umbrella and
 *    Vandelay only. Never a real customer, prospect or vendor — we neither name
 *    customers nor have permission to. Candidates are numbers, never names.
 * 2. NO CLAIM ABOUT KORTIX ITSELF. Numbers inside an artifact are sample data
 *    belonging to a fictional company and are fine. A number that reads as a
 *    Kortix metric, benchmark or certification is not, and must not appear here.
 * 3. ONLY CAPABILITIES WE SHIP. Every trigger and tool named here exists today:
 *    schedules, connectors, Slack, change requests. Do not add a card that needs
 *    something we do not ship.
 * 4. NEVER A FAKE SCREENSHOT. Artifacts are markup. Do not swap one for an image
 *    of a product surface that does not exist.
 *
 * Four artifacts quote the demo project's own committed workspace and were read
 * back from its `main` branch, not typed from memory:
 *   finance   -> finance/fy26-budget.xlsx      (variance = half of plan − actual)
 *   marketing -> marketing/content-calendar.csv
 *   data      -> sales/win-loss-analysis.xlsx  (win rate = won / (won + lost))
 *   ops       -> ops/vendor-contracts.docx
 * The arithmetic in those four is derived from the columns beside it. If you
 * edit one, re-derive the other.
 */
export const useCases = {
  eyebrow: 'Any job, any team',
  title: 'It picks up work from every team and runs it start to finish.',
  sub: 'Outbound, error triage, the monthly close, the Monday report — real jobs, run on real machines, with a person approving what lands.',
  /** Micro-label in the corner of the artifact frame. */
  artifactLabel: 'Output',
  cards: [
    {
      id: 'outbound',
      tag: 'Sales',
      headline: 'Finds the lead, writes the note.',
      body: 'It searches for accounts matching your profile, enriches them, and drafts a note per lead — then sends through your own outreach tool, once you approve.',
      artifact: {
        kind: 'thread',
        file: 'outbound/northwind-01.eml',
        to: 'ops@northwind.example',
        time: '08:12',
        subject: 'Your four new platform hires',
        lines: [
          'Saw you are hiring four platform engineers.',
          'Teams at that stage lose about a week a month to',
          'manual reconciliation. We built an agent that closes',
          'that loop and shows its working. Worth twenty minutes?',
        ],
        status: 'Draft · held for approval',
        footer: '24 leads enriched · 3 drafted · 0 sent',
      },
    },
    {
      id: 'errors',
      tag: 'Engineering',
      headline: 'Triages the errors, fixes the top one.',
      body: 'It reads every error the day threw, groups them, reproduces the worst on its own machine, patches it and opens a change request.',
      artifact: {
        kind: 'diff',
        file: 'fix-checkout-expiry.diff',
        lines: [
          ' app/checkout/charge.ts',
          '-if (card.expMonth < now.getMonth()) {',
          '+if (isExpired(card, now)) {',
          '+  return fail(402, "card_expired");',
          ' }',
        ],
        stat: '+2 −1',
        footer: '9 error groups · top one fixed · 118 tests pass',
      },
    },
    {
      id: 'support',
      tag: 'Support',
      headline: 'Drafts the reply from your own docs.',
      body: 'It reads the ticket, finds the answer in your repository rather than inventing one, and leaves a reply with the source attached.',
      artifact: {
        kind: 'thread',
        file: 'support/T-4417-reply.md',
        to: 'Ticket T-4417 · billing',
        time: '06:41',
        subject: 'Re: charged twice for July',
        lines: [
          'You were charged once. The second line is the',
          'proration from your seat change on 14 July, which',
          'settles against next month. Here is the breakdown.',
        ],
        status: 'Source · docs/billing/proration.md',
        footer: '38 tickets triaged · 27 drafted · 6 escalated',
      },
    },
    {
      id: 'close',
      tag: 'Finance',
      headline: 'Closes the month while you sleep.',
      body: 'It reconciles the ledger against the bank, works out the variance per cost centre, and writes the notes that explain it.',
      artifact: {
        kind: 'sheet',
        file: 'finance/fy26-budget.xlsx',
        columns: ['Cost centre', 'H1 plan', 'Actual', 'Variance'],
        widths: ['36%', '22%', '22%', '20%'],
        aligns: ['left', 'right', 'right', 'right'],
        rows: [
          { cells: ['R&D — platform', '1,225,000', '1,182,400', '+42,600'], tone: 'up' },
          { cells: ['Go-to-market', '810,000', '742,800', '+67,200'], tone: 'up' },
          { cells: ['Security & compliance', '180,000', '198,600', '−18,600'], tone: 'down' },
          { cells: ['Brand & content', '240,000', '219,400', '+20,600'], tone: 'up' },
          { cells: ['Total', '2,455,000', '2,343,200', '+111,800'], total: true },
        ],
        footer: '1 cost centre over plan · variance notes written',
      },
    },
    {
      id: 'report',
      tag: 'Data',
      headline: 'Builds Monday’s report from the warehouse.',
      body: 'It runs the query, checks the result against last week, draws the chart and posts the whole thing to the channel before you are up.',
      artifact: {
        kind: 'chart',
        file: 'reports/win-rate-weekly.md',
        caption: 'Win rate by quarter',
        bars: [
          { label: 'Q3 25', value: '36.7%', pct: 37, tone: 'down' },
          { label: 'Q4 25', value: '44.7%', pct: 45, tone: 'warn' },
          { label: 'Q1 26', value: '54.2%', pct: 54, tone: 'info' },
          { label: 'Q2 26', value: '66.7%', pct: 67, tone: 'up' },
        ],
        footer: 'Posted to #revenue · top loss reason: price',
      },
    },
    {
      id: 'content',
      tag: 'Marketing',
      headline: 'Runs the content pipeline end to end.',
      body: 'It researches the topic, drafts the piece, puts it through review and schedules it — and tells you what is stuck.',
      artifact: {
        kind: 'sheet',
        file: 'marketing/content-calendar.csv',
        columns: ['Channel', 'Title', 'Status'],
        widths: ['20%', '56%', '24%'],
        aligns: ['left', 'left', 'right'],
        toneColumn: 2,
        rows: [
          { cells: ['Blog', 'A company is a git repository', 'published'], tone: 'up' },
          { cells: ['X', 'Launch thread — 9 posts', 'scheduled'], tone: 'info' },
          { cells: ['Blog', 'Isolation, permissions, audit', 'draft'], tone: 'warn' },
          { cells: ['YouTube', 'Build an AI department', 'filming'], tone: 'info' },
          { cells: ['Blog', 'Bring your own model', 'outline'], tone: 'warn' },
        ],
        footer: '2 published this week · 3 waiting on a human',
      },
    },
    {
      id: 'compete',
      tag: 'Product',
      headline: 'Watches every competitor for you.',
      body: 'It checks their pricing, changelog and positioning on a schedule and sends one digest with only what actually moved.',
      artifact: {
        kind: 'checks',
        file: 'research/weekly-digest.md',
        items: [
          { label: 'Northwind · pricing page', value: 'seats +12%', tone: 'warn' },
          { label: 'Globex · changelog', value: '3 releases', tone: 'info' },
          { label: 'Initech · positioning', value: 'new category', tone: 'info' },
          { label: 'Umbrella · no change', value: '30 days', tone: 'up' },
        ],
        footer: '4 tracked · 3 moved · posted to #competitive',
      },
    },
    {
      id: 'screening',
      tag: 'Recruiting',
      headline: 'Screens every applicant the same way.',
      body: 'It runs each application against the same written bar, shows the reasoning, and hands back a shortlist you can compare.',
      artifact: {
        kind: 'sheet',
        file: 'hiring/backend-screen.xlsx',
        columns: ['Applicant', 'Signal', 'Score', 'Call'],
        widths: ['26%', '34%', '18%', '22%'],
        aligns: ['left', 'left', 'right', 'right'],
        toneColumn: 3,
        rows: [
          { cells: ['#041', 'Ran infra at scale', '86', 'advance'], tone: 'up' },
          { cells: ['#017', 'Strong, no on-call', '74', 'advance'], tone: 'up' },
          { cells: ['#033', 'Depth unclear', '58', 'hold'], tone: 'warn' },
          { cells: ['#009', 'No systems work', '31', 'pass'], tone: 'down' },
        ],
        footer: '42 screened · 9 shortlisted · reasoning attached',
      },
    },
    {
      id: 'dependencies',
      tag: 'Security',
      headline: 'Sweeps the dependencies every night.',
      body: 'It checks what you ship against the advisory feeds, patches what can be patched, and raises the rest as a change request.',
      artifact: {
        kind: 'checks',
        file: 'security/advisory-sweep.md',
        items: [
          { label: 'tar 6.1.0 → 6.2.1', value: 'patched', tone: 'up' },
          { label: 'cross-fetch 3.1.4 → 3.1.8', value: 'patched', tone: 'up' },
          { label: 'sharp 0.32.1', value: 'major bump', tone: 'warn' },
          { label: 'legacy-auth 1.4.0', value: 'no fix yet', tone: 'down' },
        ],
        footer: '2 patched automatically · 2 raised for a decision',
      },
    },
    {
      id: 'renewals',
      tag: 'Ops',
      headline: 'Watches what nobody remembers to watch.',
      body: 'It runs on a schedule across vendors, renewals, seats and spend, and speaks up only when something needs a decision.',
      artifact: {
        kind: 'checks',
        file: 'ops/vendor-contracts.docx',
        items: [
          { label: 'Vandelay Comms · telephony', value: '2026-09-30', tone: 'down' },
          { label: 'Initech Security · pen test', value: '2026-11-15', tone: 'warn' },
          { label: 'Globex Cloud · compute', value: '2027-01-31', tone: 'up' },
          { label: 'Umbrella Data · EU residency', value: '2027-03-01', tone: 'up' },
        ],
        footer: '4 renewals tracked · Vandelay is the next decision',
      },
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
      body: 'Every agent gets its own computer — its own isolated Linux machine, pre-set-up with your repo, tools and dependencies. It can install, run and break anything. Nothing to configure, no local machine required.',
      chips: ['One machine per session', 'Pre-configured', 'Thousands in parallel'],
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
