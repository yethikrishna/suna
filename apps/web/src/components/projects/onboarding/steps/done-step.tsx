'use client';

/**
 * The finish line, and the payoff for the two survey questions.
 *
 * The use case picked at step one selects three real starting points, each
 * mapping to a template that already exists in `apps/web/content/use-cases/`.
 * Picking one completes onboarding AND seeds the project composer, so the
 * first thing the user sees is work already in progress rather than an empty
 * box. Skipping the survey still yields three — an empty finish screen would
 * punish them twice.
 */

import {
  ArrowRightIcon as ArrowRight,
  CalendarBlankIcon as Calendar,
  CheckCircleIcon as CheckCircle,
} from '@phosphor-icons/react';
import { motion, useReducedMotion } from 'motion/react';
import type { OnboardingUseCase } from '@kortix/sdk';

import { Button } from '@/components/ui/button';

import { starterPromptsFor } from '../onboarding-profile';
import { OptionCard, StepShell } from '../step-shell';

export function DoneStep({
  useCase,
  profileCount,
  showFounderCall,
  onBookCall,
  onStart,
  onUsePrompt,
}: {
  useCase: OnboardingUseCase | null;
  profileCount: number;
  /** Founder-concierge tier. The CTA used to live on the deleted welcome step. */
  showFounderCall?: boolean;
  onBookCall?: () => void;
  onStart: () => void;
  onUsePrompt: (prompt: string) => void;
}) {
  const prompts = starterPromptsFor(useCase);
  const reduced = useReducedMotion() ?? false;

  return (
    <div className="flex flex-col items-start">
      {/* The one celebratory beat in the flow, and it fires once per project.
          Springs from 0.6 — never 0, because nothing appears out of nothing. */}
      <motion.div
        initial={reduced ? { opacity: 0 } : { scale: 0.6, opacity: 0 }}
        animate={reduced ? { opacity: 1 } : { scale: 1, opacity: 1 }}
        transition={reduced ? { duration: 0.2 } : { type: 'spring', duration: 0.5, bounce: 0.28 }}
        className="mb-7"
      >
        <CheckCircle className="text-kortix-green size-14" weight="fill" />
      </motion.div>

      <StepShell
        title="Your command center is live"
        description={
          profileCount > 0
            ? `${profileCount} ${profileCount === 1 ? 'tool' : 'tools'} connected and ready. Pick something for your agent to start on, or jump straight in.`
            : 'Pick something for your agent to start on, or jump straight in.'
        }
        primaryLabel="Start building"
        onPrimary={onStart}
      >
        <div className="flex flex-col gap-2.5">
          {prompts.map((p) => (
            <OptionCard
              key={p.template}
              selected={false}
              label={p.title}
              description={p.prompt}
              aria-label={`Start with: ${p.title}`}
              onSelect={() => onUsePrompt(p.prompt)}
              icon={<ArrowRight className="text-muted-foreground/60 size-4" />}
            />
          ))}
        </div>

        {/* Rehomed from the deleted welcome step. Quiet, and on the rail. */}
        {showFounderCall && onBookCall && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground -ml-2 mt-4 h-9 gap-1.5 px-2"
            onClick={onBookCall}
          >
            <Calendar className="size-3.5" />
            Book a 20-minute setup call with Marko
          </Button>
        )}
      </StepShell>
    </div>
  );
}
