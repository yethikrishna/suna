'use client';

import { Reveal } from '@/components/home/reveal';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { stack } from './content';

/**
 * The stack, one labelled layer at a time — the "what is this actually made of"
 * answer. Layers read bottom-up like a real stack diagram on desktop, and the
 * one layer competitors cannot claim ("Your company as code") is the only one
 * that inverts.
 */
export function StackSection() {
  return (
    <section id="stack" className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
      <Reveal>
        <Badge variant="kortix" className="rounded">
          {stack.eyebrow}
        </Badge>
        <h2 className="text-foreground mt-6 max-w-3xl text-3xl font-medium tracking-tight text-balance sm:text-4xl">
          {stack.title}
        </h2>
        <p className="text-muted-foreground mt-4 max-w-2xl text-base leading-relaxed">
          {stack.sub}
        </p>
      </Reveal>

      <div className="border-border mt-10 overflow-hidden rounded-sm border">
        {stack.layers.map((layer, i) => (
          <Reveal key={layer.id} delay={i * 0.04}>
            <div
              className={cn(
                'group grid grid-cols-1 gap-x-8 gap-y-2 px-5 py-6 sm:grid-cols-12 sm:px-7 sm:py-7',
                i > 0 && 'border-border border-t',
                'accent' in layer && layer.accent
                  ? 'bg-foreground text-background'
                  : 'bg-card',
              )}
            >
              <div className="sm:col-span-3">
                <h3 className="text-base font-medium tracking-tight">{layer.name}</h3>
              </div>

              <p
                className={cn(
                  'text-sm leading-relaxed sm:col-span-6',
                  'accent' in layer && layer.accent
                    ? 'text-background/75'
                    : 'text-muted-foreground',
                )}
              >
                {layer.body}
              </p>

              <p
                className={cn(
                  'font-mono text-[11px] leading-relaxed tracking-wide sm:col-span-3 sm:text-right',
                  'accent' in layer && layer.accent
                    ? 'text-background/55'
                    : 'text-muted-foreground/70',
                )}
              >
                {layer.meta}
              </p>
            </div>
          </Reveal>
        ))}

        <div className="border-border bg-card text-muted-foreground border-t px-5 py-4 text-center font-mono text-[11px] tracking-widest uppercase sm:px-7">
          Kortix
        </div>
      </div>
    </section>
  );
}
