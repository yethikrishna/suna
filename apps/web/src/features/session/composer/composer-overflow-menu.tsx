'use client';

import { useState } from 'react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { Agent, ProviderListResponse } from '@kortix/sdk/react';
import { EllipsisIcon } from 'lucide-react';

import type { FlatModel } from '../model-flatten';
import type { ReasoningEffortModelKey } from '../reasoning-effort-selector';
import { ReasoningEffortSelector } from '../reasoning-effort-selector';
import type { ModelDefaultControls } from '../model-selector';
import { ModelSelector } from '../model-selector';
import { AgentSelector } from './agent-selector';
import { useComposerPreferencesStore } from './composer-preferences';
import { VariantSelector } from './variant-selector';

/**
 * The single low-emphasis control the simple composer toolbar hides
 * everything power-user-ish behind: agent, model, variant, reasoning effort.
 * Each row still opens its EXISTING selector popover unchanged (nested Radix
 * popovers are supported out of the box — the same `command.tsx` primitives
 * this app already nests inside modals elsewhere) — so nothing about how
 * those controls work had to change, only where they render.
 *
 * *** HIERARCHY: why Agent is listed above Model ***
 * Both are "reachable in one click" once this menu is open — neither is
 * buried behind a second menu. Kortix's product model centers on Agents:
 * named personas with their own skills/instructions, picked by outcome
 * ("Research assistant", "Deploy agent") — the same mental model as
 * ChatGPT's Custom-GPT picker or a Claude Project. That's what a
 * non-technical user recognizes as "who am I talking to". The Model
 * (`gpt-5.6-sol`, `claude-hawk`, ...) is the engine swapped in underneath
 * that persona — a genuine power lever (cost/quality/latency), and one that
 * means little to read without already knowing what "a model" is. So Agent
 * gets top billing; Model sits directly below it, equally one click away.
 */
export interface ComposerOverflowMenuProps {
  agents: Agent[];
  selectedAgent: string | null;
  onAgentChange: (agentName: string | null) => void;
  agentSelectorLocked: boolean;
  showAgent: boolean;

  models: FlatModel[];
  selectedModel: { providerID: string; modelID: string } | null;
  onModelChange: (model: { providerID: string; modelID: string } | null) => void;
  modelDefaultControls?: ModelDefaultControls;
  providers?: ProviderListResponse;
  showModel: boolean;

  variants: string[];
  selectedVariant: string | null;
  onVariantChange: (variant: string | null) => void;
  showVariant: boolean;

  reasoningModel: ReasoningEffortModelKey | null;
  projectId: string | undefined;
  showReasoningEffort: boolean;
}

function OverflowRow({
  label,
  emphasis = false,
  children,
}: {
  label: string;
  emphasis?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span
        className={cn(
          'text-xs',
          emphasis ? 'text-foreground font-medium' : 'text-muted-foreground',
        )}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

export function ComposerOverflowMenu({
  agents,
  selectedAgent,
  onAgentChange,
  agentSelectorLocked,
  showAgent,
  models,
  selectedModel,
  onModelChange,
  modelDefaultControls,
  providers,
  showModel,
  variants,
  selectedVariant,
  onVariantChange,
  showVariant,
  reasoningModel,
  projectId,
  showReasoningEffort,
}: ComposerOverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const composerMode = useComposerPreferencesStore((s) => s.mode);
  const setComposerMode = useComposerPreferencesStore((s) => s.setMode);
  const showAdvancedRow = variants.length > 0 || showReasoningEffort;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="More options"
          className={cn(
            'text-muted-foreground hover:text-foreground hover:bg-muted inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-colors',
            open && 'bg-muted text-foreground',
          )}
        >
          <EllipsisIcon className="size-4" strokeWidth={2} />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" sideOffset={8} className="w-64 space-y-3 p-3">
        {(showAgent || showModel) && (
          <div className="space-y-2">
            {showAgent && (
              <OverflowRow label="Agent" emphasis>
                <AgentSelector
                  agents={agents}
                  selectedAgent={selectedAgent}
                  onSelect={onAgentChange}
                  disabled={agentSelectorLocked}
                />
              </OverflowRow>
            )}
            {showModel && (
              <OverflowRow label="Model">
                <ModelSelector
                  models={models}
                  selectedModel={selectedModel}
                  onSelect={onModelChange}
                  providers={providers}
                  defaultControls={modelDefaultControls}
                />
              </OverflowRow>
            )}
          </div>
        )}

        {showAdvancedRow && (
          <div className={cn('flex flex-wrap items-center gap-1', (showAgent || showModel) && 'border-border/60 border-t pt-2')}>
            {variants.length > 0 && (
              <VariantSelector
                variants={variants}
                selectedVariant={selectedVariant}
                onSelect={onVariantChange}
              />
            )}
            {showReasoningEffort && (
              <ReasoningEffortSelector model={reasoningModel} projectId={projectId} />
            )}
          </div>
        )}

        <div
          className={cn(
            'border-border/60 flex items-center justify-between gap-3 border-t pt-2.5',
          )}
        >
          <span className="text-muted-foreground text-xs">Show all controls in toolbar</span>
          <Switch
            checked={composerMode === 'advanced'}
            onCheckedChange={(checked: boolean) =>
              setComposerMode(checked ? 'advanced' : 'simple')
            }
            aria-label="Show all composer controls in the toolbar"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
