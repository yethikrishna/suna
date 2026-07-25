export type SessionRuntimeTransport = 'acp' | 'rest';

export function resolveSessionRuntimeTransport(
  value: SessionRuntimeTransport | undefined,
): SessionRuntimeTransport {
  return value === 'acp' ? 'acp' : 'rest';
}

export interface SessionRuntimePolicy {
  transport: SessionRuntimeTransport;
  useAcp: boolean;
  streamOpenCodeEvents: boolean;
  listOpenCodeSessions: boolean;
  syncOpenCodeMessages: boolean;
  sendWith: 'acp' | 'opencode-rest';
}

export function createSessionRuntimePolicy(
  value: SessionRuntimeTransport | undefined,
): SessionRuntimePolicy {
  const transport = resolveSessionRuntimeTransport(value);
  const useAcp = transport === 'acp';
  return {
    transport,
    useAcp,
    streamOpenCodeEvents: !useAcp,
    listOpenCodeSessions: !useAcp,
    syncOpenCodeMessages: !useAcp,
    sendWith: useAcp ? 'acp' : 'opencode-rest',
  };
}

/** Build the authenticated, session-scoped ACP bridge endpoint.
 *  Hosts receive the completed URL through `useSession`; they never construct
 *  or import this runtime path. */
export function buildAcpBridgeEndpoint(runtimeUrl: string, sessionId: string): string {
  return `${runtimeUrl.replace(/\/+$/, '')}/kortix/acp/${encodeURIComponent(sessionId)}`;
}
