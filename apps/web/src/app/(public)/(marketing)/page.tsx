'use client';

import { Separator } from '@/components/ui/separator';
import { GitCompanySection } from '@/features/marketing/git-company/git-company-section';
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
 * The arc, in the order a reader needs it: what it is, what it does for a team,
 * what it is made of, where that work lives, that it survives a security
 * review, that it is genuinely yours — then start.
 *
 * Open source moved from the middle to the last argument before the CTA: it is
 * the answer to the objection the security section raises, so it reads better
 * as the closer's setup than as a mid-page aside.
 */
export default function Home() {
  return (
    <div className="bg-background relative">
      {/* 1 · What it is — and the product actually running */}
      <Hero />

      {/* transition: the models it runs and the tools it connects */}
      <LogoStrip />

      <SectionDivider />

      {/* 2 · What it does — real work, and the artefact it produces */}
      <UseCaseWheel />

      <SectionDivider />

      {/* 3 · What it is made of — the layers, each with the surface that proves it */}
      <HowItWorks />

      <SectionDivider />

      {/* 4 · Where the work lives: one kortix.yaml, one repo */}
      <GitCompanySection />

      <SectionDivider />

      {/* 5 · Why it is safe to run, and where we stand on certification */}
      <TrustSection />

      <SectionDivider />

      {/* 6 · Open source, and genuinely runnable on your own hardware */}
      <OpenSourceSection />

      {/* Close */}
      <CtaSection />
    </div>
  );
}
