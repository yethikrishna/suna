'use client';

/**
 * Variant A — "Grouped".
 *
 * Thesis: the current transcript is right in structure and wrong in volume.
 * Keep the step list, but fold every run of like work into one human line and
 * never print a raw command at rest.
 *
 * BASELINE IMPLEMENTATION — being elevated. See the demo at /design-system/chat.
 */

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ToolPartRenderer } from '@/features/session/tool/tool-renderers';
import { cn } from '@/lib/utils';
import { type Turn, isTextPart } from '@/ui';
import { ChevronRight, Loader2 } from 'lucide-react';
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

function ActivityGroup({ entries }: { entries: ActivityEntry[] }) {
  const [open, setOpen] = useState(false);
  const summary = summarizeEntries(entries);
  const duration = formatActivityDuration(summary.durationMs);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <div className="group/act text-muted-foreground/80 hover:text-foreground flex cursor-pointer items-center gap-2 py-1 text-xs select-none">
          <span className="min-w-0 flex-1 truncate">
            {activityGroupLabel(summary.counts, summary.running)}
          </span>
          {duration && (
            <span className="text-muted-foreground/40 font-mono tabular-nums">{duration}</span>
          )}
          {summary.running && <Loader2 className="size-3 animate-spin" />}
          <ChevronRight
            className={cn(
              'size-3 shrink-0 opacity-0 transition-transform group-hover/act:opacity-100',
              open && 'rotate-90 opacity-100',
            )}
          />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-border/40 mt-1 mb-2 ml-1 space-y-1 border-l pl-3">
          {entries.map(({ part }) => (
            <div key={part.id} className="text-muted-foreground/70 text-xs">
              <div className="truncate py-0.5">{stepLabel(part)}</div>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function VariantGrouped({ messages, sessionId, isBusy }: ChatVariantProps) {
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
  const items = buildActivityItems(parts, { density: 'detailed' });

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
            return <ActivityGroup key={item.key} entries={item.entries} />;
          case 'tool':
          case 'deliverable':
            return (
              <ToolPartRenderer key={item.key} part={item.entry.part} sessionId={sessionId} />
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
