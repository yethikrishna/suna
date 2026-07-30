'use client';

import { Separator } from '@/components/ui/separator';
import { GitCompanySection } from '@/features/marketing/git-company/git-company-section';
import Hero from '@/features/marketing/hero';
import { CtaSection } from '@/features/marketing/landing/cta-section';
import { LogoStrip } from '@/features/marketing/landing/logo-strip';
import { TrustSection } from '@/features/marketing/landing/trust-section';
import { UseCaseWheel } from '@/features/marketing/landing/use-case-wheel';
import { OpenSourceSection } from '@/features/marketing/open-source/open-source-section';
import { PlatformStack } from '@/features/marketing/platform-stack';

function SectionDivider() {
  return (
    <div className="mx-auto max-w-6xl">
      <Separator />
    </div>
  );
}

/**
 * The arc, in the order a reader needs it: what it is, who it is for, what it is
 * made of, where the work lives, that it is genuinely yours, that it survives a
 * security review, then start.
 */
export default function Home() {
  return (
    <div className="bg-background relative">
      {/* 1 · What it is — and the product actually running */}
      <Hero />

      {/* transition: the models it runs and the tools it connects */}
      <LogoStrip />

      <SectionDivider />

      {/* 2 · Who it works for — teams on a scroll-driven wheel */}
      <UseCaseWheel />

      <SectionDivider />

      {/* 3 · What it is made of — click a layer, the stack responds */}
      <PlatformStack />

      <SectionDivider />

      {/* 4 · Where the work lives: one kortix.yaml, one repo */}
      <GitCompanySection />

      <SectionDivider />

      {/* 5 · Open source, and genuinely self-hostable */}
      <OpenSourceSection />

      <SectionDivider />

      {/* 6 · Why it is safe to run, and where we stand on certification */}
      <TrustSection />

      {/* Close · run your whole company from one repo you own */}
      <CtaSection />
    </div>
  );
}
