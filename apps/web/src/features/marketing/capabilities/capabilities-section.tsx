'use client';

import { Reveal } from '@/components/home/reveal';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { entries, heading, rules, type Entry } from './content';

/**
 * Home-page long-form section — "The long version".
 *
 * WHY IT EXISTS. Everything else on the home page is something to look at: a
 * hero video, a stack of layer cards, a use-case wheel, a slab, a dark trust
 * card. None of it can be read. A reader who wants substance had nowhere to go
 * except a sub-page they have not been given a reason to open yet. This section
 * is that reason — eight entries of real prose, each one an index into the page
 * that carries the long form, closing on the grant mechanics that apply to all
 * eight.
 *
 * OVERVIEW AT THE TOP, DETAIL AT THE FOOT. An entry is an overview and has to
 * read like one. When the deny-by-default / agent-≤-human mechanics sat inside
 * entry 02 they made the second thing a reader met the densest paragraph on the
 * page, so they moved to the `rules` block at the end — which also replaced a
 * self-vouching disclaimer that should never have been there.
 *
 * WHY IT IS NOT A CARD GRID. A fourth grid of three-word tiles would have added
 * nothing the layer stack does not already do, and it would have been the
 * obvious wrong answer: a card is a thing you scan, and this is a thing you
 * read. So there is not a single box, border-radius or fill in here. The
 * structure is typographic — a hairline per entry, a mono number and label in
 * the rail, and the prose in a column capped to a comfortable measure.
 *
 * WHY IT IS NARROWER THAN THE PAGE. The section shell is the page-standard
 * `mx-auto max-w-7xl px-6`, but the document inside it is `max-w-3xl` and the
 * body column inside THAT is capped at 32rem — measured at 67 characters per
 * line at the base size, inside the 65–70 a reader can hold. Long-form text set
 * to the full 6xl grid is unreadable, and the narrowing is what signals "this
 * one is different, slow down".
 *
 * Copy, and the accuracy gate every line of it had to pass, live in
 * `content.ts`. Read that file before editing a word here.
 */

/* ── mono tokens ───────────────────────────────────────────────────────────
   Product nouns, config keys, paths and template tokens are set in mono per
   the brand rules. Keeping the copy in `content.ts` as plain strings (rather
   than JSX) is what lets it stay reviewable and, later, translatable — so the
   markup is applied here, from one explicit list. Ordered longest-first so
   `kortix.yaml` can never be eaten by a shorter alternative. */
const MONO =
  /(\{\{ [a-z._*]+ \}\}|kortix\.yaml|kortix init|kortix ship|SKILL\.md|\/workspace|git revert|AES-256-GCM|HMAC-SHA256|\bgrep\b|\bmain\b)/g;

function withMono(text: string): ReactNode[] {
  return text.split(MONO).map((part, i) =>
    i % 2 === 1 ? (
      /* `whitespace-nowrap` matters: without it `AES-256-GCM` breaks at its own
         hyphens and `{{ cron.scheduled_for }}` splits across two lines at its
         braces, which reads as a typo rather than a token. Every token in the
         list above fits the 390px measure whole, so nothing can overflow. */
      <code
        key={i}
        className="text-foreground font-mono text-[0.85em] tracking-tight whitespace-nowrap"
      >
        {part}
      </code>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

/**
 * One entry: a mono number and label in the rail, prose in the measure column,
 * a line of hard facts, and the link that proves it.
 *
 * The rail stacks above the prose below `md` rather than shrinking — a 10rem
 * column and a 60-character measure cannot both survive 390px, and the label is
 * the part that still works as a heading on its own.
 */
function EntryRow({ entry }: { entry: Entry }): ReactNode {
  return (
    <li className="border-border border-t">
      <Reveal>
        <div className="grid gap-x-12 gap-y-4 py-10 sm:py-12 md:grid-cols-[10rem_minmax(0,1fr)]">
          {/* rail · the number, and what this one is called */}
          <div className="flex items-baseline gap-3 md:block">
            <span className="text-muted-foreground/70 font-mono text-[10px] tracking-widest tabular-nums">
              {entry.n}
            </span>
            <h3 className="text-foreground text-sm font-medium tracking-tight md:mt-2 md:text-balance">
              {entry.label}
            </h3>
          </div>

          {/* body · the measure column */}
          <div className="min-w-0">
            <div className="max-w-[32rem] space-y-4">
              {entry.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 32)} className="text-muted-foreground text-base leading-[1.7]">
                  {withMono(paragraph)}
                </p>
              ))}
            </div>

            {/* The scan layer. The separator TRAILS its fact rather than leading
                the next one, so a wrap leaves the slash at the end of a line
                instead of orphaning it at the start of the next. */}
            <div className="mt-6 flex max-w-[32rem] flex-wrap items-center gap-x-2 gap-y-1.5">
              {entry.facts.map((fact, i) => (
                <span key={fact} className="flex items-center gap-2">
                  <span className="text-muted-foreground/80 font-mono text-[10px] tracking-widest whitespace-nowrap uppercase">
                    {fact}
                  </span>
                  {i < entry.facts.length - 1 ? (
                    <span aria-hidden className="text-muted-foreground/30 font-mono text-[10px]">
                      /
                    </span>
                  ) : null}
                </span>
              ))}
            </div>

            <Link
              href={entry.href}
              className="text-foreground duration-fast mt-6 inline-flex text-sm underline decoration-current/25 underline-offset-4 transition-colors hover:decoration-current"
            >
              {entry.linkLabel} →
            </Link>
          </div>
        </div>
      </Reveal>
    </li>
  );
}

export function CapabilitiesSection(): ReactNode {
  return (
    <section id="capabilities" className="mx-auto max-w-7xl px-6 py-16 sm:py-24">
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <header className="max-w-[32rem]">
            <p className="text-muted-foreground font-mono text-[10px] tracking-widest uppercase">
              {heading.eyebrow}
            </p>
            <h2 className="text-foreground mt-5 text-3xl font-medium tracking-tight text-balance sm:text-4xl">
              {heading.title}
            </h2>
            <p className="text-muted-foreground mt-4 text-base leading-[1.7]">{heading.lede}</p>
          </header>
        </Reveal>

        <ol className="mt-12 sm:mt-14">
          {entries.map((entry) => (
            <EntryRow key={entry.id} entry={entry} />
          ))}
        </ol>

        {/* The foot · the mechanics that apply to every entry above.
            Same two-column grid as an entry so it stays the same document, but
            no number, smaller type and a tighter row rhythm — it reads as an
            appendix rather than a ninth entry. */}
        <Reveal>
          <div className="border-border border-t pt-10">
            <p className="text-muted-foreground font-mono text-[10px] tracking-widest uppercase">
              {rules.eyebrow}
            </p>
            <p className="text-foreground mt-4 max-w-[32rem] text-base leading-[1.7]">
              {rules.lede}
            </p>

            {/* Two columns, not four stacked rows: the sentences are one line of
                reference each, so stacking them cost ~170px of page for no
                added clarity. Each cell carries its own hairline, which keeps
                the rule between the two columns implied rather than drawn. */}
            <dl className="mt-8 grid gap-x-12 sm:grid-cols-2">
              {rules.rows.map((row) => (
                <div key={row.id} className="border-border border-t py-4">
                  <dt className="text-foreground text-sm font-medium tracking-tight">{row.k}</dt>
                  <dd className="text-muted-foreground mt-1 text-sm leading-[1.7]">
                    {withMono(row.v)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
