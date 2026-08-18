import { type WebQueuedMessage, hadAttachments } from '@/stores/message-queue-store';
import type { SessionPrompt } from '@kortix/sdk';

/**
 * What the composer's queue strip renders, from the TWO things that can hold a
 * pending message.
 *
 * The server inbox (`GET .../prompts`) is the queue: durable, shared across
 * tabs and devices, ordered and admitted by the control plane. It is where
 * every PROMPT goes.
 *
 * The browser store still holds two kinds of entry that cannot go there yet:
 *
 *  - a `/` COMMAND, which is not a prompt. It is dispatched through
 *    `runCommand`/`executeCommand`, never through `POST .../prompts`, so the
 *    inbox has no row to order it by — and putting it straight on the wire
 *    mid-turn aborts the answer in progress, which is the harm the queue exists
 *    to prevent;
 *  - anything typed in the INSTANT BOOT SHELL, whose first message is still
 *    travelling through the start stash rather than the inbox. Enqueuing those
 *    server-side would deliver them BEFORE the first message, because the first
 *    message is not a row yet.
 *
 * Rendering only one of the two sources is how a queued message becomes
 * invisible: the local ones vanished when SessionChat took over the render, and
 * the server ones never appeared during boot. So both are projected here, and
 * the row's ORIGIN travels with it — every row action has to address the thing
 * that actually holds it.
 */

export type QueueRowSource = 'server' | 'local';

export interface QueueRow {
  id: string;
  text: string;
  lostAttachments?: number;
  lastError?: string;
  source: QueueRowSource;
}

export interface QueueProjection {
  /** Pending rows, in dispatch order. */
  queued: QueueRow[];
  /** Rows that gave up and offer a retry. */
  failed: QueueRow[];
  /** Rows already on the wire: not editable, not removable. */
  inFlightIds: string[];
  /** The SERVER queue is held by a stop — see `holdSessionPrompts`. */
  held: boolean;
  /** Which of the ids above live in the browser store rather than the inbox. */
  localIds: Set<string>;
}

function localRow(message: WebQueuedMessage): QueueRow {
  const lost = hadAttachments(message);
  return {
    id: message.id,
    // A command entry's `text` is its ARGUMENTS, which for an argument-less
    // command is the empty string — a blank chip the user cannot identify.
    text: message.command
      ? `/${message.command.name}${message.text ? ` ${message.text}` : ''}`
      : message.text,
    ...(lost > 0 ? { lostAttachments: lost } : {}),
    ...(message.lastError ? { lastError: message.lastError } : {}),
    source: 'local' as const,
  };
}

export function projectQueueRows(input: {
  prompts: SessionPrompt[];
  local: { pending: WebQueuedMessage[]; failed: WebQueuedMessage[] };
  localInFlightIds: string[];
}): QueueProjection {
  const serverQueued: QueueRow[] = [];
  const serverFailed: QueueRow[] = [];
  const inFlightIds: string[] = [...input.localInFlightIds];
  let held = false;

  for (const prompt of input.prompts) {
    const row: QueueRow = {
      id: prompt.prompt_id,
      text: prompt.text,
      ...(prompt.last_error ? { lastError: prompt.last_error } : {}),
      source: 'server' as const,
    };
    if (prompt.reason === 'held') held = true;
    if (prompt.state === 'failed') serverFailed.push(row);
    else if (prompt.state === 'delivering') inFlightIds.push(prompt.prompt_id);
    else serverQueued.push(row);
  }

  // Local first: those entries are dispatched by the browser drain at the next
  // safe boundary, while a server row waits for the admission gate's own
  // backoff — so this is the order they actually go out in. It is an
  // approximation of one merged clock, and deliberately so: the two sources
  // have no shared timestamp, and the alternative (dropping one) is what made
  // messages disappear.
  const localPending = input.local.pending.map(localRow);
  const localFailed = input.local.failed.map(localRow);

  return {
    queued: [...localPending, ...serverQueued],
    failed: [...localFailed, ...serverFailed],
    inFlightIds,
    held,
    localIds: new Set([...localPending, ...localFailed].map((row) => row.id)),
  };
}
