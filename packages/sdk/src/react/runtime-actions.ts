'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type {
  Config,
  FileContent,
  Path as RuntimePathInfo,
  Project as RuntimeProjectInfo,
  ProviderAuthAuthorization,
  ProviderAuthMethod,
} from '../core/runtime/client';
import { getClient } from '../core/runtime/client';
import {
  deriveSubdomainOpts,
  getActiveOpenCodeUrl,
} from '../browser/stores/server-store';
import { runtimeServesOpenCodeRest } from '../core/session/current-runtime';
import type { SubdomainUrlOptions } from '../core/session/url';
import {
  buildStaticFileHealthPreviewUrl,
  buildStaticFilePreviewUrl,
  hasPreviewTarget,
} from '../core/session/url';
import { useCurrentRuntime } from './use-current-runtime';
import { opencodeKeys, useOpenCodeRestReady } from './use-opencode-sessions/keys';

interface RuntimeResult<T> {
  data?: T;
  error?: unknown;
}

function unwrapRuntimeResult<T>(result: RuntimeResult<T>): T {
  if (result.error) {
    const error = result.error as {
      message?: string;
      data?: { message?: string };
    };
    throw new Error(error.data?.message || error.message || 'Runtime request failed');
  }
  return result.data as T;
}

/**
 * Reject an imperative OpenCode REST read on a runtime that serves none.
 *
 * `getClient()` only proves a runtime URL is pinned; it cannot prove anything
 * answers on the other side. A managed ACP sandbox is healthy and pinned and
 * still answers `/project/current`, `/path`, and `/global/config` with an
 * error — forever, because its daemon never starts the compatibility server.
 * Rejecting here keeps the failure shape callers already handle (a rejected
 * promise) while sending no request at all. `async` on each caller below is
 * load-bearing: a synchronous throw from a function typed `Promise<T>` escapes
 * `.then(...)`/`.catch(...)` chains, so it must surface as a rejection.
 */
function requireOpenCodeRest(): void {
  if (runtimeServesOpenCodeRest()) return;
  throw new Error('This session runtime serves no OpenCode REST API');
}

export async function getRuntimeProjectInfo(): Promise<RuntimeProjectInfo> {
  requireOpenCodeRest();
  return getClient().project.current().then(unwrapRuntimeResult);
}

export async function getRuntimePathInfo(): Promise<RuntimePathInfo> {
  requireOpenCodeRest();
  return getClient().path.get().then(unwrapRuntimeResult);
}

export function readRuntimeTextFile(path: string): Promise<string | FileContent> {
  return getClient().file.read({ path }).then(unwrapRuntimeResult);
}

export function getRuntimeProviderAuthMethods(): Promise<
  Record<string, ProviderAuthMethod[]>
> {
  return getClient().provider.auth().then(unwrapRuntimeResult);
}

export function authorizeRuntimeProvider(
  providerID: string,
  method: number,
): Promise<ProviderAuthAuthorization> {
  return getClient().provider.oauth.authorize({ providerID, method }).then(unwrapRuntimeResult);
}

export function completeRuntimeProviderOAuth(
  providerID: string,
  method?: number,
  code?: string,
): Promise<boolean> {
  return getClient().provider.oauth.callback({
    providerID,
    method,
    ...(code ? { code } : {}),
  }).then(unwrapRuntimeResult);
}

export function setRuntimeProviderApiKey(
  providerID: string,
  key: string,
): Promise<boolean> {
  return getClient().auth.set({
    providerID,
    auth: { type: 'api', key },
  }).then(unwrapRuntimeResult);
}

export async function getRuntimeConfig(): Promise<Config> {
  requireOpenCodeRest();
  return getClient().global.config.get().then(unwrapRuntimeResult);
}

export function updateRuntimeConfig(config: Config): Promise<Config> {
  return getClient().global.config.update({ config } as never).then(unwrapRuntimeResult);
}

export async function refreshRuntimeConfiguration(): Promise<void> {
  unwrapRuntimeResult(await getClient().global.dispose());
}

export function logRuntimeEvent(input: {
  service: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  extra?: Record<string, unknown>;
}): void {
  void getClient().app.log(input);
}

/** Opaque identity for caches that must reset when the active runtime changes. */
export function getRuntimeCacheKey(): string {
  return getActiveOpenCodeUrl();
}

export interface ActiveSandboxProxyContext {
  serverUrl: string;
  subdomainOpts: SubdomainUrlOptions;
  /**
   * Whether the context can address a sandbox yet. False before a session's
   * runtime binds (and after it clears) — see `hasPreviewTarget`.
   */
  isReady: boolean;
}

export function createActiveSandboxProxyContext(): ActiveSandboxProxyContext {
  const subdomainOpts = deriveSubdomainOpts();
  return {
    serverUrl: getActiveOpenCodeUrl(),
    subdomainOpts,
    isReady: hasPreviewTarget(subdomainOpts),
  };
}

/**
 * Reactive form of `createActiveSandboxProxyContext`.
 *
 * The plain factory reads ambient state once. Anything that *renders* from it
 * must re-read when the runtime binds, because the binding is asynchronous: a
 * transcript paints as soon as messages load, which is routinely before
 * `ensureReady()` resolves the sandbox. A component that memoized the factory's
 * result on mount froze `sandboxId: ''` for its whole life and emitted
 * `/v1/p//3000/` preview links forever after.
 *
 * `version` bumps on every `setCurrentRuntime`, so it is the exact invalidation
 * signal — including the session-switch case, where the id changes but the
 * shape does not.
 */
export function useActiveSandboxProxyContext(): ActiveSandboxProxyContext {
  const version = useCurrentRuntime((state) => state.version);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `version` IS the dep;
  // the factory reads module state that only changes when version bumps.
  return useMemo(() => createActiveSandboxProxyContext(), [version]);
}

export function getActiveStaticFilePreviewUrl(path: string): string {
  return buildStaticFilePreviewUrl(path, deriveSubdomainOpts()) ?? '';
}

export function getActiveStaticFileHealthUrl(): string {
  return buildStaticFileHealthPreviewUrl(deriveSubdomainOpts());
}

export function useRuntimeProjectInfo(options?: { enabled?: boolean }) {
  const runtimeReady = useOpenCodeRestReady();
  return useQuery<RuntimeProjectInfo>({
    queryKey: opencodeKeys.currentProject(),
    queryFn: getRuntimeProjectInfo,
    enabled: runtimeReady && options?.enabled !== false,
    staleTime: Infinity,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}
