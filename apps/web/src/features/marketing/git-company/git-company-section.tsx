import { Reveal } from '@/components/home/reveal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/marketing/button';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { CodePanel } from './code-panel';
import { gitCompany } from './content';
import { RepoTree } from './repo-tree';

/**
 * The argument the rest of the home page does not make: one `kortix.yaml` and
 * one git repo are the whole company's operations.
 *
 * The proof has to be the artefact, not an adjective — so the centrepiece is a
 * real version-2 manifest beside the real starter-template tree, and the three
 * supporting points are three things git already does. `/company-as-code` is
 * the long form; this section stays one screen and links there.
 */
export function GitCompanySection(): ReactNode {
  return (
    <section id="git-company" className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
      <Reveal>
        <div className="max-w-3xl">
          <Badge
            variant="kortix"
            className="rounded font-mono text-[10px] tracking-widest uppercase"
          >
            {gitCompany.eyebrow}
          </Badge>
          <h2 className="text-foreground mt-6 text-3xl font-medium tracking-tight text-balance sm:text-4xl">
            {gitCompany.title}
          </h2>
          <p className="text-muted-foreground mt-4 text-base leading-relaxed">{gitCompany.sub}</p>
        </div>
      </Reveal>

      <Reveal delay={0.06}>
        <div className="mt-10 grid gap-6 lg:grid-cols-12">
          <CodePanel
            className="lg:col-span-7"
            title={gitCompany.yaml.title}
            caption={gitCompany.yaml.caption}
            lines={gitCompany.yaml.lines}
          />

          <div className="flex flex-col gap-6 lg:col-span-5">
            <RepoTree />

            <ul className="border-border divide-border divide-y rounded-sm border">
              {gitCompany.points.map((point) => (
                <li key={point.id} className="px-5 py-4">
                  <span className="text-foreground font-mono text-xs">{point.k}</span>
                  <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{point.v}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.12}>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
          <Button variant="outline" size="sm" asChild className="w-fit">
            <Link href={gitCompany.ctaHref}>{gitCompany.ctaLabel}</Link>
          </Button>
          <p className="text-muted-foreground/60 font-mono text-xs">{gitCompany.microline}</p>
        </div>
      </Reveal>
    </section>
  );
}
