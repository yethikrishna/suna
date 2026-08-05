'use client';

/**
 * Step 1 — a warm start.
 *
 * Two branches. Accounts that qualify for founder concierge
 * (`usePersonalContactTier() === 'personal'`) get Marko and a booking CTA;
 * everyone else gets the plain welcome. The branch is decided by the shell and
 * passed in, so this component stays presentational.
 */

import { ArrowRightIcon as ArrowRight } from '@phosphor-icons/react';
import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { KortixAsterisk } from '@/components/ui/kortix-asterisk';

export function WelcomeStep({
  showFounderStep,
  onBookCall,
  onContinue,
}: {
  showFounderStep: boolean;
  onBookCall: () => void;
  onContinue: () => void;
}) {
  if (showFounderStep) {
    return (
      <div className="flex flex-col items-start gap-6">
        <div className="border-border/70 bg-card relative size-16 shrink-0 overflow-hidden rounded-md border">
          <Image src="/marko.png" alt="Marko Kraemer" fill priority className="object-cover" />
        </div>
        <div className="space-y-2">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight text-balance">
            Let&apos;s get your command center set up
          </h1>
          <p className="text-muted-foreground text-sm leading-6 text-pretty">
            I&apos;m Marko, founder of Kortix. Book a quick 20-minute call and we&apos;ll set up
            your company&apos;s AI command center together — or jump straight in and connect your
            tools below.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2">
          <Button size="lg" className="w-full active:scale-[0.96]" onClick={onBookCall}>
            Book a call with Marko
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="w-full active:scale-[0.96]"
            onClick={onContinue}
          >
            I&apos;ll set it up myself
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-6">
      <KortixAsterisk index={0} parentClass="size-9" />
      <div className="space-y-2">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight text-balance">
          Welcome to Kortix
        </h1>
        <p className="text-muted-foreground text-sm leading-6 text-pretty">
          A few quick questions and your agent will be wired into the tools your team already runs
          on. Connect your apps, drop it into Slack, and you&apos;re off.
        </p>
      </div>
      <Button size="lg" className="w-full gap-1.5 active:scale-[0.96]" onClick={onContinue}>
        Get started
        <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}
