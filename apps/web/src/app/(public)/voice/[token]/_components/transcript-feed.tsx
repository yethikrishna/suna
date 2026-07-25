'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/features/layout/section/empty-state';
import { IconMessage } from '@/components/ui/kortix-icons';
import { StatusDot } from '@/components/ui/status';
import { cn } from '@/lib/utils';
import { useEffect, useRef } from 'react';

import type { TranscriptEntry } from './types';

/** Only auto-scroll if the reader was already near the bottom — never yank
 *  someone who scrolled up to re-read something the agent said earlier. */
const NEAR_BOTTOM_PX = 96;

/**
 * The centerpiece of the room: a live, two-sided transcript. Both the
 * human's speech and the agent's replies land here, in order, as LiveKit
 * delivers `TranscriptionSegment`s — interim results update in place and get
 * a distinct "still forming" treatment until they arrive `final`.
 */
export function TranscriptFeed({
  entries,
  className,
}: {
  entries: TranscriptEntry[];
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const wasNearBottomRef = useRef(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !wasNearBottomRef.current) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [entries]);

  return (
    <Card className={cn('flex min-h-0 flex-col', className)}>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          Transcript
          <StatusDot tone="success" pulse />
        </CardTitle>
      </CardHeader>
      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          wasNearBottomRef.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
        }}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
      >
        {entries.length === 0 ? (
          <div className="flex h-full min-h-40 items-center justify-center">
            <EmptyState
              size="sm"
              icon={IconMessage}
              title="Waiting for the conversation to start"
              description="Say something — what's said on either side shows up here, live."
            />
          </div>
        ) : (
          <CardContent className="space-y-3 p-0">
            {entries.map((entry) => (
              <TranscriptRow key={entry.id} entry={entry} />
            ))}
          </CardContent>
        )}
      </div>
    </Card>
  );
}

function TranscriptRow({ entry }: { entry: TranscriptEntry }) {
  return (
    <div className={cn('flex flex-col gap-1', entry.isLocal ? 'items-end' : 'items-start')}>
      <span className="text-muted-foreground px-1 text-xs font-medium">{entry.name}</span>
      <div
        className={cn(
          'max-w-[85%] rounded-md border px-3 py-2 text-sm text-pretty',
          entry.isLocal ? 'bg-primary/[0.06] border-primary/10' : 'bg-popover border-border',
          !entry.final && 'text-muted-foreground italic',
        )}
      >
        {entry.text || '…'}
        {!entry.final && (
          <span
            aria-hidden
            className="bg-current ml-1 inline-block size-1.5 animate-pulse rounded-full align-middle"
          />
        )}
      </div>
    </div>
  );
}
