'use client';

import { Reveal } from '@/components/home/reveal';
import { Badge } from '@/components/ui/badge';
import { workforce } from './content';

const SESSIONS = [
  { branch: 'session/close-month', team: 'Finance' },
  { branch: 'session/pipeline-review', team: 'Sales' },
  { branch: 'session/fix-checkout', team: 'Engineering' },
  { branch: 'session/launch-post', team: 'Marketing' },
];

/** One ask fans out into isolated machines and converges back on a single
 *  reviewed `main`. The diagram carries the argument; the copy stays short. */
export function WorkforceSection() {
  return (
    <section id="workforce" className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
      <Reveal>
        <div className="max-w-3xl">
          <Badge variant="kortix" className="rounded">
            {workforce.eyebrow}
          </Badge>
          <h2 className="text-foreground mt-6 text-3xl font-medium tracking-tight text-balance sm:text-4xl">
            {workforce.title}
          </h2>
          <p className="text-muted-foreground mt-4 text-base leading-relaxed">{workforce.sub}</p>
        </div>
      </Reveal>

      <Reveal delay={0.06}>
        <div className="border-border bg-card mt-10 rounded-sm border p-6 sm:p-8">
          <p className="text-muted-foreground font-mono text-[11px] tracking-widest uppercase">
            One ask
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {SESSIONS.map((s) => (
              <div key={s.branch} className="border-border bg-background rounded-sm border p-4">
                <p className="text-foreground font-mono text-[11px] break-all">{s.branch}</p>
                <p className="text-muted-foreground mt-2 text-xs">{s.team}</p>
                <p className="text-muted-foreground/70 mt-3 font-mono text-[10px]">
                  isolated cloud computer
                </p>
              </div>
            ))}
          </div>

          <div className="text-muted-foreground/60 mt-4 text-center font-mono text-[11px]">
            ↓ change request · reviewed by a human ↓
          </div>

          <div className="bg-foreground text-background mt-4 rounded-sm px-5 py-4 text-center">
            <p className="font-mono text-xs tracking-wide">main · shared by the whole company</p>
          </div>
        </div>
      </Reveal>

      <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-3">
        {workforce.points.map((p, i) => (
          <Reveal key={p.title} delay={0.1 + i * 0.05}>
            <h3 className="text-foreground text-sm font-medium">{p.title}</h3>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{p.body}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
