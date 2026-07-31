'use client';

import { Reveal } from '@/components/home/reveal';
import { Button } from '@/components/ui/marketing/button';
import { Icon } from '@/features/icon/icon';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { openSource } from './content';
import { StarCount } from './star-count';
import { Terminal } from './terminal';

/**
 * One line of the ledger: label left, one sentence right, hairline above.
 *
 * At panel width the sentence lands on a single line, so the four rows read as
 * a tally rather than four wrapped footnotes. Below `lg` the label stacks on
 * top of the sentence.
 */
function Fact({
  k,
  v,
  href,
  hrefLabel,
}: {
  k: string;
  v: string;
  href?: string;
  hrefLabel?: string;
}): ReactNode {
  return (
    <div className="border-border grid gap-2 border-t px-6 py-4 sm:px-10 lg:grid-cols-12 lg:items-baseline lg:gap-8">
      <dt className="text-foreground font-mono text-[10px] tracking-widest uppercase lg:col-span-3">
        {k}
      </dt>
      <dd className="text-muted-foreground text-sm leading-relaxed lg:col-span-9">
        {v}
        {href && hrefLabel ? (
          <Link
            href={href}
            className="text-foreground duration-fast ml-2 inline-flex underline decoration-current/30 underline-offset-4 transition-colors hover:decoration-current"
          >
            {hrefLabel} →
          </Link>
        ) : null}
      </dd>
    </div>
  );
}

/**
 * Home-page open-source section — the last argument before the closing CTA.
 *
 * Its job is to prove two things a reader cannot verify from a claim: the code
 * is genuinely readable (the live star count and a link straight into the
 * repo), and it is genuinely runnable on your own hardware (the two shipped
 * commands, plus what self-hosting does and does not include).
 *
 * Because it now sits between the trust card and the CTA card, it is drawn as
 * a slab of its own rather than flat page — otherwise it reads as the gap
 * between two surfaces. `bg-card` keeps that slab honest in both themes: a
 * light panel on the light page, a lifted dark panel on the dark one, never a
 * white rectangle punched into a dark page.
 *
 * NO WALLPAPER HERE, and that is deliberate. The brandmark wallpaper
 * (`WallpaperBackground wallpaperId="brandmark"`, `/kortix-brandmark-bg.svg`)
 * was tried at five sizes and positions inside this panel. It does not
 * survive the scale change: the mark is a 1px stroke of a hollow asterisk cut
 * for a full viewport, so at panel width every setting that is faint enough to
 * sit under type renders as an unidentifiable smudge, and every setting strong
 * enough to read as the Kortix mark draws a line through the headline. A
 * watermark that reads as an artifact is worse than no watermark. The other
 * candidate — `KortixGrid` (`components/ui/marketing/gridder.tsx`), the tiled
 * repeating "kortix" field — is ruled out twice over: it is the signature of
 * the closing CTA that sits directly below this section, and it paints a
 * `kortix-green`/`kortix-purple` gradient into a section that carries no
 * colour. What the older design actually contributed — the slab, the hairline
 * ledger, and the centred closing line — is all here.
 *
 * The number is the only large numeral on the page, and it is earned: it is
 * read live from `/api/github-stars`, never hardcoded. Copy rules and the
 * accuracy gate live next door in `content.ts`.
 */
export function OpenSourceSection(): ReactNode {
  return (
    <section id="open-source" className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
      <Reveal>
        <div className="border-border bg-card overflow-hidden rounded-sm border">
          <div className="grid gap-12 px-6 py-12 sm:px-10 lg:grid-cols-12 lg:gap-16">
            {/* left · the claim, and the number that backs it */}
            <div className="flex min-w-0 flex-col lg:col-span-5">
              <p className="text-muted-foreground font-mono text-[10px] tracking-widest uppercase">
                {openSource.eyebrow}
              </p>

              <h2 className="text-foreground mt-5 text-3xl font-medium tracking-tight text-balance sm:text-4xl">
                {openSource.title}
              </h2>

              <p className="text-muted-foreground mt-4 text-base leading-relaxed">
                {openSource.sub}
              </p>

              <StarCount
                caption={openSource.stars.caption}
                className="border-border mt-8 border-t pt-8"
              />

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button size="sm" variant="outline" asChild>
                  <a href={openSource.ctaPrimaryHref} target="_blank" rel="noreferrer">
                    <Icon.Github className="size-4" />
                    {openSource.ctaPrimary}
                  </a>
                </Button>
                <Button size="sm" asChild>
                  <Link href={openSource.ctaSecondaryHref}>{openSource.ctaSecondary}</Link>
                </Button>
              </div>
            </div>

            {/* right · run it yourself, in two commands */}
            <div className="flex min-w-0 flex-col lg:col-span-7">
              {/* `bg-popover`, not the Terminal's own `bg-card`: on a `bg-card`
                  panel the window chrome would be the same tone as the slab it
                  sits on. */}
              <Terminal
                title={openSource.terminal.title}
                lines={openSource.terminal.lines}
                className="bg-popover"
              />

              {/* `mt-auto` foots the link to the column, so it lands level with
                  the buttons opposite instead of floating mid-column. */}
              <Link
                href={openSource.footnoteHref}
                className="text-muted-foreground hover:text-foreground duration-fast mt-auto inline-flex w-fit pt-8 font-mono text-[10px] tracking-widest uppercase transition-colors"
              >
                {openSource.footnote} →
              </Link>
            </div>
          </div>

          {/* the ledger · what self-hosting is, and where it stops */}
          <dl>
            {openSource.facts.map((fact) => (
              <Fact
                key={fact.id}
                k={fact.k}
                v={fact.v}
                href={'href' in fact ? fact.href : undefined}
                hrefLabel={'hrefLabel' in fact ? fact.hrefLabel : undefined}
              />
            ))}
          </dl>

          {/* the hand-off into the closing CTA */}
          <p className="border-border text-foreground border-t px-6 py-7 text-center text-base leading-relaxed text-balance sm:px-10 sm:text-lg">
            {openSource.closer}
          </p>
        </div>
      </Reveal>
    </section>
  );
}
