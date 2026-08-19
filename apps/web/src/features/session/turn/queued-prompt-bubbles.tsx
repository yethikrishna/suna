'use client';

/**
 * Prompts that are queued but not yet in the transcript, drawn IN the
 * transcript — as the user bubbles they are about to become.
 *
 * The queue used to be a strip above the composer: a separate list, a
 * separate visual language, and one more place the same message could show
 * up. A message you send while the agent works is still a message; it belongs
 * in the conversation, at the bottom, in order, and it should read as
 * "scheduled" until the agent takes it. So each row here is the same bubble
 * `UserMessage` draws (`BUBBLE_SURFACE`, right rail, 80% cap) at half opacity,
 * and when the server hands it to OpenCode the row leaves this list and its
 * real transcript bubble takes the same spot — still dimmed while the agent
 * has not reached it (`SessionTurn`'s `pending`), full opacity once it has.
 * The transition is one continuous fade, never a jump between two surfaces.
 *
 * Controls live under the bubble on hover, like the sent bubble's own meta
 * row: remove; send now while the queue is HELD by a stop (the only way out
 * of a hold, otherwise a stopped queue is indistinguishable from a broken
 * one); retry on a failed row. A row already on the wire has no controls —
 * the server refuses every action for it — and says so.
 */

import { Button } from '@/components/ui/button';
import Hint from '@/components/ui/hint';
import { InlineMeta } from '@/components/ui/inline-meta';
import { cn } from '@/lib/utils';
import {
  ArrowClockwiseIcon,
  PaperPlaneRightIcon,
  TrashIcon,
  WarningIcon,
} from '@phosphor-icons/react';
import { BUBBLE_SURFACE, BUBBLE_TEXT } from './user-message';

export interface QueuedPromptRow {
  id: string;
  text: string;
  /** Present on a failed row. */
  lastError?: string;
}

export interface QueuedPromptBubblesProps {
  queued: QueuedPromptRow[];
  failed?: QueuedPromptRow[];
  /** Rows the server already handed to OpenCode, or this tab's not-yet-acked
   *  echo: rendered, inert. */
  inFlightIds?: ReadonlySet<string> | string[];
  /** The queue is held by a stop — reveals "send now". */
  held?: boolean;
  onRemove?: (id: string) => void;
  onSendNow?: (id: string) => void;
  onRetry?: (id: string) => void;
  className?: string;
}

/** The dim a scheduled bubble sits at. One number, so the transcript's
 *  pending turn (`SessionTurn`) and this list agree. */
export const QUEUED_BUBBLE_OPACITY_CLASS = 'opacity-50';

function Action({
  label,
  onClick,
  children,
  destructive,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  destructive?: boolean;
}) {
  return (
    <Hint label={label} side="top" align="center">
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={label}
        onClick={onClick}
        className={cn(destructive && 'hover:text-destructive')}
      >
        {children}
      </Button>
    </Hint>
  );
}

function QueuedBubble({
  row,
  status,
  inFlight,
  failed,
  held,
  onRemove,
  onSendNow,
  onRetry,
}: {
  row: QueuedPromptRow;
  status: string;
  inFlight: boolean;
  failed: boolean;
  held: boolean;
  onRemove?: (id: string) => void;
  onSendNow?: (id: string) => void;
  onRetry?: (id: string) => void;
}) {
  const showActions = !inFlight && (Boolean(onRemove) || (failed && onRetry) || (held && onSendNow));
  return (
    <div
      data-queued-prompt-id={row.id}
      data-queued-state={failed ? 'failed' : inFlight ? 'in-flight' : held ? 'held' : 'queued'}
      className="group/queued ml-auto flex w-full max-w-[80%] flex-col items-end gap-2 self-end"
    >
      <div
        className={cn(
          BUBBLE_SURFACE,
          'w-fit transition-opacity duration-500',
          failed ? 'opacity-90' : QUEUED_BUBBLE_OPACITY_CLASS,
        )}
      >
        <div className={cn('max-w-full min-w-0 max-h-[200px] overflow-hidden', BUBBLE_TEXT)}>
          {row.text}
        </div>
      </div>
      {/* Same anatomy as the sent bubble's meta row: status text + controls,
          revealed on hover, height held so nothing reflows. A failed row keeps
          its row visible — a failure the user has to hunt for is a message
          silently lost. */}
      <div
        className={cn(
          'flex w-full items-center justify-end gap-2 transition-opacity duration-150',
          failed
            ? 'opacity-100'
            : 'opacity-0 group-hover/queued:opacity-100 focus-within:opacity-100',
        )}
      >
        <InlineMeta>
          <span className={cn('flex items-center gap-1', failed && 'text-destructive')}>
            {failed && <WarningIcon className="size-3.5" />}
            {status}
          </span>
        </InlineMeta>
        {showActions && (
          <div className="flex shrink-0 items-center gap-0.5">
            {failed && onRetry && (
              <Action label="Retry" onClick={() => onRetry(row.id)}>
                <ArrowClockwiseIcon className="size-4" />
              </Action>
            )}
            {!failed && held && onSendNow && (
              <Action label="Send now" onClick={() => onSendNow(row.id)}>
                <PaperPlaneRightIcon className="size-4" />
              </Action>
            )}
            {onRemove && (
              <Action label="Remove" onClick={() => onRemove(row.id)} destructive>
                <TrashIcon className="size-4" />
              </Action>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function QueuedPromptBubbles({
  queued,
  failed = [],
  inFlightIds,
  held = false,
  onRemove,
  onSendNow,
  onRetry,
  className,
}: QueuedPromptBubblesProps) {
  if (queued.length === 0 && failed.length === 0) return null;
  const inFlight = inFlightIds instanceof Set ? inFlightIds : new Set(inFlightIds ?? []);
  return (
    <div
      role="list"
      aria-label={held ? 'Queued prompts, held' : 'Queued prompts'}
      className={cn('flex flex-col gap-4', className)}
    >
      {queued.map((row) => {
        const onWire = inFlight.has(row.id);
        return (
          <QueuedBubble
            key={row.id}
            row={row}
            inFlight={onWire}
            failed={false}
            held={held}
            status={onWire ? 'Sending' : held ? 'Held — stopped' : 'Queued'}
            onRemove={onRemove}
            onSendNow={onSendNow}
          />
        );
      })}
      {failed.map((row) => (
        <QueuedBubble
          key={row.id}
          row={row}
          inFlight={false}
          failed
          held={false}
          status={row.lastError ? `Not sent — ${row.lastError}` : 'Not sent'}
          onRemove={onRemove}
          onRetry={onRetry}
        />
      ))}
    </div>
  );
}
