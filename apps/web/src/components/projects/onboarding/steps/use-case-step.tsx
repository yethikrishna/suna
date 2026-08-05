'use client';

/**
 * What the team will use Kortix for.
 *
 * The only answer that changes what the user sees later: it picks the three
 * starting points on the finish step. Domain and size are captured, not acted
 * on.
 */

import type { OnboardingUseCase } from '@kortix/sdk';

import { USE_CASE_OPTIONS } from '../onboarding-profile';
import { OptionCard, OptionGrid, StepShell } from '../step-shell';

export function UseCaseStep({
  stepLabel,
  value,
  onSelect,
  onContinue,
  onSkip,
}: {
  stepLabel: string;
  value: OnboardingUseCase | null;
  onSelect: (v: OnboardingUseCase) => void;
  onContinue: () => void;
  onSkip: () => void;
}) {
  return (
    <StepShell
      stepLabel={stepLabel}
      title="Where will you use Kortix?"
      description="This picks the starting points we show you at the end. You can change it later."
      primaryLabel="Continue"
      primaryDisabled={!value}
      onPrimary={onContinue}
      secondaryLabel="Skip"
      onSecondary={onSkip}
    >
      <OptionGrid label="Use case">
        {USE_CASE_OPTIONS.map((option) => (
          <OptionCard
            key={option.value}
            selected={value === option.value}
            label={option.label}
            onSelect={() => onSelect(option.value)}
          />
        ))}
      </OptionGrid>
    </StepShell>
  );
}
