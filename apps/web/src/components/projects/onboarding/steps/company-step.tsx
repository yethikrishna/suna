'use client';

/**
 * Who the team works for.
 *
 * Both fields are optional, so `Continue` is never disabled: this is a survey,
 * not a form, and gating the flow on it would trade real activation for a data
 * point.
 */

import { GlobeIcon } from '@phosphor-icons/react';
import type { OnboardingCompanySize } from '@kortix/sdk';

import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';

import { COMPANY_SIZES } from '../onboarding-profile';
import { OptionCard, OptionGrid, StepShell } from '../step-shell';

export function CompanyStep({
  stepLabel,
  domain,
  size,
  onDomainChange,
  onSizeChange,
  onContinue,
  onSkip,
}: {
  stepLabel: string;
  domain: string;
  size: OnboardingCompanySize | null;
  onDomainChange: (v: string) => void;
  onSizeChange: (v: OnboardingCompanySize) => void;
  onContinue: () => void;
  onSkip: () => void;
}) {
  return (
    <StepShell
      stepLabel={stepLabel}
      title="Tell us about your company"
      description="Your agent uses the domain to research your own company. Nothing is shared publicly."
      primaryLabel="Continue"
      onPrimary={onContinue}
      secondaryLabel="Skip"
      onSecondary={onSkip}
    >
      {/* Two questions on one screen, so they need to read as two. */}
      <div className="space-y-8">
        <div className="space-y-2.5">
          <Label htmlFor="onboarding-company-domain">Company domain</Label>
          <InputGroup className="h-11 max-w-[340px]">
            <InputGroupAddon>
              <GlobeIcon className="text-muted-foreground size-4" />
            </InputGroupAddon>
            <InputGroupInput
              id="onboarding-company-domain"
              value={domain}
              onChange={(e) => onDomainChange(e.target.value)}
              placeholder="acme.com"
              autoComplete="organization"
              spellCheck={false}
            />
          </InputGroup>
        </div>

        <div className="space-y-2.5">
          <Label>Company size</Label>
          <OptionGrid label="Company size">
            {COMPANY_SIZES.map((option) => (
              <OptionCard
                key={option}
                selected={size === option}
                label={`${option} people`}
                onSelect={() => onSizeChange(option)}
              />
            ))}
          </OptionGrid>
        </div>
      </div>
    </StepShell>
  );
}
