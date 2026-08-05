'use client';

/**
 * Step 2, survey question 1 — what the team will actually use Kortix for.
 *
 * This is the only answer that changes what the user sees later: it picks the
 * three starting points on the finish step. Domain and size are captured, not
 * acted on.
 */

import type { OnboardingUseCase } from '@kortix/sdk';

import { USE_CASE_OPTIONS } from '../onboarding-profile';
import { ChoiceRow, StepShell } from '../step-shell';

export function UseCaseStep({
  value,
  onSelect,
  onContinue,
  onSkip,
}: {
  value: OnboardingUseCase | null;
  onSelect: (v: OnboardingUseCase) => void;
  onContinue: () => void;
  onSkip: () => void;
}) {
  return (
    <StepShell
      title="What will you use Kortix for?"
      description="We use this to pick the right starting points for you. You can change it later."
      primaryLabel="Continue"
      primaryDisabled={!value}
      onPrimary={onContinue}
      skipLabel="Skip"
      onSkip={onSkip}
    >
      <div className="flex flex-col gap-2" role="radiogroup" aria-label="Use case">
        {USE_CASE_OPTIONS.map((option) => (
          <ChoiceRow
            key={option.value}
            selected={value === option.value}
            label={option.label}
            description={option.description}
            onSelect={() => onSelect(option.value)}
          />
        ))}
      </div>
    </StepShell>
  );
}
