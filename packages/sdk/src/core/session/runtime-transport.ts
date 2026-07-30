export type SessionRuntimeTransport = 'acp' | 'rest';
type SessionRuntimeHarness = 'claude' | 'codex' | 'opencode' | 'pi';

export function resolveSessionRuntimeTransport(
  value: SessionRuntimeTransport | undefined,
  override?: SessionRuntimeTransport,
): SessionRuntimeTransport {
  if (override) return override;
  return value === 'acp' ? 'acp' : 'rest';
}

export interface SessionRuntimePolicy {
  transport: SessionRuntimeTransport;
  useAcp: boolean;
  streamOpenCodeEvents: boolean;
  listOpenCodeSessions: boolean;
  syncOpenCodeMessages: boolean;
  /**
   * Whether this session's sandbox serves an OpenCode REST API at all.
   *
   * Distinct from every flag above: those say which transport the CHAT path
   * uses, and are false for any ACP session. This one is about the sandbox
   * process table. Under managed ACP the daemon never calls `opencode.start()`
   * (`apps/kortix-sandbox-agent-server/src/main.ts` — `managedAcp` skips it), so
   * `/command`, `/session`, `/project/current`, `/global/config`, `/agent`, and
   * `/skill` are served by NOTHING — not "not yet", ever. A legacy ACP session
   * (no `acp_server_id`) still runs the compatibility server, so it keeps them.
   *
   * Read this to decide whether to ISSUE an OpenCode REST request. A caller that
   * reads `useAcp` instead disables reads that legacy ACP sessions still need.
   */
  servesOpenCodeRest: boolean;
  sendWith: 'acp' | 'opencode-rest';
}

export function createSessionRuntimePolicy(
  value: SessionRuntimeTransport | undefined,
  override?: SessionRuntimeTransport,
  options?: {
    /**
     * The sandbox ACP process key from `/start`. Present exactly when the
     * session runs the managed multi-harness ACP lifecycle — the same predicate
     * as `readManagedAcpSessionIdentity`
     * (`apps/api/src/projects/runtime-inspection.ts`) and `usesManagedAcpRuntime`
     * (`apps/kortix-sandbox-agent-server/src/proxy.ts`).
     */
    acpServerId?: string | null;
  },
): SessionRuntimePolicy {
  const transport = resolveSessionRuntimeTransport(value, override);
  const useAcp = transport === 'acp';
  return {
    transport,
    useAcp,
    streamOpenCodeEvents: !useAcp,
    listOpenCodeSessions: !useAcp,
    syncOpenCodeMessages: !useAcp,
    servesOpenCodeRest: !(useAcp && !!options?.acpServerId),
    sendWith: useAcp ? 'acp' : 'opencode-rest',
  };
}

function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 47) end -= 1;
  return end === value.length ? value : value.slice(0, end);
}

/** Build the authenticated, session-scoped ACP bridge endpoint.
 *  Hosts receive the completed URL through `useSession`; they never construct
 *  or import this runtime path. */
export function buildAcpBridgeEndpoint(
  runtimeUrl: string,
  acpServerId: string,
  runtimeHarness?: SessionRuntimeHarness,
): string {
  const endpoint = `${trimTrailingSlashes(runtimeUrl)}/kortix/acp/${encodeURIComponent(acpServerId)}`;
  return runtimeHarness ? `${endpoint}?agent=${encodeURIComponent(runtimeHarness)}` : endpoint;
}

/** Build the authenticated platform bridge that persists one project session. */
export function buildProjectAcpEndpoint(
  backendUrl: string,
  projectId: string,
  sessionId: string,
): string {
  return (
    `${trimTrailingSlashes(backendUrl)}/projects/${encodeURIComponent(projectId)}` +
    `/sessions/${encodeURIComponent(sessionId)}/acp`
  );
}
