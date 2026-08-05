'use client';

/**
 * Step 3, survey question 2 — who the team works for.
 *
 * Domain and size share one screen because they are one thought. Both fields
 * are optional, so `Continue` is never disabled: this is a survey, not a form,
 * and gating the flow on it would trade real activation for a data point.
 */

import type { OnboardingCompanySize } from '@kortix/sdk';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { COMPANY_SIZES } from '../onboarding-profile';
import { ChoiceRow, StepShell } from '../step-shell';

export function CompanyStep({
  eyebrow,
  domain,
  size,
  onDomainChange,
  onSizeChange,
  onContinue,
  onSkip,
}: {
  eyebrow?: string;
  domain: string;
  size: OnboardingCompanySize | null;
  onDomainChange: (v: string) => void;
  onSizeChange: (v: OnboardingCompanySize) => void;
  onContinue: () => void;
  onSkip: () => void;
}) {
  return (
    <StepShell
      eyebrow={eyebrow}
      title="Tell us about your company"
      description="Your agent uses the domain to research your own company. Nothing is shared publicly."
      primaryLabel="Continue"
      onPrimary={onContinue}
      skipLabel="Skip these questions"
      onSkip={onSkip}
    >
      <div className="flex flex-col gap-5">
        <div className="space-y-2">
          <Label htmlFor="onboarding-company-domain">Company domain</Label>
          <Input
            id="onboarding-company-domain"
            value={domain}
            onChange={(e) => onDomainChange(e.target.value)}
            placeholder="acme.com"
            autoComplete="organization"
            spellCheck={false}
            className="h-10"
          />
        </div>

        <div className="space-y-2">
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
