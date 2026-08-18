/**
 * When it is safe to release the queue.
 *
 * The agent finishes the task it is on, and then **everything waiting goes out
 * together**, on one prompt, in the order it was typed. Nothing overtakes;
 * nothing is held back for a later turn.
 *
 * This module answers only *when* — how much is released is `claimBatch`'s in
 * `@kortix/sdk/message-queue`, and what the single prompt contains is
 * `queued-batch.ts`. Keeping those separate is why the batching change did not
 * have to touch a single gate below.
 *
 * The previous answer to *when* was wrong in three
 * separate ways, all of them invisible from the code that used them:
 *
 *   1. **A finished tool call counted as a boundary.** Any tool part reaching
 *      `completed` or `error` drained the whole queue. A turn that runs Bash →
 *      Read → Edit hit three "boundaries" while the agent was still working, so
 *      a message typed mid-turn landed mid-turn. That is the reported bug.
 *   2. **`isBusy` was read as "the turn ended".** It is a 300 ms fade timer for
 *      the busy indicator (`session-chat.tsx`), so any gap between agentic
 *      steps longer than the fade looked like completion. A UI timer is not a
 *      transaction boundary, which is why `QueueDrainGates` does not have an
 *      `isBusy` field for anyone to reach for.
 *   3. **Loading older history fired it.** The drain watched the `messages`
 *      array, so tool parts prepended by scrolling up counted as new
 *      completions. Nothing here reads `messages`.
 *
 * The replacement is a small state machine over signals that actually mean
 * something: the server's own session status, plus the gates that mean the run
 * is paused waiting for a human. It is pure and clock-injected, so every rule
 * below is asserted in a unit test rather than observed by hand.
 */

/**
 * How long every gate must stay continuously clear before a queued message is
 * released. `sessionStatus` flaps between agentic steps; this window is what
 * distinguishes a gap from an ending.
 */
export const QUEUE_SETTLE_MS = 700;

/**
 * Everything that means "do not send yet". All of these already exist in
 * `session-chat.tsx` — the drain simply reads the honest ones.
 */
export interface QueueDrainGates {
  /**
   * This session is working, per the ONE projection — `useSessionWorking` over
   * the server's own turn authority, the live stream, and this tab's send
   * receipt, in that order of authority.
   *
   * Three gates collapsed into this one and none of them are missed.
   * `pendingSendInFlight` was a boolean the composer set on send and cleared
   * from a 30s timer; the receipt is the same fact with a provenance tag and a
   * bound. `hasIncompleteAssistant` was a transcript inference kept because
   * status events get dropped — but a turn the server is holding open reports
   * as a turn, and an assistant message left open by a sandbox that died
   * mid-turn (the "husk") does not. That husk is exactly what needed a 10s
   * clock and a confirmation round-trip to work around; server truth has no
   * husk to work around.
   */
  isServerBusy: boolean;
  /**
   * The last assistant message is open BECAUSE the provider is being retried.
   *
   * The one transcript-derived gate that survives, and only in this narrow
   * form. During a 429 OpenCode stamps `info.error` with
   * `data.isRetryable === true` and keeps writing the SAME message; the status
   * frame this tab holds can read non-busy through all of it, and the drain
   * then sent the next queued `/` command into a turn that was still running —
   * the "Interrupted" symptom. `isServerBusy` cannot stand in for it, because a
   * status frame stamped after the last `/turn` read outranks that read by
   * design (see `projectWorking` rule 1).
   *
   * NOT `hasIncompleteAssistant`: an assistant message left open by a sandbox
   * that died mid-turn never completes and never errors, so gating on THAT
   * wedged the queue for the lifetime of the session. Callers pair this with
   * `WorkingProjection.serverOpenTurnId` so it can only close the gate while
   * the control plane also still holds turn authority — which a dead box's
   * husk-finalized turn does not.
   */
  hasRetryingAssistant: boolean;
  isOptimisticCompacting: boolean;
  /** A structured question is on screen. Draining would answer it with
   *  unrelated text. */
  hasActiveQuestion: boolean;
  /** A connector action is awaiting approval. Draining would bypass the gate. */
  hasPendingApproval: boolean;
  pendingPermissionCount: number;
  /** The user pressed stop. "Stop doing things" includes the queue. */
  isPaused: boolean;
  /**
   * The SERVER inbox still owes this session a prompt.
   *
   * There are two dispatchers now — this browser drain, which carries the `/`
   * commands the inbox has no row shape for, and the control plane's own
   * admission gate — and they are released by the SAME event: the turn ending.
   * Without this gate both fire at that boundary, each unaware of the other,
   * and whichever lands second aborts the turn the first just started.
   *
   * The server lane goes first, always. It holds the durable, cross-tab,
   * ordered rows, and it is the one that survives this tab closing. The cost is
   * that a `/` command typed BEFORE a prompt runs after it; the fix for that is
   * commands becoming inbox rows too, not a second ordering guess here.
   */
  serverPromptPending: boolean;
  readOnly: boolean;
  /**
   * The sandbox is up and answering.
   *
   * The ONE gate whose polarity is inverted — every field above means "do not
   * send", this one means "may send". It keeps the name `runtimeReady` because
   * that is what the signal is called everywhere it comes from
   * (`useRuntimeReady`, `sessionComposerReadiness`), and a `runtimeAsleep`
   * spelling here would mean every call site negates it on the way in, which is
   * where polarity bugs actually happen.
   *
   * This gate is what lets the composer stay usable while the box is stopped.
   * Previously the composer was DISABLED until the runtime answered, because
   * `send()` only checks that an opencode session id exists — not that its
   * runtime is up — so a prompt submitted against a sleeping box is accepted
   * and lost. Holding it in the queue instead means the message survives, and
   * goes out by itself the moment the sandbox wakes.
   */
  runtimeReady: boolean;
  /**
   * A session rewind is staged (the user picked an earlier message to edit,
   * `session.revert` has been called, and the replacement prompt has not
   * been sent yet). Hard-closes the drain independent of every other gate.
   *
   * Without this, the OTHER gates read WRONG during a staged revert, and
   * wrong in the dangerous direction: the local hide window
   * (`messagesBeforeRewind`) removes the very messages the transcript-derived
   * gates were reading — an in-progress or just-finished turn on the abandoned
   * trajectory disappears from view, so those gates can read CLEAR while a
   * staged revert sits open. That would let the drain open SOONER during a staged
   * revert than during an ordinary idle session — backwards. Draining into a
   * staged window sends the queued prompt into a trajectory the user has
   * already asked to discard, and it lands ahead of the replacement they are
   * about to type into the composer.
   *
   * `handleConfirmRewind` (`session-chat.tsx`) additionally clears this
   * session's queue outright on confirm — the queued messages belong to the
   * abandoned trajectory, not merely to a turn that has not started yet — so
   * this gate's job is closing the door to anyone (a slower `enqueue`, a
   * cross-tab enqueue) who queues something new WHILE staged, not draining
   * what was already there.
   */
  revertStaged: boolean;
}

export function canDrainQueue(gates: QueueDrainGates): boolean {
  return (
    !gates.isServerBusy &&
    !gates.hasRetryingAssistant &&
    !gates.isOptimisticCompacting &&
    !gates.hasActiveQuestion &&
    !gates.hasPendingApproval &&
    gates.pendingPermissionCount === 0 &&
    !gates.isPaused &&
    !gates.serverPromptPending &&
    !gates.readOnly &&
    gates.runtimeReady &&
    !gates.revertStaged
  );
}

/**
 * Whether a message the user just submitted should join the queue rather than
 * go straight out.
 *
 * `isBusy` alone is not enough, and the gap is easy to miss. It is false during
 * the settle window, and false in the moment between claiming a message and the
 * server reporting the session busy. Submitting in either window sends the new
 * message *ahead* of everything already waiting — and, in the second case,
 * puts two prompts on the wire at once.
 *
 * So: anything waiting or in flight means this one waits too, however idle the
 * session looks this instant. Jumping the line is what "Stop & send" is for,
 * and that is a button, not a timing accident.
 */
export function shouldQueueInsteadOfSend(input: {
  isBusy: boolean;
  pendingCount: number;
  hasInFlight: boolean;
  /**
   * Defaults to `true` so every existing caller is unchanged. `false` — the
   * sandbox is stopped or still waking — routes the message to the queue,
   * which is what makes leaving the composer ENABLED safe: `send()` would
   * accept a prompt against a sleeping box and lose it, whereas the queue
   * holds it and `canDrainQueue`'s matching `runtimeReady` gate releases it
   * once the box answers.
   */
  runtimeReady?: boolean;
}): boolean {
  if (input.runtimeReady === false) return true;
  return input.isBusy || input.pendingCount > 0 || input.hasInFlight;
}

/**
 * Whether pressing stop should stop auto-sending.
 *
 * Paired with `shouldClearPause` below, and they have to agree: pausing without
 * a way back means every message typed after a stop queues behind a queue that
 * never moves. That wedge is worse than the interruption the pause prevents.
 */
export function shouldClearPause(previousQueueSize: number, nextQueueSize: number): boolean {
  // Adding to the queue is the user saying "I want this sent". Whatever the
  // stop meant, it did not mean this.
  return nextQueueSize > previousQueueSize;
}

/**
 * The whole machine: one clock, no latch.
 *
 * ## Why the latch is gone, and why one-per-turn still holds without it
 *
 * It used to carry a second field, `sawBusySinceDispatch`: after releasing a
 * message it refused to release another until a NEW busy period had been
 * *observed by this tab*. The intent was right — the next message must wait for
 * the turn this one starts — but the mechanism was a second, weaker copy of
 * something the gates already do, and it failed open in the wrong direction.
 *
 * `isServerBusy` reads `useSyncStore.sessionStatus[sessionId]`. `handleSend`
 * calls `beginOptimisticSend`, which writes `{ type: 'busy' }` into that exact
 * slot **synchronously, before any await** — and `useSessionSync` additionally
 * forces busy while a prompt is observed in flight. So by the time the drain
 * ticks again after a dispatch, the busy gate is already closed. The head is
 * genuinely alone on the wire; the latch was asserting a fact the gate had
 * already established.
 *
 * What the latch uniquely did was fail closed. If that busy period never
 * arrived — a send that errored before reaching the server, a missed status
 * event, a tab that was asleep — every later message waited forever on a turn
 * that never started. That is the "the queue just stops sending" report, and it
 * is why a `rearmDrainMachine` escape hatch had to exist beside it and be
 * called from three places to paper over the cases anyone had thought of.
 *
 * Removing it leaves one honest question: have the gates been continuously
 * clear long enough to call this the end of a turn?
 */
export interface DrainMachine {
  /** When the gates last became clear, or null while any gate is closed. */
  clearSince: number | null;
}

export function createDrainMachine(): DrainMachine {
  return { clearSince: null };
}

/**
 * Advance the machine one observation.
 *
 * `now` is injected rather than read, so the settle window is asserted in tests
 * instead of slept through.
 */
export function stepDrainMachine(
  machine: DrainMachine,
  gates: QueueDrainGates,
  now: number,
  settleMs: number = QUEUE_SETTLE_MS,
): { machine: DrainMachine; dispatch: boolean } {
  // `isServerBusy` is one of the gates, so a running turn lands here too and
  // resets the clock. There is no separate busy branch to keep in sync.
  if (!canDrainQueue(gates)) {
    return { machine: { clearSince: null }, dispatch: false };
  }

  const clearSince = machine.clearSince ?? now;
  if (now - clearSince < settleMs) {
    return { machine: { ...machine, clearSince }, dispatch: false };
  }

  // Reset the clock on dispatch, so the message behind this one starts its wait
  // from scratch. Normally it never gets that far — the send closes the busy
  // gate synchronously — but when a send fails without ever reaching the server
  // the gates stay clear, and this is what keeps the next message a full settle
  // window behind rather than following it in the same instant.
  return { machine: { clearSince: null }, dispatch: true };
}

/**
 * What one observation should cause. `wait` carries the delay because nothing
 * re-renders while the gates merely stay clear — the caller must set a timer or
 * the queue stalls until some unrelated render happens to wake it.
 */
export type DrainAction =
  | { kind: 'idle' }
  | { kind: 'dispatch' }
  | { kind: 'wait'; ms: number };

/**
 * The whole drain decision, with no React and no clock of its own.
 *
 * This used to live inside the hook's `tick`, which meant none of it could be
 * asserted: not "an empty queue must not step the machine", not "a send already
 * on the wire must not start a second one", not the remaining-time arithmetic
 * that decides whether the queue moves at all. Those are the mistakes worth
 * catching, so they are inputs and outputs here and the hook is left holding
 * only the side effects.
 */
export function planDrainTick(input: {
  machine: DrainMachine;
  gates: QueueDrainGates;
  /** How many messages are waiting, in-flight ones included. */
  pendingCount: number;
  /** Whether a dispatch from an earlier tick is still awaiting its send. */
  sending: boolean;
  now: number;
  settleMs?: number;
}): { machine: DrainMachine; action: DrainAction } {
  const settleMs = input.settleMs ?? QUEUE_SETTLE_MS;

  // Nothing to send, or a send already out. Return the machine untouched: this
  // tick observed nothing, so it must not restart or advance the settle clock.
  if (input.sending || input.pendingCount === 0) {
    return { machine: input.machine, action: { kind: 'idle' } };
  }

  const { machine, dispatch } = stepDrainMachine(input.machine, input.gates, input.now, settleMs);
  if (dispatch) {
    return { machine, action: { kind: 'dispatch' } };
  }

  if (machine.clearSince === null) {
    // A closed gate will re-render when it opens; there is nothing to poll for.
    return { machine, action: { kind: 'idle' } };
  }

  const elapsed = input.now - machine.clearSince;
  return { machine, action: { kind: 'wait', ms: Math.max(0, settleMs - elapsed) } };
}
