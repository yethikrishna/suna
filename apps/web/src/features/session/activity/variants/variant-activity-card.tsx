'use client';

/**
 * Variant B — "Activity card".
 *
 * Thesis: a reader does not want a step list, they want to know the agent is
 * working and roughly on what. Every burst of work between two paragraphs
 * collapses into ONE card with a live status line; the step list only exists
 * inside it. Closest to the ChatGPT / Claude "thinking" card.
 *
 * BASELINE IMPLEMENTATION — being elevated. See the demo at /design-system/chat.
 */

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ToolPartRenderer } from '@/features/session/tool/tool-renderers';
import { cn } from '@/lib/utils';
import { type Turn, isTextPart } from '@/ui';
import { ChevronRight, Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import {
  type ActivityEntry,
  buildActivityItems,
  formatActivityDuration,
  summarizeEntries,
} from '../activity-model';
import { activityGroupLabel, humanizeShellStep } from '../humanize';
import { AssistantProse, UserBubble, useTurnParts, useTurns } from './shared';
import type { ChatVariantProps } from './types';

function stepLabel(part: ActivityEntry['part']): string {
  const input = ((part.state as { input?: Record<string, unknown> })?.input ?? {}) as Record<
    string,
    unknown
  >;
  if (part.tool.replace(/^oc-/, '') === 'bash') {
    return humanizeShellStep({
      description: input.description as string | undefined,
      command: input.command as string | undefined,
    });
  }
  const path = (input.filePath ?? input.path ?? input.pattern ?? input.query) as string | undefined;
  const verb = part.tool.replace(/^oc-/, '').replace(/[-_]/g, ' ');
  return path ? `${verb} · ${path.split('/').slice(-1)[0]}` : verb;
}

function ActivityCard({ entries, sessionId }: { entries: ActivityEntry[]; sessionId: string }) {
  const [open, setOpen] = useState(false);
  const summary = summarizeEntries(entries);
  const duration = formatActivityDuration(summary.durationMs);
  // The last step's own words are the best available "what is it doing".
  const current = stepLabel(entries[entries.length - 1].part);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="border-border/70 bg-card overflow-hidden rounded-xl border">
        <CollapsibleTrigger asChild>
          <div className="hover:bg-muted/40 flex cursor-pointer items-center gap-2.5 px-3 py-2.5 transition-colors select-none">
            <span className="bg-muted flex size-6 shrink-0 items-center justify-center rounded-md">
              {summary.running ? (
                <Loader2 className="text-muted-foreground size-3.5 animate-spin" />
              ) : (
                <Sparkles className="text-muted-foreground size-3.5" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-foreground block truncate text-sm font-medium">
                {activityGroupLabel(summary.counts, summary.running)}
              </span>
              <span className="text-muted-foreground block truncate text-xs">{current}</span>
            </span>
            {duration && (
              <span className="text-muted-foreground/50 shrink-0 font-mono text-xs tabular-nums">
                {duration}
              </span>
            )}
            <ChevronRight
              className={cn(
                'text-muted-foreground/40 size-4 shrink-0 transition-transform',
                open && 'rotate-90',
              )}
            />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-border/60 space-y-1 border-t px-3 py-2">
            {entries.map(({ part }) => (
              <div key={part.id} className="text-muted-foreground truncate py-0.5 text-xs">
                {stepLabel(part)}
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function VariantActivityCard({ messages, sessionId, isBusy }: ChatVariantProps) {
  const turns = useTurns(messages);
  return (
    <div className="space-y-8">
      {turns.map((turn) => (
        <TurnBody key={turn.userMessage.info.id} turn={turn} sessionId={sessionId} isBusy={isBusy} />
      ))}
    </div>
  );
}

function TurnBody({ turn, sessionId }: { turn: Turn; sessionId: string; isBusy?: boolean }) {
  const parts = useTurnParts(turn);
  // 'simple' — a burst is a burst, regardless of which tools it mixes.
  const items = buildActivityItems(parts, { density: 'simple' });

  return (
    <div className="space-y-3">
      <UserBubble turn={turn} />
      {items.map((item) => {
        switch (item.type) {
          case 'text':
            return (
              <AssistantProse
                key={item.key}
                text={isTextPart(item.part) ? (item.part.text ?? '') : ''}
              />
            );
          case 'group':
            return <ActivityCard key={item.key} entries={item.entries} sessionId={sessionId} />;
          case 'tool':
            return <ActivityCard key={item.key} entries={[item.entry]} sessionId={sessionId} />;
          case 'deliverable':
            return <ToolPartRenderer key={item.key} part={item.entry.part} sessionId={sessionId} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
