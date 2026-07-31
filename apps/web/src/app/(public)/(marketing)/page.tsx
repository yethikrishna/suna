'use client';

import { CapabilitiesSection } from '@/features/marketing/capabilities/capabilities-section';
import Hero from '@/features/marketing/hero';
import { HowItWorks } from '@/features/marketing/how-it-work/how-it-works';
import { AskingInterlude, OwningInterlude } from '@/features/marketing/interludes';
import { CtaSection } from '@/features/marketing/landing/cta-section';
import { LogoStrip } from '@/features/marketing/landing/logo-strip';
import { ScrollCtaPill } from '@/features/marketing/landing/scroll-cta-pill';
import { TrustSection } from '@/features/marketing/landing/trust-section';
import { UseCaseWheel } from '@/features/marketing/landing/use-case-wheel';
import { OpenSourceSection } from '@/features/marketing/open-source/open-source-section';

/**
 * The arc, in the order a reader needs it: what it is, what it is made of, what
 * it does for a team, that it is genuinely yours, that it survives a security
 * review — then start.
 *
 * The repo is no longer its own section. "One kortix.yaml, one repo" and
 * "source of truth" were the same argument told twice, so the manifest now
 * opens the layer sequence as layer 01 and the standalone block is gone.
 *
 * There are no rules between sections. Each section already owns its own
 * vertical rhythm, so a hairline every time only drew attention to the seams
 * instead of the content on either side of them.
 */
export default function Home() {
  return (
    <div className="bg-background relative">
      {/* 1 · What it is — and the product actually running */}
      <Hero />

      {/* transition: the models it runs and the tools it connects */}
      <LogoStrip />

      {/* Past the hero its buttons are gone, so the pill takes over */}
      <div id="cta-pill-anchor" aria-hidden className="h-px" />

      {/* 2 · What it is made of — one card per layer, stacking as you descend,
             opening on the repo that holds all of them */}
      <HowItWorks />

      {/* 3 · The one section written to be read, not scanned */}
      <CapabilitiesSection />

      {/* 4 · What it does — real work, and the artefact it produces */}
      <UseCaseWheel />

      {/* The wheel is all output. This is the input that caused it — without it
          a reader watches ten results go by and never learns how to ask. */}
      <AskingInterlude />

      {/* 5 · Open source, and genuinely runnable on your own hardware */}
      <OpenSourceSection />

      {/* Rest between two heavy surfaces, and the ownership close */}
      <OwningInterlude />

      {/* 6 · Why it is safe to run, and where we stand on certification */}
      <TrustSection />

      {/* Close */}
      <CtaSection />

      <ScrollCtaPill />
    </div>
  );
}
