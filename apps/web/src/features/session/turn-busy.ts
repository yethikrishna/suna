export interface TurnBusyInput {
  /** The runtime's own status says a turn is running (`busy` or `retry`). */
  serverBusy: boolean;
  /**
   * This client has a prompt in flight and no response yet — `useSession().isSending`.
   *
   * Required, not redundant with `serverBusy`. An ACP projection only reports
   * `busy` while a `session/prompt` request it has actually seen is unanswered,
   * and the browser's own outbound prompt never comes back over the agent→client
   * stream. Deriving busy from streamed content instead is what pinned the
   * thinking indicator on forever, because a `session/load` replay of finished
   * history is byte-identical to live content.
   */
  sending: boolean;
  /** A prompt handed over from another route is still being delivered. */
  pendingSendInFlight: boolean;
  /** An optimistic context compaction is running. */
  compacting: boolean;
}

/** Whether the session should render a turn as in progress. */
export function resolveTurnBusy(input: TurnBusyInput): boolean {
  return input.serverBusy || input.sending || input.pendingSendInFlight || input.compacting;
}
