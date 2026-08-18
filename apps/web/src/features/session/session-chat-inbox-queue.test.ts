import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Source assertions, for the same reason as `session-chat-queued-retry-id.test.ts`:
// `SessionChat` is a 4k-line component with no DOM harness in this app, and the
// wiring under test is which value reaches which call. Every slice is taken
// through `between()`, which FAILS on a missing anchor rather than yielding ''
// and passing.
const chat = readFileSync(fileURLToPath(new URL('./session-chat.tsx', import.meta.url)), 'utf8');
const composer = readFileSync(
  fileURLToPath(new URL('./composer/composer.tsx', import.meta.url)),
  'utf8',
);
const shell = readFileSync(
  fileURLToPath(new URL('./instant-session-shell.tsx', import.meta.url)),
  'utf8',
);

function between(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  expect(from, `anchor not found: ${start}`).toBeGreaterThan(-1);
  const to = source.indexOf(end, from + start.length);
  expect(to, `anchor not found after ${start}: ${end}`).toBeGreaterThan(from);
  return source.slice(from, to);
}

describe('stop reaches the queue that actually holds the messages', () => {
  test('handleStop holds the SERVER inbox, not only the browser drain', () => {
    // A client-side pause leaves the admission gate free to admit the queued
    // prompt about one scheduler tick after the abort clears turn authority —
    // exactly the message the user pressed Stop to get ahead of.
    const stop = between(chat, 'const handleStop = useCallback(', 'issueSessionCancel();');
    expect(stop).toContain('promptInbox.hold(true)');
    expect(stop).toContain('queueDrain.pause()');
  });

  test('a new prompt lifts the pause on both lanes', () => {
    // The POST releases the server hold; this releases the local one, so the
    // strip does not stay dimmed over a stop the user has moved on from.
    const lift = between(chat, 'const serverQueueLengthRef = useRef(0);', '// NOTE: no client-side');
    expect(lift).toContain('queueDrain.resume()');
  });

  test('the strip is dimmed by the SERVER hold as well as the local pause', () => {
    // Otherwise a second tab shows a queue that says it is about to send while
    // the server is holding it.
    expect(chat).toContain('queuePaused={queueDrain.paused || queueRows.held}');
  });
});

describe('"send now" addresses the thing that actually holds the row', () => {
  test('a server row is dispatched through the inbox, a local one through the drain', () => {
    // `queueDrain.dispatchNow` looks its id up in the browser store. Handing it
    // a server `prompt_id` finds nothing and returns silently — after the stop
    // has already killed the running turn, and with the OLDEST prompt then
    // admitted instead of the one the user pointed at.
    const sendNow = between(
      chat,
      'const handleQueueSendNow = useCallback(',
      '// ---- Triple-ESC to stop ----',
    );
    expect(sendNow).toContain('queueRows.localIds.has(id)');
    expect(sendNow).toContain('queueDrain.dispatchNow(id)');
    expect(sendNow).toContain('promptInbox.retry(id)');
  });

  test('undo re-creates the prompt from what the DELETE handed back', () => {
    // Not from the list row: `SessionPrompt.text` is a 2000-char preview and
    // carries no parts, so restoring from it silently drops every attachment,
    // the agent/model/variant picks, and anything past the truncation — under
    // a button labelled "Undo". The row is hard-deleted, so the delete's own
    // response is the only place the full body still exists.
    const remove = between(
      chat,
      'const handleRemoveQueuedMessage = useCallback(',
      'const handleRetryQueuedMessage',
    );
    expect(remove).toContain('removed = await promptInbox.remove(id)');
    expect(remove).toContain('parts: removed.parts');
    expect(remove).toContain('removed.overrides ? { overrides: removed.overrides } : {}');
    expect(remove).not.toContain("parts: [{ type: 'text', text: removed.text }]");
  });

  test('remove and retry route by origin too', () => {
    const remove = between(
      chat,
      'const handleRemoveQueuedMessage = useCallback(',
      'const handleRetryQueuedMessage',
    );
    expect(remove).toContain('queueRows.localIds.has(id)');
    const retry = between(
      chat,
      'const handleRetryQueuedMessage = useCallback(',
      '// Stop polling when session goes idle',
    );
    expect(retry).toContain('queueRows.localIds.has(id)');
  });
});

describe('a prompt that will WAIT is not painted into the transcript', () => {
  test('the optimistic user message is only added when the prompt can run now', () => {
    // Otherwise the same message is on screen twice — once as a transcript
    // bubble under the still-streaming answer, once as a queue row — and the
    // bubble then vanishes when the running turn ends and the optimistic sweep
    // clears it, only to reappear when the drain finally delivers.
    const send = between(chat, 'const willWaitInInbox =', 'anchorTurn(messageID);');
    expect(send).toContain('beginOptimisticSend(');
    expect(send).toContain('if (!willWaitInInbox)');
  });

  test('the failure path only rehydrates a message it actually painted', () => {
    const send = between(chat, 'const result = await (async () => {', 'if (!result.ok) {');
    expect(send).toContain('willWaitInInbox');
    expect(send).toContain('recoverFromSendFailure(sessionId, messageID, cause');
  });
});

describe('a `/` command still waits its turn', () => {
  test('the composer queues a command while the agent is busy', () => {
    // A command is a turn. Commands do NOT go through the prompt inbox — they
    // are dispatched by `runCommand` — so nothing server-side orders them:
    // putting one straight on the wire mid-turn aborts the answer in progress.
    const branch = between(composer, "if (plan.kind === 'command') {", 'if (lockForQuestion) {');
    expect(branch).toContain('shouldQueueInsteadOfSend({');
    expect(branch).toContain('onQueueMessage(');
    expect(branch).toContain('onCommand?.(plan.command, plan.args, draft?.commandSplit)');
  });

  test('a PROMPT is never queued locally — the server decides that', () => {
    const promptBranch = between(composer, 'const reset = resolveComposerResetOnSend(', '} catch {');
    expect(promptBranch).toContain('await onSend(trimmed, filesToSend, mentionsToSend)');
    expect(promptBranch).not.toContain('onQueueMessage(');
  });

  test('SessionChat gives the composer a command-only local queue', () => {
    const handler = between(
      chat,
      'const handleQueueMessage = useCallback(',
      'const handleRemoveQueuedMessage',
    );
    // A prompt handed to this callback goes to the inbox like any other send;
    // only a command takes the browser store.
    expect(handler).toContain('if (!command)');
    expect(handler).toContain('useMessageQueueStore.getState().enqueue(');
    expect(chat).toContain('onQueueMessage={handleQueueMessage}');
  });
});

describe('the two dispatch lanes never fire at the same boundary', () => {
  test('the local command drain waits while the SERVER inbox owes a prompt', () => {
    // Both lanes are released by the turn ending. Without this gate they fire
    // together, each unaware of the other, and whichever lands second aborts
    // the turn the first just started.
    const gates = between(chat, 'const queueGates = useMemo<QueueDrainGates>(', 'const handleCommandRef');
    expect(gates).toContain('serverPromptPending: promptInbox.prompts.length > 0');
  });
});

describe('the boot shell never swallows what the user typed', () => {
  test('a message typed while the first one is still booting is queued, not dropped', () => {
    // `handleSend` used to `return` outright once `submitted` was set — AFTER
    // the composer had cleared the input, so the draft was simply gone.
    const send = between(shell, 'const handleSend = useCallback(', 'setSubmission({');
    expect(send).toContain('if (submitted)');
    expect(send).toContain('enqueue(sessionId, {');
  });
});
