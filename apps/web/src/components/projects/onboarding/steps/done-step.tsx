'use client';

/**
 * Step 7 — the finish line, and the payoff for the two survey screens.
 *
 * The use case picked in step 2 selects three real starting points, each of
 * which maps to a template that already exists in `apps/web/content/use-cases/`.
 * Picking one completes onboarding AND seeds the project composer, so the first
 * thing the user sees after setup is work already in progress rather than an
 * empty box.
 *
 * A user who skipped the survey still gets three prompts — the fallback set —
 * because an empty finish screen would punish them twice for skipping.
 */

import {
  ArrowRightIcon as ArrowRight,
  CheckIcon as Check,
  CalendarBlankIcon as Calendar,
} from '@phosphor-icons/react';
import type { OnboardingUseCase } from '@kortix/sdk';

import { Button } from '@/components/ui/button';

import { starterPromptsFor } from '../onboarding-profile';
import { ChoiceRow, StepShell } from '../step-shell';

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

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-kortix-green/15 flex size-9 items-center justify-center rounded-sm">
        <Check className="text-kortix-green size-5" weight="fill" />
      </div>

      <StepShell
        title="You're all set"
        description={
          profileCount > 0
            ? `Your command center is ready with ${profileCount} ${profileCount === 1 ? 'tool' : 'tools'} connected. Pick a starting point, or jump straight in.`
            : 'Your command center is ready. Pick a starting point, or jump straight in.'
        }
        primaryLabel="Start building"
        onPrimary={onStart}
      >
        <div className="flex flex-col gap-2">
          {prompts.map((p) => (
            <ChoiceRow
              key={p.template}
              selected={false}
              label={p.title}
              description={p.prompt}
              aria-label={`Start with: ${p.title}`}
              onSelect={() => onUsePrompt(p.prompt)}
              leading={<ArrowRight className="text-muted-foreground/50 size-4 shrink-0" />}
            />
          ))}
        </div>

        {/* Rehomed from the deleted welcome step. Quiet, below the prompts —
            it is an offer, not the main path. */}
        {showFounderCall && onBookCall && (
          <div className="mt-6 flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground h-10 gap-1.5"
              onClick={onBookCall}
            >
              <Calendar className="size-3.5" />
              Book a 20-minute setup call with Marko
            </Button>
          </div>
        )}
      </StepShell>
    </div>
  );
}
