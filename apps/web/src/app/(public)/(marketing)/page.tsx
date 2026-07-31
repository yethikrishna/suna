'use client';

import {
  AgentsSection,
  AutomationsSection,
  ChannelsSection,
  ControlSection,
} from '@/features/marketing/capabilities';
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
 * The prose used to be one long block. It is now four passages, each placed
 * against the section that raises the question it answers, so the page
 * alternates between something to look at and something to read instead of
 * asking for one long stretch of attention in the middle.
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

      {/* The stack ends on "an OpenCode agent" and stops. This is the rest of
          that sentence, while the question is still warm. */}
      <AgentsSection />

      {/* 3 · What it does — real work, and the artefact it produces */}
      <UseCaseWheel />

      {/* The wheel is artefacts with nobody asking for them. This is where the
          ask arrives. */}
      <ChannelsSection />

      {/* The input that caused all of it — without this a reader watches the
          results go by and never learns how to ask. */}
      <AskingInterlude />

      {/* The interlude's third mode is "nobody is present". This is the trigger
          that makes that true. */}
      <AutomationsSection />

      {/* 4 · Open source, and genuinely runnable on your own hardware */}
      <OpenSourceSection />

      {/* Rest between two heavy surfaces, and the ownership close */}
      <OwningInterlude />

      {/* Governance is deliberately not a layer in the stack, and the trust
          section is badges. This is the mechanism behind both. */}
      <ControlSection />

      {/* 5 · Why it is safe to run, and where we stand on certification */}
      <TrustSection />

      {/* Close */}
      <CtaSection />

      <ScrollCtaPill />
    </div>
  );
}
