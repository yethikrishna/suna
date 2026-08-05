'use client';

/**
 * Who the team works for.
 *
 * Domain and size share one screen because they are one thought. Both fields
 * are optional, so `Continue` is never disabled: this is a survey, not a form,
 * and gating the flow on it would trade real activation for a data point.
 */

import { GlobeIcon } from '@phosphor-icons/react';
import type { OnboardingCompanySize } from '@kortix/sdk';

import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';

import { COMPANY_SIZES } from '../onboarding-profile';
import { ChoiceRow, StepShell } from '../step-shell';

export function CompanyStep({
  domain,
  size,
  onDomainChange,
  onSizeChange,
  onContinue,
  onSkip,
}: {
  domain: string;
  size: OnboardingCompanySize | null;
  onDomainChange: (v: string) => void;
  onSizeChange: (v: OnboardingCompanySize) => void;
  onContinue: () => void;
  onSkip: () => void;
}) {
  return (
    <StepShell
      title="Tell us about your company"
      description="Your agent uses the domain to research your own company. Nothing is shared publicly."
      primaryLabel="Continue"
      onPrimary={onContinue}
      skipLabel="Skip"
      onSkip={onSkip}
    >
      {/* space-y-10: two separate questions on one screen need to read as two,
          not as a stacked form. */}
      <div className="space-y-10">
        <div className="space-y-3">
          <Label htmlFor="onboarding-company-domain">Company domain</Label>
          <InputGroup className="h-11">
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

        <div className="space-y-3">
          <Label>Company size</Label>
          <div className="flex flex-col gap-2" role="radiogroup" aria-label="Company size">
            {COMPANY_SIZES.map((option) => (
              <ChoiceRow
                key={option}
                selected={size === option}
                label={`${option} people`}
                onSelect={() => onSizeChange(option)}
              />
            ))}
          </div>
        </div>
      </div>
    </StepShell>
  );
}
