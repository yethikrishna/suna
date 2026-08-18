/**
 * Composer state while a session is still waking.
 *
 * The transcript paints from the local cache before the sandbox is up (see
 * `session-transcript-cache` in the SDK), which is the point — reading back what
 * you already wrote should never wait on a VM.
 *
 * ## Why this no longer disables the composer
 *
 * It used to return `{ disabled: true }`, and the reasoning was sound as far as
 * it went: `send()` only checks that an opencode session id exists, not that its
 * runtime answers, so a live composer against a sleeping box takes a prompt and
 * drops it. Disabling the input made that impossible.
 *
 * It also made the composer indistinguishable from broken. A stopped sandbox
 * (`503 sandbox not ready (status: stopped)`) is not a state that clears on its
 * own, so what the user got was a dead input, a spinner where the send button
 * belongs, and nothing on screen saying why or for how long. Waiting is only
 * tolerable when you can see what you are waiting for.
 *
 * The prompt-dropping problem is now solved where it actually lives — in the
 * SERVER's prompt inbox, not in the input. A submit against a sleeping box is
 * POSTed to `.../prompts` and becomes a durable row; the admission gate holds
 * it until the sandbox answers, at which point it goes out by itself. So the
 * message is safe — safe across a closed tab, which a browser queue never was
 * — the composer stays usable, and this module's job shrinks to one thing:
 * saying what is going on.
 */
export interface SessionComposerReadiness {
  /** The runtime is up. False means a submit becomes a queued inbox row rather
   *  than a delivery. */
  ready: boolean;
  /**
   * What to show above the composer while `ready` is false, or `null`.
   *
   * A notice rather than a placeholder. The placeholder was the old channel for
   * this, and it is the wrong one twice over: it is invisible the moment there
   * is any text in the input — exactly when someone is composing the thing that
   * is about to be queued — and it cannot say what happens next.
   */
  notice: string | null;
}

export function sessionComposerReadiness(input: {
  runtimeReady: boolean;
}): SessionComposerReadiness {
  if (input.runtimeReady) return { ready: true, notice: null };
  return {
    ready: false,
    // Says what is happening AND what a send will do, because the send button
    // stays live — without the second half, pressing it looks like nothing
    // happened.
    notice: 'Waking this session up… messages you send will be queued and go out automatically.',
  };
}
