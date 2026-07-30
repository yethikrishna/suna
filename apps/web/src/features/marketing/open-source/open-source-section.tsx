'use client';

import { Reveal } from '@/components/home/reveal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/marketing/button';
import { Icon } from '@/features/icon/icon';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { openSource } from './content';
import { StarCount } from './star-count';
import { Terminal } from './terminal';

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
    <div className="border-border border-t pt-4">
      <dt className="text-muted-foreground font-mono text-[10px] tracking-widest uppercase">{k}</dt>
      <dd className="text-muted-foreground mt-2 text-sm leading-relaxed">
        {v}
        {href && hrefLabel ? (
          <Link
            href={href}
            className="text-foreground mt-2 block w-fit underline decoration-current/30 underline-offset-4 transition-colors hover:decoration-current"
          >
            {hrefLabel} →
          </Link>
        ) : null}
      </dd>
    </div>
  );
}

/**
 * Home-page section 5 · open source.
 *
 * Its job is to prove two things a reader cannot verify from a claim: the code
 * is genuinely readable (the live star count and a link straight into the
 * repo), and it is genuinely runnable on your own hardware (the two shipped
 * commands, plus what self-hosting does and does not include).
 *
 * The number is the only large numeral on the page, and it is earned: it is
 * read live from `/api/github-stars`, never hardcoded. Copy rules and the
 * accuracy gate live next door in `content.ts`.
 */
export function OpenSourceSection(): ReactNode {
  return (
    <section id="open-source" className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
      <Reveal>
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          {/* left · the claim, and the number that backs it */}
          <div className="flex min-w-0 flex-col lg:col-span-5">
            <Badge variant="kortix" className="self-start rounded">
              {openSource.eyebrow}
            </Badge>

            <h2 className="text-foreground mt-6 text-3xl font-medium tracking-tight text-balance sm:text-4xl">
              {openSource.title}
            </h2>

            <p className="text-muted-foreground mt-4 text-base leading-relaxed">{openSource.sub}</p>

            {/* pushes the numeral to the foot of the column so it lines up with
                the terminal beside it on wide screens */}
            <div aria-hidden className="hidden grow lg:block" />

            <StarCount
              caption={openSource.stars.caption}
              className="border-border mt-10 border-t pt-10"
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
          <div className="min-w-0 lg:col-span-7">
            <Terminal title={openSource.terminal.title} lines={openSource.terminal.lines} />

            <Link
              href={openSource.footnoteHref}
              className="text-muted-foreground hover:text-foreground mt-8 inline-flex font-mono text-[10px] tracking-widest uppercase transition-colors"
            >
              {openSource.footnote} →
            </Link>
          </div>
        </div>

        {/* under both · what self-hosting is, and where it stops */}
        <dl className="mt-14 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
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
      </Reveal>
    </section>
  );
}
