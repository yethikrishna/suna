'use client';

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';

import {
  type AcpContentBlock,
  type AcpSessionController,
  type AcpSessionControllerOptions,
  type AcpSessionControllerSnapshot,
  createAcpProjection,
  createAcpSessionController,
} from '../core/acp';
import { platformConfig } from '../core/http/config';
import { persistProjectSessionAcpIdentity } from '../core/rest/projects-client/session-acp-identity';
import { buildProjectAcpEndpoint } from '../core/session/runtime-transport';

type SessionRuntimeHarness = 'claude' | 'codex' | 'opencode' | 'pi';

const EMPTY_SNAPSHOT: AcpSessionControllerSnapshot = {
  ready: false,
  sending: false,
  connection: 'idle',
  error: null,
  projection: createAcpProjection(''),
  configOptions: [],
  rewind: null,
  modelNotice: null,
};
const noopSubscribe = () => () => {};

export async function cancelAcpSession(
  controller: { cancel(): Promise<void> } | null,
): Promise<void> {
  if (!controller) return;
  await controller.cancel();
}

type AcpSessionRuntimeControllerInput = {
  projectId: string;
  runtimeUrl: string | null;
  sessionId: string;
  acpServerId: string | null;
  acpSessionId: string | null;
  runtimeHarness: SessionRuntimeHarness | null;
  nativeAgent?: string | null;
  legacySessionId?: string | null;
  /**
   * Report the harness-native session id the platform now stores for this
   * session, or `null` when a conflict proves it stores one this browser has
   * not read yet.
   *
   * A caller uses it to correct its own copy of `acpSessionId` — otherwise the
   * copy that said "no harness session yet" stays stale for the whole tab, and
   * every later controller for this session mints ANOTHER throwaway harness
   * conversation before adopting the stored one.
   */
  onAcpIdentitySettled?: (acpSessionId: string | null) => void;
  /**
   * The platform/server default model, read only when a requested model is
   * rejected. A getter so learning it never rebuilds the controller (which would
   * close the live stream) — see `AcpSessionControllerOptions`.
   */
  getServerDefaultModel?: () => string | null | undefined;
};

/** One session's write-once harness-native identity, as this hook knows it. */
export interface AcpRuntimeIdentity {
  sessionId: string;
  acpSessionId: string | null;
}

/**
 * Fold an incoming `(sessionId, acpSessionId)` pair into the known identity.
 *
 * The harness-native id is write-once per Kortix session, so a `null` from a
 * momentarily-stale read must not erase a known id — but it must NEVER carry
 * across sessions: reusing another session's harness conversation is the worst
 * failure this layer has. Returns `current` unchanged when nothing moved, so a
 * caller can use reference equality to decide whether anything must rebuild.
 */
export function nextAcpIdentity(
  current: AcpRuntimeIdentity,
  incoming: AcpRuntimeIdentity,
): AcpRuntimeIdentity {
  if (current.sessionId !== incoming.sessionId) return incoming;
  if (!incoming.acpSessionId || incoming.acpSessionId === current.acpSessionId) return current;
  return incoming;
}

export function createAcpSessionRuntimeController(
  input: AcpSessionRuntimeControllerInput,
  factory: (
    options: AcpSessionControllerOptions,
  ) => AcpSessionController = createAcpSessionController,
): AcpSessionController | null {
  if (!input.runtimeUrl) return null;
  const managed = !!input.acpServerId && input.acpServerId === input.sessionId;
  if (!managed) {
    const legacySessionId = input.legacySessionId ?? input.acpSessionId;
    return legacySessionId
      ? factory({
          runtimeUrl: input.runtimeUrl,
          sessionId: legacySessionId,
        })
      : null;
  }
  if (!input.runtimeHarness || !input.acpServerId) return null;
  const getServerDefaultModel = input.getServerDefaultModel;
  return factory({
    ...(getServerDefaultModel ? { getServerDefaultModel } : {}),
    endpoint: buildProjectAcpEndpoint(
      platformConfig().backendUrl,
      input.projectId,
      input.sessionId,
    ),
    durableTranscript: true,
    sessionId: input.sessionId,
    acpServerId: input.acpServerId,
    acpSessionId: input.acpSessionId,
    runtimeHarness: input.runtimeHarness,
    nativeAgent: input.nativeAgent,
    // Return the stored id so the controller adopts the platform's answer. A
    // 409 conflict propagates unchanged: its body carries the winning
    // `acp_session_id`, which the controller reads and adopts.
    persistAcpSessionId: async (acpSessionId) => {
      let identity: Awaited<ReturnType<typeof persistProjectSessionAcpIdentity>>;
      try {
        identity = await persistProjectSessionAcpIdentity(input.projectId, input.sessionId, {
          acp_server_id: input.acpServerId as string,
          runtime_harness: input.runtimeHarness as SessionRuntimeHarness,
          acp_session_id: acpSessionId,
        });
      } catch (error) {
        // The claim lost. The platform already stores an id, and the controller
        // reads the winner off this error and adopts it — but this browser's
        // copy of `acpSessionId` is now provably stale, so tell the caller to
        // re-read it rather than mint again on the next mount.
        input.onAcpIdentitySettled?.(null);
        throw error;
      }
      const settled = identity?.acp_session_id ?? acpSessionId;
      input.onAcpIdentitySettled?.(settled);
      return settled;
    },
  });
}

export function useAcpSessionRuntime(input: {
  projectId: string;
  runtimeUrl: string | null;
  /** Durable Kortix project session id. */
  sessionId: string;
  acpServerId: string | null;
  acpSessionId: string | null;
  runtimeHarness: SessionRuntimeHarness | null;
  /** Immutable harness-native agent or mode selected when the session was created. */
  nativeAgent?: string | null;
  /** Existing ACP sessions without immutable multi-harness metadata. */
  legacySessionId?: string | null;
  /** Correct the caller's copy of `acpSessionId` once the platform settles it. */
  onAcpIdentitySettled?: (acpSessionId: string | null) => void;
  /** Wire model id of the platform/server default, for model-not-found recovery. */
  serverDefaultModel?: string | null;
  enabled: boolean;
}) {
  // Read the write-once harness-native id through a ref, and keep it OUT of the
  // memo below. Two things follow, and both are required:
  //
  // 1. LEARNING the id must not rebuild the controller. The id arrives late for
  //    a session this browser just minted (the caller writes it back through
  //    `onAcpIdentitySettled`), and a rebuild closes the live stream — mid-turn.
  // 2. A genuine rebuild (remount, new runtime url) must still use the FRESHEST
  //    known id, so it calls `session/load` and never mints a second harness
  //    conversation that the platform then has to reject with a 409.
  //
  // Writing a ref during render is safe here only because the fold is monotone
  // and derived purely from props: a render React discards can only write the
  // same immutable id (or nothing). `nextAcpIdentity` drops the id whenever the
  // session changes, so a reused hook instance can never bind session B's
  // controller to session A's harness conversation.
  const identityRef = useRef<AcpRuntimeIdentity>({
    sessionId: input.sessionId,
    acpSessionId: input.acpSessionId,
  });
  identityRef.current = nextAcpIdentity(identityRef.current, {
    sessionId: input.sessionId,
    acpSessionId: input.acpSessionId,
  });
  const acpSessionId = identityRef.current.acpSessionId;
  // Stable indirection so a caller may pass an inline callback without it
  // becoming a reason to rebuild the controller.
  const settledRef = useRef(input.onAcpIdentitySettled);
  settledRef.current = input.onAcpIdentitySettled;
  // Same reason as `settledRef`: the server default resolves after this
  // controller is built, and rebuilding to learn it would close the live stream.
  const serverDefaultModelRef = useRef(input.serverDefaultModel);
  serverDefaultModelRef.current = input.serverDefaultModel;

  const controller = useMemo(
    () =>
      createAcpSessionRuntimeController({
        ...input,
        acpSessionId,
        onAcpIdentitySettled: (settled) => settledRef.current?.(settled),
        getServerDefaultModel: () => serverDefaultModelRef.current,
      }),
    [
      input.acpServerId,
      input.legacySessionId,
      input.nativeAgent,
      input.projectId,
      input.runtimeHarness,
      input.runtimeUrl,
      input.sessionId,
    ],
  );

  useEffect(() => {
    if (!input.enabled || !controller) return;
    void controller.connect().catch(() => {});
    return () => controller.close();
  }, [controller, input.enabled]);

  const snapshot = useSyncExternalStore(
    controller?.subscribe ?? noopSubscribe,
    controller?.getSnapshot ?? (() => EMPTY_SNAPSHOT),
    controller?.getSnapshot ?? (() => EMPTY_SNAPSHOT),
  );

  const send = useCallback(
    (prompt: AcpContentBlock[], options?: { model?: string | null; agent?: string | null }) => {
      if (!controller) throw new Error('ACP session runtime is not ready');
      return controller.send(prompt, options);
    },
    [controller],
  );
  const cancel = useCallback(async () => {
    await cancelAcpSession(controller);
  }, [controller]);
  const runCommand = useCallback(
    (command: string, args: string, options?: { model?: string | null; agent?: string | null }) => {
      if (!controller) throw new Error('ACP session runtime is not ready');
      return controller.runCommand(command, args, options);
    },
    [controller],
  );
  const rewind = useCallback(
    (messageId: string) => {
      if (!controller) throw new Error('ACP session runtime is not ready');
      return controller.rewind(messageId);
    },
    [controller],
  );
  const restoreRewind = useCallback(() => {
    if (!controller) throw new Error('ACP session runtime is not ready');
    return controller.restoreRewind();
  }, [controller]);
  const answerPermission = useCallback(
    (requestId: string, reply: 'once' | 'always' | 'reject') => {
      if (!controller) throw new Error('ACP session runtime is not ready');
      return controller.answerPermission(requestId, reply);
    },
    [controller],
  );
  const answerQuestion = useCallback(
    (requestId: string, answers: string[][]) => {
      if (!controller) throw new Error('ACP session runtime is not ready');
      return controller.answerQuestion(requestId, answers);
    },
    [controller],
  );
  const rejectQuestion = useCallback(
    (requestId: string) => {
      if (!controller) throw new Error('ACP session runtime is not ready');
      return controller.rejectQuestion(requestId);
    },
    [controller],
  );

  return {
    ...snapshot,
    rewindState: snapshot.rewind,
    send,
    cancel,
    runCommand,
    rewind,
    restoreRewind,
    answerPermission,
    answerQuestion,
    rejectQuestion,
  };
}
