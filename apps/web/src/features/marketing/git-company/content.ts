/**
 * Home-page section: one `kortix.yaml` + one git repo = the whole company.
 *
 * Copy lives here, not in `apps/web/translations/*.json`, so it can iterate
 * before paying the 8-locale parity gate (`pnpm i18n:translations`).
 *
 * Voice rules: the `comms` skill.
 *
 * ACCURACY GATE — this section must agree with `/company-as-code`, which is the
 * long form of the same argument. Ground truth for every line of YAML and every
 * path below:
 *   - `packages/starter/templates/base/kortix.yaml`
 *   - `packages/manifest-schema/src/index.v2.ts`
 *   - `apps/web/src/features/marketing/company-as-code/content.ts`
 * Rules that the schema itself enforces, and that this copy must not break:
 *   - `channels:` is NOT a manifest key in schema version 2 — the validator
 *     rejects it outright. Channel routing is live project state. Never show a
 *     `channels:` block here.
 *   - Agent behaviour (model, mode, prompt, permission) cannot live in
 *     `kortix.yaml`; the validator moves those keys to
 *     `.kortix/opencode/agents/<name>.md`. The manifest grants only.
 *   - `env.required` is advisory. It never blocks a session start, so never
 *     write that it does.
 *   - Grants omitted from an agent block resolve to `none` in version 2.
 *   - `env` and `agents.<name>.secrets` carry secret NAMES and GRANTS. Values
 *     never enter the repo.
 * Wording rules: "agent computer" / "cloud computer" / "sandbox", never
 * "container". Never name a licence — "open source" and stop. The harness is
 * OpenCode. Northwind is a placeholder, not a customer.
 */

export const gitCompany = {
  eyebrow: 'One repo',
  title: 'One kortix.yaml. One repo. The whole company.',
  sub: 'The agents, the skills they share, what the company has learned, the connectors, the triggers, the secret grants — all of it is files on a branch you own.',

  /** The centrepiece. Real version-2 fields only — do not invent one. */
  yaml: {
    title: 'northwind/kortix.yaml',
    caption:
      'The Kortix layer, at the repo root. The OpenCode config it points at is the runtime the agents think in. Everything past those two is files.',
    lines: [
      'kortix_version: 2',
      'runtime: opencode',
      'default_agent: kortix',
      '',
      '# Past this line, the company is files in the repo.',
      'opencode:',
      '  config_dir: .kortix/opencode',
      '',
      '# Secret names. The values never enter the repo.',
      'env:',
      '  required: [STRIPE_API_KEY]',
      '',
      '# Reach into the outside world.',
      'connectors:',
      '  - slug: gmail-read',
      '    provider: pipedream',
      '    app: gmail',
      '',
      '# Work that starts itself, at 03:00 UTC.',
      'triggers:',
      '  - slug: memory-reflector',
      '    type: cron',
      '    agent: memory-reflector',
      '    cron: "0 0 3 * * *"',
      '    enabled: false            # ships off; you switch it on',
      '',
      '# What each agent may touch. Omit one and it is none.',
      'agents:',
      '  kortix:',
      '    connectors: all',
      '    secrets: all',
      '    skills: all',
      '    kortix_cli: all',
      '',
      '  invoice-clerk:',
      '    connectors: [gmail-read]',
      '    secrets: [STRIPE_API_KEY]',
      '    skills: [reconcile-invoices]',
      '    kortix_cli: [project.cr.open]',
    ],
  },

  /**
   * Real paths from the shipped starter template, identical to the tree on
   * `/company-as-code`. Do not invent a directory.
   */
  tree: {
    title: 'northwind — main',
    entries: [
      { path: 'northwind/', note: 'the repo, and the company', depth: 0 },
      { path: 'kortix.yaml', note: 'the Kortix layer', depth: 1 },
      { path: '.kortix/', note: '', depth: 1 },
      { path: 'memory/', note: '', depth: 2 },
      { path: 'MEMORY.md', note: 'what it has learned', depth: 3 },
      { path: 'opencode/', note: '', depth: 2 },
      { path: 'opencode.jsonc', note: 'the runtime', depth: 3 },
      { path: 'agents/', note: 'one persona per agent', depth: 3 },
      { path: 'kortix.md', note: '', depth: 4 },
      { path: 'invoice-clerk.md', note: '', depth: 4 },
      { path: 'skills/', note: 'how the job gets done', depth: 3 },
      { path: 'reconcile-invoices/', note: '', depth: 4 },
      { path: 'SKILL.md', note: '', depth: 5 },
      { path: 'tools/', note: 'the ones you wrote', depth: 3 },
      { path: 'plugins/', note: 'and the ones you installed', depth: 3 },
      { path: 'src/', note: 'and the rest of your repo', depth: 1 },
    ],
  },

  /** Exactly three. Each one is something git already does. */
  points: [
    {
      id: 'grep',
      k: 'grep it',
      v: 'Every prompt, skill, grant and remembered fact is text in one repo. One search answers the question.',
    },
    {
      id: 'diff',
      k: 'diff it',
      v: 'Every change is a commit with an author, a timestamp and a diff. Undo is git revert.',
    },
    {
      id: 'clone',
      k: 'clone it',
      v: 'It is a git repo. Fork it for a second business unit, hand it to a new team, or walk out the door with it.',
    },
  ],

  ctaLabel: 'See the whole argument',
  ctaHref: '/company-as-code',
  microline: 'kortix init · kortix ship · one repo you own',
} as const;
