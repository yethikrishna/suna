'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';

import { ProgressRing } from '@/components/ui/progress-ring';
import { STATUS_TEXT } from '@/components/ui/status';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { MessageWithParts } from '@kortix/sdk/react';

import type { FlatModel } from '../model-flatten';

// ============================================================================
// Token Progress Circle
// ============================================================================
//
// Deliberately kept visible in BOTH the simple and advanced composer toolbars
// (see composer-toolbar.tsx) — it's a quiet, non-interactive ring with no
// label text, not a "control" a non-technical user has to understand. The
// brief for the composer simplification explicitly allows ambient surfaces
// like this to stay put: it communicates "the conversation is getting long"
// without asking anyone to know what a token is.

interface TokenProgressProps {
  messages: MessageWithParts[] | undefined;
  models?: FlatModel[];
  selectedModel?: { providerID: string; modelID: string } | null;
  onContextClick?: () => void;
}

export interface TokenBreakdown {
  /**
   * Everything the conversation currently occupies. Equal to the provider's own
   * `totalTokens`: the SDK's ACP projection reconciles the five components
   * against it before they reach here (`reportedTokens` in
   * `packages/sdk/src/core/acp/projection.ts`), so summing them is exact for
   * every provider — including the ones that bill thinking inside `output`.
   */
  total: number;
  input: number;
  output: number;
  /** Thinking. Real spend and real context — shown, never folded away. */
  reasoning: number;
  /** Cache reads plus writes. The bulk of a long conversation's occupancy. */
  cached: number;
}

const EMPTY_BREAKDOWN: TokenBreakdown = {
  total: 0,
  input: 0,
  output: 0,
  reasoning: 0,
  cached: 0,
};

export function getLastAssistantTokenBreakdown(
  messages: MessageWithParts[] | undefined,
): TokenBreakdown {
  if (!messages) return EMPTY_BREAKDOWN;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.info.role !== 'assistant') continue;
    const t = (msg.info as any).tokens;
    if (!t) continue;
    const breakdown: TokenBreakdown = {
      input: t.input ?? 0,
      output: t.output ?? 0,
      reasoning: t.reasoning ?? 0,
      cached: (t.cache?.read ?? 0) + (t.cache?.write ?? 0),
      total: 0,
    };
    breakdown.total = breakdown.input + breakdown.output + breakdown.reasoning + breakdown.cached;
    if (breakdown.total > 0) return breakdown;
  }
  return EMPTY_BREAKDOWN;
}

export function getLastAssistantTokenTotal(messages: MessageWithParts[] | undefined): number {
  return getLastAssistantTokenBreakdown(messages).total;
}

export function getContextLimit(
  models: FlatModel[] | undefined,
  selectedModel: { providerID: string; modelID: string } | null | undefined,
): number {
  if (selectedModel && models) {
    const model = models.find(
      (m) => m.providerID === selectedModel.providerID && m.modelID === selectedModel.modelID,
    );
    if (model?.contextWindow && model.contextWindow > 0) return model.contextWindow;
  }
  return 200000;
}

export function TokenProgress({
  messages,
  models,
  selectedModel,
  onContextClick,
}: TokenProgressProps) {
  const tHardcodedUi = useTranslations('hardcodedUi');
  const breakdown = useMemo(() => getLastAssistantTokenBreakdown(messages), [messages]);
  const contextTokens = breakdown.total;
  const contextLimit = useMemo(
    () => getContextLimit(models, selectedModel),
    [models, selectedModel],
  );
  const ratio = contextTokens > 0 ? Math.min(contextTokens / contextLimit, 1) : 0;

  if (contextTokens === 0 && !onContextClick) return null;

  const color =
    ratio >= 0.9
      ? STATUS_TEXT.destructive
      : ratio > 0.8
        ? STATUS_TEXT.warning
        : 'text-muted-foreground';

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="relative inline-flex">
            <button
              type="button"
              className="flex size-6 cursor-pointer items-center justify-center"
              onPointerDown={(e) => {
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
                onContextClick?.();
              }}
            >
              <ProgressRing
                value={Math.round(ratio * 100)}
                className="size-5"
                progressClassName={color}
              />
            </button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">
          <div className="space-y-0.5 font-mono text-xs">
            <div>
              Context: {(contextTokens / 1000).toFixed(1)}
              {tHardcodedUi.raw('componentsSessionSessionChatInput.line736JsxTextK')}
              {(contextLimit / 1000).toFixed(0)}
              {tHardcodedUi.raw('componentsSessionSessionChatInput.line736JsxTextKTokens')}
            </div>
            <div className="text-muted-foreground">
              {Math.round(ratio * 100)}
              {tHardcodedUi.raw('componentsSessionSessionChatInput.line737JsxTextUsed')}
            </div>
            {contextTokens > 0 && (
              <div className="space-y-0.5 border-t border-border/60 pt-1 text-muted-foreground">
                {(
                  [
                    ['Cached', breakdown.cached],
                    ['Input', breakdown.input],
                    ['Thinking', breakdown.reasoning],
                    ['Output', breakdown.output],
                  ] as const
                )
                  .filter(([, value]) => value > 0)
                  .map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-3">
                      <span>{label}</span>
                      <span className="tabular-nums">{value.toLocaleString()}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
