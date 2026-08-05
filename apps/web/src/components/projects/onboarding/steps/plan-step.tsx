'use client';

/**
 * Step 6 — choose how to start.
 *
 * This absorbs what used to be a separate "Connect a model" step. Picking a
 * paid plan IS how a user gets Kortix models, and `Start free` routes to
 * bring-your-own-key — two screens would have asked the same question twice.
 *
 * It is NEVER a gate. `Continue` carries no disabled condition: the chat
 * composer enforces model connection later, and blocking here would strand a
 * user who wants to look around before deciding to pay.
 */

import { useState } from 'react';

import { flattenModels } from '@/features/session/session-chat-input';
import { useModelConnectionGate } from '@/features/session/use-model-connection-gate';
import { useRuntimeProviders } from '@kortix/sdk/react';

import { ChoiceRow, StepShell } from '../step-shell';

type PlanChoice = 'free' | 'paid';

export function PlanStep({ onContinue }: { onContinue: () => void }) {
  const { data: providers } = useRuntimeProviders();
  const { openConnectProvider, openUpgrade, modal, hasSelectableModels, showUpgradeOption } =
    useModelConnectionGate(flattenModels(providers));
  const [choice, setChoice] = useState<PlanChoice | null>(null);

  return (
    <>
      {modal}
      <StepShell
        title="How do you want to start?"
        description={
          hasSelectableModels
            ? 'A model is already connected, so you’re ready either way. Pick a plan now or stay on free — you can change this anytime.'
            : 'Your agent needs a model to think with. Both options take under a minute, and you can change this anytime.'
        }
        primaryLabel="Continue"
        onPrimary={onContinue}
      >
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Plan">
          <ChoiceRow
            selected={choice === 'free'}
            label="Start free"
            description="Explore Kortix with your own API key from Anthropic, OpenAI, or any provider."
            onSelect={() => {
              setChoice('free');
              openConnectProvider('providers');
            }}
          />
          {/* Hidden when billing is off: there is no <GlobalUpgradeModal/>
              mounted to respond, so the row would be a dead click. */}
          {showUpgradeOption && (
            <ChoiceRow
              selected={choice === 'paid'}
              label="Start with a paid plan"
              description="Instant access to Kortix models, higher limits, and priority support."
              onSelect={() => {
                setChoice('paid');
                openUpgrade();
              }}
            />
          )}
        </div>
      </StepShell>
    </>
  );
}
