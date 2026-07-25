'use client';

/**
 * Variant C — "Narrative".
 *
 * Thesis: the default transcript should contain only what a non-technical
 * reader would want to read aloud — what they asked, what the agent said, and
 * what it produced. ALL machinery collapses to one ghost line per turn.
 * Closest to Claude Cowork.
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
  type ActivityItem,
  buildActivityItems,
  formatActivityDuration,
  summarizeItems,
} from '../activity-model';
import { humanizeShellStep } from '../humanize';
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

/** One ghost line for the entire turn's machinery. */
function WorkLine({ items }: { items: ActivityItem[] }) {
  const [open, setOpen] = useState(false);
  const summary = summarizeItems(items);
  if (summary.totalSteps === 0) return null;
  const duration = formatActivityDuration(summary.durationMs);

  const entries: ActivityEntry[] = items.flatMap((item) =>
    item.type === 'group' ? item.entries : item.type === 'tool' ? [item.entry] : [],
  );

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <div className="group/work text-muted-foreground/50 hover:text-muted-foreground flex cursor-pointer items-center gap-1.5 py-0.5 text-xs select-none">
          {summary.running && <Loader2 className="size-3 animate-spin" />}
          <span>
            {summary.running ? 'Working…' : `${summary.totalSteps} steps`}
            {duration && !summary.running ? ` · ${duration}` : ''}
          </span>
          <ChevronRight
            className={cn(
              'size-3 opacity-0 transition-transform group-hover/work:opacity-100',
              open && 'rotate-90 opacity-100',
            )}
          />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-border/40 mt-1 mb-2 ml-1 space-y-0.5 border-l pl-3">
          {entries.map(({ part }) => (
            <div key={part.id} className="text-muted-foreground/60 truncate py-0.5 text-xs">
              {stepLabel(part)}
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function VariantNarrative({ messages, sessionId, isBusy }: ChatVariantProps) {
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
  const items = buildActivityItems(parts, { density: 'simple' });

  // Narrative keeps prose and deliverables in place; everything else is rolled
  // into the single work line that leads the agent's answer.
  const machinery = items.filter((i) => i.type === 'group' || i.type === 'tool');
  const visible = items.filter((i) => i.type === 'text' || i.type === 'deliverable');

  return (
    <div className="space-y-3">
      <UserBubble turn={turn} />
      <WorkLine items={machinery} />
      {visible.map((item) =>
        item.type === 'text' ? (
          <AssistantProse
            key={item.key}
            text={isTextPart(item.part) ? (item.part.text ?? '') : ''}
          />
        ) : item.type === 'deliverable' ? (
          <ToolPartRenderer key={item.key} part={item.entry.part} sessionId={sessionId} />
        ) : null,
      )}
    </div>
  );
}
