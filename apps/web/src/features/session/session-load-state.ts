export function canMountSessionChat(input: {
  switched: boolean;
  opencodeSessionId: string | null;
}) {
  return input.switched || Boolean(input.opencodeSessionId);
}

export function findInitialSessionPin(
  sessions:
    | Array<{
        session_id: string;
        opencode_session_id: string | null;
      }>
    | undefined,
  sessionId: string,
) {
  return sessions?.find((session) => session.session_id === sessionId)?.opencode_session_id ?? null;
}

/**
 * The id this route mounts `SessionLayout` + `SessionChat` on.
 *
 * `runtimeMountId` is `useSession().chatSessionId` — the SDK owns that id
 * because only the SDK knows the transport (REST pins an OpenCode session;
 * managed ACP never does). The host only layers its two host-only overrides on
 * top: a legacy `?oc=` deep-link selection, then the first pin it latched so a
 * momentary null from the live value cannot swap the mounted identity.
 */
export function resolveChatSessionId(input: {
  selectedSessionId: string | null;
  pinnedMountId: string | null;
  runtimeMountId: string | null;
}) {
  return input.selectedSessionId ?? input.pinnedMountId ?? input.runtimeMountId ?? null;
}

/**
 * Whether the chat surface may replace the boot loader.
 *
 * A real mount id is the only positive signal, and it is transport-agnostic
 * (see `resolveChatSessionId`). The error arms stay because a session that
 * failed must show its error card instead of spinning forever.
 */
export function canShowSessionChat(input: {
  chatSessionId: string | null;
  runtimeError: unknown;
  runtimeBootError: unknown;
}) {
  return Boolean(input.chatSessionId || input.runtimeError || input.runtimeBootError);
}

/**
 * Whether the mounted chat shows its shell, its loader, or its not-found card.
 *
 * Two authorities, and which one applies is decided by identity, never by
 * transport: when the SDK's mount id is NOT the OpenCode session pin, OpenCode
 * REST cannot answer for this session at all — a managed-ACP session's box runs
 * no OpenCode REST server, so `GET /session` returns 503 for the session's whole
 * life. Reading that as "still loading" pins the composer behind a permanent
 * "Connecting" card; reading it as "missing" claims a live session is gone.
 * `ready` (the SDK's own `phase === 'ready'`) answers instead.
 *
 * When the mount id IS the pin (or the host mounted with no SDK state), every
 * signal is the OpenCode REST one this surface has always used, unchanged.
 */
export function resolveSessionChatContentState(input: {
  sdk: { chatSessionId: string | null; opencodeSessionId: string | null; ready: boolean } | null;
  /** An OpenCode REST session object resolved for the mounted id. */
  runtimeSessionResolved: boolean;
  /** The OpenCode REST session lookup has run to completion at least once. */
  runtimeSessionFetched: boolean;
  runtimeReady: boolean;
  hasMessages: boolean;
  hasOptimisticPrompt: boolean;
}): { loading: boolean; notFound: boolean } {
  const sdkOwnsContent =
    !!input.sdk?.chatSessionId && input.sdk.chatSessionId !== input.sdk.opencodeSessionId;
  const sdkReady = sdkOwnsContent && input.sdk?.ready === true;
  const resolved = input.runtimeSessionResolved || sdkReady;
  const notFound =
    !resolved &&
    !sdkOwnsContent &&
    input.runtimeReady &&
    input.runtimeSessionFetched &&
    !input.hasOptimisticPrompt;
  const loading = !resolved && !notFound && !input.hasMessages && !input.hasOptimisticPrompt;
  return { loading, notFound };
}
