'use client';

import { Separator } from '@/components/ui/separator';
import Hero from '@/features/marketing/hero';
import { HowItWorks } from '@/features/marketing/how-it-work/how-it-works';
import { CtaSection } from '@/features/marketing/landing/cta-section';
import { LogoStrip } from '@/features/marketing/landing/logo-strip';
import { TrustSection } from '@/features/marketing/landing/trust-section';
import { UseCaseWheel } from '@/features/marketing/landing/use-case-wheel';

function SectionDivider() {
  return (
    <div className="mx-auto max-w-6xl">
      <Separator />
    </div>
  );
}

/**
 * Rebuilt section by section, following the hero → logo strip → section rhythm.
 * Only what is finished ships; the remaining sections stay in the tree until
 * each is reworked.
 */
export default function Home() {
  return (
    <div className="bg-background relative">
      {/* 1 · What it is — and the product actually running */}
      <Hero />

      {/* transition: the models it runs and the tools it connects */}
      <LogoStrip />

      <SectionDivider />

      {/* 2 · Who it works for — ten teams on a scroll-driven wheel */}
      <UseCaseWheel />

      <SectionDivider />

      {/* 3 · The platform, layer by layer — scroll-pinned */}
      <HowItWorks />

      <SectionDivider />

      {/* 4 · Why it is safe to run — and exactly where we stand on certification */}
      <TrustSection />

      {/* Close · run your whole company from one repo you own */}
      <CtaSection />
    </div>
  );
}
