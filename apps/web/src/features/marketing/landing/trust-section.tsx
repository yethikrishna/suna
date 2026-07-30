'use client';

import { Reveal } from '@/components/home/reveal';
import { trust } from './content';

const VAULT = [
  'vault://stripe/live',
  'vault://gmail/oauth',
  'vault://aws/deploy-key',
  'vault://slack/bot-token',
];

const DEPLOY = ['Kortix Cloud', 'Your VPC', 'On-prem', 'Air-gapped'];

/** Centred header, three cards, each ending in a small literal visual rather
 *  than an icon. Security claims stay to what the product actually enforces. */
export function TrustSection() {
  return (
    <section id="trust" className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
      <Reveal>
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-muted-foreground font-mono text-[11px] tracking-widest uppercase">
            {trust.eyebrow}
          </p>
          <h2 className="text-foreground mt-4 text-3xl font-medium tracking-tight text-balance sm:text-4xl">
            {trust.title}
          </h2>
          <p className="text-muted-foreground mt-4 text-base leading-relaxed">{trust.sub}</p>
        </div>
      </Reveal>

      <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
        {trust.cards.map((card, i) => (
          <Reveal key={card.title} delay={i * 0.05}>
            <article className="border-border bg-card flex h-full flex-col rounded-sm border p-6">
              <h3 className="text-foreground text-base font-medium tracking-tight">{card.title}</h3>
              <p className="text-muted-foreground mt-3 text-sm leading-relaxed">{card.body}</p>

              <div className="mt-6 flex-1">
                {i === 0 && (
                  <div className="bg-foreground rounded-sm p-4">
                    {VAULT.map((v) => (
                      <div key={v} className="flex items-center justify-between py-1">
                        <span className="text-background/80 font-mono text-[11px]">{v}</span>
                        <span className="text-background/35 font-mono text-[11px]">••••••••</span>
                      </div>
                    ))}
                  </div>
                )}

                {i === 1 && (
                  <div className="grid grid-cols-2 gap-2">
                    {['session/a', 'session/b', 'session/c', 'session/d'].map((s) => (
                      <div
                        key={s}
                        className="border-border bg-background text-muted-foreground rounded-sm border border-dashed px-3 py-4 text-center font-mono text-[10px]"
                      >
                        {s}
                      </div>
                    ))}
                  </div>
                )}

                {i === 2 && (
                  <div className="flex flex-wrap gap-2">
                    {DEPLOY.map((d) => (
                      <span
                        key={d}
                        className="border-border text-muted-foreground rounded-sm border px-3 py-1.5 font-mono text-[11px]"
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
