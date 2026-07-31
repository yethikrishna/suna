'use client';

import { Reveal } from '@/components/home/reveal';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { faq } from './content';

/**
 * The FAQ — mount between the trust section and the open-source section.
 *
 * WHY IT IS NOT AN ACCORDION. Half of these answers concede something: gates
 * ship off, self-hosting is not air-gapped, audit export is an entitlement, we
 * hold no certification. An accordion hides exactly the sentences the section
 * exists to say out loud, and it turns a 30-second read into seven clicks.
 * Everything is open, always. There is nothing here to interact with.
 *
 * WHY QUESTION LEFT, ANSWER RIGHT. At `lg` the question sits in a 4-column rail
 * and the answer in the 8 beside it, so a reader scans the left edge, stops on
 * the one they came with, and reads sideways. Stacked in one column the
 * questions and answers interleave and scanning costs the whole section. Below
 * `lg` it collapses to one column, because a 390px viewport cannot hold two.
 *
 * WHY THE ANSWER IS CAPPED AT 36rem. Eight columns of a `max-w-7xl` slab is
 * about 85 characters a line, which is past the point where a reader loses the
 * start of the next one. Capped, it measures near 70 and the trailing space
 * matches the rail on the left, so the row still reads as a balanced pair.
 *
 * WHY IT IS ONE BORDERED SLAB. The rows are a set — the point is partly that
 * there are only seven of them and none is missing. Seven separate cards would
 * read as seven claims; one divided panel reads as a document, which is what an
 * FAQ is. `rounded-sm` and a hairline border, flat: it sits in the page flow, so
 * it gets an edge rather than elevation.
 *
 * Copy, and the accuracy gate every answer had to pass, live in `content.ts`.
 * Read that file before editing a word here — four of these answers are
 * deliberately unflattering and must stay that way.
 */
export function FaqSection(): ReactNode {
  return (
    <section id="faq" className="mx-auto max-w-7xl px-6 py-16 sm:py-24">
      <Reveal>
        <p className="text-muted-foreground font-mono text-[10px] tracking-widest uppercase">
          {faq.eyebrow}
        </p>
        <h2 className="text-foreground mt-5 max-w-2xl text-3xl font-medium tracking-tight text-balance sm:text-4xl">
          {faq.title}
        </h2>
      </Reveal>

      <Reveal delay={0.06}>
        <dl className="border-border bg-card mt-10 overflow-hidden rounded-sm border">
          {faq.items.map((item, i) => (
            <div
              key={item.id}
              id={item.id}
              className={
                i > 0
                  ? 'border-border grid gap-x-12 gap-y-3 border-t px-5 py-6 sm:px-8 sm:py-8 lg:grid-cols-12'
                  : 'grid gap-x-12 gap-y-3 px-5 py-6 sm:px-8 sm:py-8 lg:grid-cols-12'
              }
            >
              <dt className="text-foreground min-w-0 text-base leading-snug font-medium tracking-tight text-balance lg:col-span-4">
                {item.question}
              </dt>
              <dd className="text-muted-foreground min-w-0 max-w-[36rem] text-base leading-[1.7] text-pretty lg:col-span-8">
                {item.answer}
              </dd>
            </div>
          ))}
        </dl>
      </Reveal>

      <Reveal delay={0.1}>
        <Link
          href={faq.href}
          className="text-foreground duration-fast mt-6 inline-flex text-sm underline decoration-current/25 underline-offset-4 transition-colors hover:decoration-current"
        >
          {faq.linkLabel} →
        </Link>
      </Reveal>
    </section>
  );
}
