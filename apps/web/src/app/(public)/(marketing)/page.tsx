'use client';

import { Separator } from '@/components/ui/separator';
import Hero from '@/features/marketing/hero';
import { StackSection } from '@/features/marketing/landing/stack-section';

function SectionDivider() {
  return (
    <div className="mx-auto max-w-6xl">
      <Separator />
    </div>
  );
}

/**
 * Rebuilt section by section. Only what is finished ships; the previous
 * sections stay in the tree and come back once each is reworked.
 */
export default function Home() {
  return (
    <div className="bg-background relative">
      {/* 1 · What it is — and the product actually running */}
      <Hero />

      <SectionDivider />

      {/* 2 · Every layer an AI workforce needs, unified */}
      <StackSection />
    </div>
  );
}
