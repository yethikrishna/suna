'use client';

/**
 * How to power the agent.
 *
 * The earlier version fired a modal the instant a row was clicked. That is the
 * defect: the user taps to *consider* an option and gets a whole separate flow
 * thrown at them, so they back out and lose the thread. Here, selecting a row
 * only selects. `Continue` performs whatever was chosen.
 *
 * "Decide later" exists so nobody is ever cornered. The chat composer already
 * gates on model connection at the moment it actually matters, which makes
 * deferring a legitimate answer rather than an escape hatch.
 */

import { CheckIcon as Check, KeyIcon as Key, ClockIcon as Clock, SparkleIcon as Sparkle } from '@phosphor-icons/react';
import { useState } from 'react';

import { InfoBanner } from '@/components/ui/info-banner';
import { flattenModels } from '@/features/session/session-chat-input';
import { useModelConnectionGate } from '@/features/session/use-model-connection-gate';
import { useRuntimeProviders } from '@kortix/sdk/react';

import { ChoiceRow, StepShell } from '../step-shell';

type PlanChoice = 'kortix' | 'byok' | 'later';

export function PlanStep({ onContinue }: { onContinue: () => void }) {
  const { data: providers } = useRuntimeProviders();
  const { openConnectProvider, openUpgrade, modal, hasSelectableModels, showUpgradeOption } =
    useModelConnectionGate(flattenModels(providers));
  const [choice, setChoice] = useState<PlanChoice | null>(null);

  // Nothing opens until Continue. This is the whole point of the step.
  const handleContinue = () => {
    if (choice === 'kortix') openUpgrade();
    else if (choice === 'byok') openConnectProvider('providers');
    else onContinue();
  };

  return (
    <>
      {modal}
      <StepShell
        title="How do you want to power your agent?"
        description={
          hasSelectableModels
            ? 'A model is already connected, so you’re good to go. Add another provider or upgrade if you want more.'
            : 'Your agent needs a model to think with. Nothing happens until you continue.'
        }
        // The label names what the button will actually do, so the modal that
        // opens is never a surprise.
        primaryLabel={
          choice === 'kortix' ? 'See plans' : choice === 'byok' ? 'Add a key' : 'Continue'
        }
        onPrimary={handleContinue}
      >
        <div className="flex flex-col gap-2">
          {/* A connected model is context, not an answer. The options stay —
              removing them stranded anyone who wanted to add a second provider
              or move onto a plan. */}
          {hasSelectableModels && (
            <InfoBanner tone="success" icon={Check} title="Model connected" className="mb-2">
              You can switch models or add another provider at any time.
            </InfoBanner>
          )}

          <div className="flex flex-col gap-2" role="radiogroup" aria-label="Model access">
            {showUpgradeOption && (
              <ChoiceRow
                selected={choice === 'kortix'}
                label="Use Kortix models"
                description="Instant access, higher limits, nothing to configure"
                onSelect={() => setChoice('kortix')}
                leading={<Sparkle className="text-muted-foreground size-4 shrink-0" />}
              />
            )}
            <ChoiceRow
              selected={choice === 'byok'}
              label={hasSelectableModels ? 'Connect another provider' : 'Bring your own API key'}
              description="Anthropic, OpenAI, or any other provider"
              onSelect={() => setChoice('byok')}
              leading={<Key className="text-muted-foreground size-4 shrink-0" />}
            />
            <ChoiceRow
              selected={choice === 'later'}
              label={hasSelectableModels ? 'Keep what I have' : 'Decide later'}
              description={
                hasSelectableModels
                  ? 'Carry on with the model that’s already connected'
                  : 'The composer will ask the first time you send a task'
              }
              onSelect={() => setChoice('later')}
              leading={<Clock className="text-muted-foreground size-4 shrink-0" />}
            />
          </div>
        </div>
      </StepShell>
    </>
  );
}
