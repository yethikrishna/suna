'use client';

import { Separator } from '@/components/ui/separator';
import Hero from '@/features/marketing/hero';
import { HowItWorks } from '@/features/marketing/how-it-work/how-it-works';
import { CtaSection } from '@/features/marketing/landing/cta-section';
import { LogoStrip } from '@/features/marketing/landing/logo-strip';
import { TrustSection } from '@/features/marketing/landing/trust-section';
import { UseCaseWheel } from '@/features/marketing/landing/use-case-wheel';
import { OpenSourceSection } from '@/features/marketing/open-source/open-source-section';

function SectionDivider() {
  return (
    <div className="mx-auto max-w-6xl">
      <Separator />
    </div>
  );
}

/**
 * The arc, in the order a reader needs it: what it is, what it is made of, what
 * it does for a team, that it is genuinely yours, that it survives a security
 * review — then start.
 *
 * The repo is no longer its own section. "One kortix.yaml, one repo" and
 * "source of truth" were the same argument told twice, so the manifest now
 * opens the layer sequence as layer 01 and the standalone block is gone.
 */
export default function Home() {
  return (
    <div className="bg-background relative">
      {/* 1 · What it is — and the product actually running */}
      <Hero />

      {/* transition: the models it runs and the tools it connects */}
      <LogoStrip />

      {/* 2 · What it is made of — one card per layer, stacking as you descend,
             opening on the repo that holds all of them. No divider above it:
             the stack supplies its own edge as the first card parks. */}
      <HowItWorks />

      <SectionDivider />

      {/* 3 · What it does — real work, and the artefact it produces */}
      <UseCaseWheel />

      <SectionDivider />

      {/* 4 · Open source, and genuinely runnable on your own hardware */}
      <OpenSourceSection />

      <SectionDivider />

      {/* 5 · Why it is safe to run, and where we stand on certification */}
      <TrustSection />

      {/* Close */}
      <CtaSection />
    </div>
  );
}
