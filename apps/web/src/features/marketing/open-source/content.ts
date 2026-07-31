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
 *  8. Do NOT claim you can fork someone else's company / project, or publish
 *     your own. The `registry:project` machinery ships, but the catalog holds
 *     exactly one project item — Kortix's own starter
 *     (`apps/api/src/marketplace/catalog.ts:487` `buildStarterKitProjectItem`;
 *     `packages/starter/src/index.test.ts:459` pins the template list to `[]`),
 *     and there is no publish route at all
 *     (`apps/api/src/marketplace/index.ts` is read-only + admin source
 *     registration). This section makes neither claim.
 *  9. Do NOT write that secrets are invisible to the model. A granted runtime
 *     secret is a real env value any command in the session can read
 *     (`docs/ENV_SECRET_EXPOSURE_BASELINE.md`). This section claims nothing
 *     about secrets.
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

  /**
   * The ledger under the proof: one label, one sentence. Rows, not a four-up
   * grid, because at full panel width each line lands in one read — and
   * because this section now closes the argument, so it should tally up.
   */
  facts: [
    {
      id: 'where',
      k: 'Where it runs',
      v: 'A laptop, a VPS, or inside your own VPC or on-prem network — one Docker Compose stack either way.',
    },
    {
      id: 'same',
      k: 'Same product',
      v: 'Self-hosting builds from the images the managed cloud runs, so it is the whole platform, not a cut-down edition.',
    },
    {
      id: 'models',
      k: 'Your models',
      v: 'Any provider and your own keys, or the ChatGPT, Claude, or Cursor subscription you already pay for.',
    },
    {
      id: 'boundary',
      k: 'Where the box ends',
      v: 'Agent sandboxes run on the compute provider you configure, so the stack reaches out over egress. Fully isolated topologies are scoped with us.',
      href: '/enterprise',
      hrefLabel: 'Talk to us',
    },
  ],

  /**
   * The hand-off into the closing CTA, carried over from the older section the
   * founder pointed at. It is the manifesto position stated plainly — see the
   * `comms` skill §2 ("renting your company back from a model lab") and the §7
   * approved line "we don't rent your company back to you".
   */
  closer: 'Your company’s brain should not live in twelve tools that lease it back to you.',

  footnote: 'Read the full self-hosting story',
  footnoteHref: '/self-hosted',
} as const;
