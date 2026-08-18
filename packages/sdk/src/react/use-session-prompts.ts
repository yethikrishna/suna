'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import {
  type CreateSessionPromptInput,
  type CreateSessionPromptResult,
  type RemovedSessionPrompt,
  type SessionPrompt,
  createSessionPrompt,
  deleteSessionPrompt,
  holdSessionPrompts,
  listSessionPrompts,
  retrySessionPrompt,
} from '../core/rest/projects-client/sessions';
import { qk } from './query-keys';

/**
 * The session's SERVER-SIDE prompt inbox.
 *
 * The queue used to be a browser store: closing the tab, switching device, or
 * a crash lost every pending message silently, and two tabs on one session each
 * believed their own list. This hook reads the durable rows instead, so what
 * the composer renders is what the server will actually deliver.
 *
 * Polling has TWO cadences, and the slow one is not an optimization.
 *
 * While prompts exist the list is the only thing that can report a state change
 * (`waiting` → `queued` → `delivering`), so it polls fast. An empty list is the
 * common state and does not need that — but it cannot stop either, because a
 * prompt can ENTER the inbox with this tab doing nothing at all: the reaper
 * redelivers one whose turn never ran, and parking a box requeues its in-flight
 * prompt as `held`. A held row is deliberately not due; the user releases it by
 * sending something or pressing "send now" on it, which they can only do if
 * they can SEE it. Not polling an empty list meant only a full page load ever
 * showed those rows — and the same gap hid a prompt queued from a second tab.
 */
export const SESSION_PROMPTS_POLL_MS = 3_000;
/** The floor for an EMPTY list. Slow enough to be free, fast enough that a
 *  prompt handed back by the server appears while the user is still looking. */
export const SESSION_PROMPTS_IDLE_POLL_MS = 15_000;

/** The cadence for a list of `count` prompts. Pure, so the floor is testable. */
export function sessionPromptsPollMs(count: number, pollMs?: number): number {
  return count > 0 ? (pollMs ?? SESSION_PROMPTS_POLL_MS) : SESSION_PROMPTS_IDLE_POLL_MS;
}

export interface UseSessionPromptsResult {
  prompts: SessionPrompt[];
  isLoading: boolean;
  /** Put one prompt in the inbox. Resolving means DURABLE, not delivered. */
  enqueue: (input: CreateSessionPromptInput) => Promise<CreateSessionPromptResult>;
  /** Drop a prompt that has not gone out. Throws 409 for one already on the
   *  wire. Resolves with the removed prompt, which is what an undo re-POSTs:
   *  the row is hard-deleted, so nothing else still holds its full body. */
  remove: (promptId: string) => Promise<RemovedSessionPrompt>;
  /** Run THIS prompt next — the primitive behind both retry and "send now". */
  retry: (promptId: string) => Promise<SessionPrompt>;
  /** Hold, or release, the whole queue. The Stop button holds; any new send,
   *  and `retry`, release. */
  hold: (held: boolean) => Promise<{ prompts: SessionPrompt[] }>;
  refetch: () => Promise<unknown>;
}

export function useSessionPrompts(
  projectId: string | undefined,
  sessionId: string | undefined,
  options?: { pollMs?: number; enabled?: boolean },
): UseSessionPromptsResult {
  const queryClient = useQueryClient();
  const enabled = options?.enabled !== false && !!projectId && !!sessionId;
  const key = qk.project.sessionPrompts(projectId ?? '', sessionId ?? '');

  const query = useQuery({
    queryKey: key,
    enabled,
    queryFn: async () => (await listSessionPrompts(projectId!, sessionId!)).prompts,
    // Two cadences, never `false` — see the note above.
    refetchInterval: (q) => sessionPromptsPollMs(q.state.data?.length ?? 0, options?.pollMs),
    // Per-query, because the host disables focus refetching globally. Coming
    // back to a tab is the moment a prompt the server handed back while it was
    // hidden has to be on screen.
    refetchOnWindowFocus: true,
  });

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: key }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, projectId, sessionId],
  );

  const enqueueMutation = useMutation({
    mutationFn: (input: CreateSessionPromptInput) =>
      createSessionPrompt(projectId!, sessionId!, input),
    onSettled: invalidate,
  });
  const removeMutation = useMutation({
    mutationFn: (promptId: string) => deleteSessionPrompt(projectId!, sessionId!, promptId),
    onSettled: invalidate,
  });
  const retryMutation = useMutation({
    mutationFn: (promptId: string) => retrySessionPrompt(projectId!, sessionId!, promptId),
    onSettled: invalidate,
  });
  const holdMutation = useMutation({
    mutationFn: (held: boolean) => holdSessionPrompts(projectId!, sessionId!, held),
    onSettled: invalidate,
  });

  return {
    prompts: query.data ?? [],
    isLoading: query.isLoading,
    enqueue: enqueueMutation.mutateAsync,
    remove: removeMutation.mutateAsync,
    retry: retryMutation.mutateAsync,
    hold: holdMutation.mutateAsync,
    refetch: query.refetch,
  };
}
