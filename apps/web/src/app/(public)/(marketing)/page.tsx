'use client';

import { Separator } from '@/components/ui/separator';
import Hero from '@/features/marketing/hero';
import { HowItWorks } from '@/features/marketing/how-it-work/how-it-works';
import { LogoStrip } from '@/features/marketing/landing/logo-strip';
import { StackSection } from '@/features/marketing/landing/stack-section';

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

      {/* 2 · From a request to finished work — the original scroll-pinned section */}
      <HowItWorks />

      <SectionDivider />

      {/* 3 · Every layer an AI workforce needs, unified */}
      <StackSection />
    </div>
  );
}
