'use client';

import { Separator } from '@/components/ui/separator';
import Hero from '@/features/marketing/hero';
import { HowItWorks } from '@/features/marketing/how-it-work/how-it-works';
import { LogoStrip } from '@/features/marketing/landing/logo-strip';
import { TrustSection } from '@/features/marketing/landing/trust-section';

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

      {/* 2 · The platform, layer by layer — scroll-pinned */}
      <HowItWorks />

      <SectionDivider />

      {/* 3 · Why it is safe to run — and exactly where we stand on certification */}
      <TrustSection />
    </div>
  );
}
