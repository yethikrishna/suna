'use client';

/**
 * How to power the agent.
 *
 * Selecting a card only selects. `Continue` performs it, and its label names
 * what will happen — an earlier version fired a modal the instant a row was
 * clicked, so tapping to consider an option threw a separate flow at the user
 * and they backed out of it.
 *
 * A connected model is context, not an answer: the options stay available so
 * nobody who wants a second provider or a plan is stranded on a confirmation
 * screen.
 */

import {
  CheckIcon as Check,
  ClockIcon as Clock,
  KeyIcon as Key,
  SparkleIcon as Sparkle,
} from '@phosphor-icons/react';
import { useState } from 'react';

import { InfoBanner } from '@/components/ui/info-banner';
import { flattenModels } from '@/features/session/session-chat-input';
import { useModelConnectionGate } from '@/features/session/use-model-connection-gate';
import { useRuntimeProviders } from '@kortix/sdk/react';

import { OptionCard, OptionGrid, StepShell } from '../step-shell';

type PlanChoice = 'kortix' | 'byok' | 'later';

export function PlanStep({ stepLabel, onContinue }: { stepLabel: string; onContinue: () => void }) {
  const { data: providers } = useRuntimeProviders();
  const { openConnectProvider, openUpgrade, modal, hasSelectableModels, showUpgradeOption } =
    useModelConnectionGate(flattenModels(providers));
  const [choice, setChoice] = useState<PlanChoice | null>(null);

  const handleContinue = () => {
    if (choice === 'kortix') openUpgrade();
    else if (choice === 'byok') openConnectProvider('providers');
    else onContinue();
  };

  return (
    <>
      {modal}
      <StepShell
        stepLabel={stepLabel}
        title="How do you want to power your agent?"
        description={
          hasSelectableModels
            ? 'A model is already connected, so you’re good to go. Add another provider or upgrade if you want more.'
            : 'Your agent needs a model to think with. Nothing opens until you continue.'
        }
        primaryLabel={
          choice === 'kortix' ? 'See plans' : choice === 'byok' ? 'Add a key' : 'Continue'
        }
        onPrimary={handleContinue}
      >
        <div className="space-y-4">
          {hasSelectableModels && (
            <InfoBanner tone="success" icon={Check} title="Model connected">
              You can switch models or add another provider at any time.
            </InfoBanner>
          )}

          <OptionGrid label="Model access">
            {showUpgradeOption && (
              <OptionCard
                selected={choice === 'kortix'}
                label="Use Kortix models"
                description="Instant access, higher limits"
                onSelect={() => setChoice('kortix')}
                icon={<Sparkle className="text-muted-foreground size-4" />}
              />
            )}
            <OptionCard
              selected={choice === 'byok'}
              label={hasSelectableModels ? 'Connect another provider' : 'Bring your own API key'}
              description="Anthropic, OpenAI, or any other"
              onSelect={() => setChoice('byok')}
              icon={<Key className="text-muted-foreground size-4" />}
            />
            <OptionCard
              selected={choice === 'later'}
              label={hasSelectableModels ? 'Keep what I have' : 'Decide later'}
              description={
                hasSelectableModels ? 'Carry on as you are' : 'The composer will ask you first time'
              }
              onSelect={() => setChoice('later')}
              icon={<Clock className="text-muted-foreground size-4" />}
            />
          </OptionGrid>
        </div>
      </StepShell>
    </>
  );
}
