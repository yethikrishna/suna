'use client';

import { Reveal } from '@/components/home/reveal';
import { Badge } from '@/components/ui/badge';
import { departments } from './content';

/**
 * One card per team: the ask a person actually types, and the artifact that
 * comes back. The output line is the point — it is a file or a change request,
 * never a paragraph of chat.
 */
export function DepartmentsSection() {
  return (
    <section id="teams" className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
      <Reveal>
        <div className="max-w-3xl">
          <Badge variant="kortix" className="rounded">
            {departments.eyebrow}
          </Badge>
          <h2 className="text-foreground mt-6 text-3xl font-medium tracking-tight text-balance sm:text-4xl">
            {departments.title}
          </h2>
          <p className="text-muted-foreground mt-4 text-base leading-relaxed">
            {departments.sub}
          </p>
        </div>
      </Reveal>

      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
        {departments.cards.map((card, i) => (
          <Reveal key={card.tag} delay={i * 0.05}>
            <article className="border-border bg-card flex h-full flex-col rounded-sm border p-6">
              <span className="text-muted-foreground font-mono text-[11px] tracking-widest uppercase">
                {card.tag}
              </span>

              <h3 className="text-foreground mt-3 text-lg font-medium tracking-tight">
                {card.title}
              </h3>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{card.body}</p>

              <div className="border-border mt-5 space-y-3 border-t pt-5">
                <p className="text-foreground/80 font-mono text-xs leading-relaxed">{card.ask}</p>
                <p className="text-muted-foreground flex items-start gap-2 font-mono text-xs leading-relaxed">
                  <span aria-hidden className="text-muted-foreground/50">
                    →
                  </span>
                  <span>{card.output}</span>
                </p>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
