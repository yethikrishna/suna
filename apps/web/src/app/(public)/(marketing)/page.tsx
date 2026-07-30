'use client';

import { Separator } from '@/components/ui/separator';
import { CompanyAsCodeSection } from '@/features/marketing/company-os-sections';
import Hero from '@/features/marketing/hero';
import { CtaSection } from '@/features/marketing/landing/cta-section';
import { DepartmentsSection } from '@/features/marketing/landing/departments-section';
import { StackSection } from '@/features/marketing/landing/stack-section';
import { TrustSection } from '@/features/marketing/landing/trust-section';
import { WorkforceSection } from '@/features/marketing/landing/workforce-section';

function SectionDivider() {
  return (
    <div className="mx-auto max-w-6xl">
      <Separator />
    </div>
  );
}

/**
 * One claim per section, each carried by a real artifact rather than an
 * explanation. Order answers, in sequence: what is it, what is it made of,
 * what does it do for my team, where does the work live, how does it scale,
 * can I trust it, start.
 */
export default function Home() {
  return (
    <div className="bg-background relative">
      {/* 1 · What it is — and the product actually running */}
      <Hero />

      <SectionDivider />

      {/* 2 · What it is made of, and that every layer is yours */}
      <StackSection />

      <SectionDivider />

      {/* 3 · What it does for each team — the ask, and the artifact returned */}
      <DepartmentsSection />

      <SectionDivider />

      {/* 4 · Where the work lives: the repo that is the company */}
      <CompanyAsCodeSection />

      <SectionDivider />

      {/* 5 · How it scales: many isolated machines, one reviewed main */}
      <WorkforceSection />

      <SectionDivider />

      {/* 6 · Why it survives a security review */}
      <TrustSection />

      <SectionDivider />

      {/* 7 · Start */}
      <CtaSection />
    </div>
  );
}
