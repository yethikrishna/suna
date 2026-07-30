export function hasSessionRuntimeIdentity(input: {
  usesAcp: boolean;
  opencodeSessionId: string | null;
}): boolean {
  return input.usesAcp || Boolean(input.opencodeSessionId);
}

/**
 * The id a host mounts its chat surface on, or `null` while the runtime still
 * has no identity.
 *
 * One id per transport, and the host must not know which:
 * - OpenCode REST → the server-owned OpenCode session pin. It is the id every
 *   REST read/write is keyed by, so there is nothing to mount before it lands.
 * - managed ACP → the durable Kortix session id. ACP keeps its own
 *   harness-native conversation id server-side and never mints an OpenCode pin
 *   (`project_sessions.opencode_session_id` stays null for the session's whole
 *   life), so a host that waits for that pin waits forever.
 */
export function resolveSessionMountId(input: {
  usesAcp: boolean;
  sessionId: string;
  opencodeSessionId: string | null;
}): string | null {
  if (!hasSessionRuntimeIdentity(input)) return null;
  return input.usesAcp ? input.sessionId : (input.opencodeSessionId as string);
}

export function isSessionRuntimeActionReady(input: {
  switched: boolean;
  usesAcp: boolean;
  opencodeSessionId: string | null;
}): boolean {
  return input.switched && hasSessionRuntimeIdentity(input);
}
