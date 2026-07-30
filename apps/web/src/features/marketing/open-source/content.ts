/**
 * Home-page "open source" section copy.
 *
 * Plain English lives here, not in `apps/web/translations/*.json`, so the copy
 * can iterate before paying the 8-locale parity gate (`pnpm i18n:translations`).
 * Wire i18n keys only once the copy is locked.
 *
 * Voice rules: the `comms` skill.
 *
 * ACCURACY GATE for this section specifically:
 *  1. NEVER name a licence. "open source" and stop — no badge, no Apache/MIT/
 *     Elastic. (`comms` §7, "On the license".)
 *  2. NO superlative. The star count is the claim; "the leading" / "the go-to" /
 *     "#1" are banned by `comms` §7 even with the number in hand.
 *  3. The star count is READ LIVE from `/api/github-stars` via
 *     `useGitHubStars`. Nothing here hardcodes it, and no other repo metric
 *     (forks, contributors, downloads) is claimed — none is read.
 *  4. "Air-gapped" is NOT what `kortix self-host start` gives you: it pulls
 *     images from docker.io and reaches a sandbox provider over egress. The
 *     `notOnBox` item states that and routes isolated topologies to
 *     `/enterprise`. Do not soften it.
 *  5. Do not claim "egress controlled at the network" — nothing implements it.
 *  6. Do not claim blanket "microVM isolation" — true for Platinum, not for
 *     Daytona, which is the default. This section names no isolation boundary.
 *  7. Every command below is the shipped CLI. `kortix self-host start`
 *     (`apps/cli/src/commands/self-host.ts`) and `kortix hosts use <host>`
 *     (`apps/cli/src/commands/hosts.ts:240`, which prints the exact string
 *     "Active host is now <host>").
 */

export const openSource = {
  eyebrow: 'Open source',
  title: 'Read every line. Then run it on your own box.',
  sub: 'Kortix is developed in the open. Clone the repo, read what you are trusting, fork it if you want it different — then run that same product on hardware you control.',

  /** The one number on this section. Read live; never hardcoded. */
  stars: {
    /** Screen-reader + fallback label. The digits themselves are animated. */
    label: 'GitHub stars on kortix-ai/suna',
    caption: 'GitHub stars on kortix-ai/suna',
    href: 'https://github.com/kortix-ai/suna',
  },

  ctaPrimary: 'Read the source',
  ctaPrimaryHref: 'https://github.com/kortix-ai/suna',
  ctaSecondary: 'Self-host it',
  ctaSecondaryHref: '/self-hosted',

  /** Two commands, both shipped. Output lines are literal CLI strings. */
  terminal: {
    title: 'your machine',
    lines: [
      '# bring the whole stack up on your own box',
      '$ kortix self-host start',
      '',
      '# point the CLI at your stack',
      '$ kortix hosts use selfhost',
      '→ Active host is now selfhost',
      '',
      '# same commands, back on the managed cloud',
      '$ kortix hosts use cloud',
      '→ Active host is now cloud',
    ],
  },

  facts: [
    {
      id: 'where',
      k: 'Where it runs',
      v: 'A laptop, a VPS, or inside your own VPC or on-prem network. One Docker Compose stack either way.',
    },
    {
      id: 'same',
      k: 'Same product',
      v: 'Self-hosting builds from the images the managed cloud runs. It is the whole platform, not a cut-down edition.',
    },
    {
      id: 'models',
      k: 'Your models',
      v: 'Any provider, your own keys — or the ChatGPT, Claude, or Cursor subscription you already pay for.',
    },
    {
      id: 'boundary',
      k: 'Where the box ends',
      v: 'Agent sandboxes run on the compute provider you configure, so the stack reaches out over egress. Fully isolated topologies are scoped with us.',
      href: '/enterprise',
      hrefLabel: 'Talk to us',
    },
  ],

  footnote: 'Read the full self-hosting story',
  footnoteHref: '/self-hosted',
} as const;
