import { Composio } from '@composio/core';
import type { ExecResult } from './call';
import type { ComposioToolLike } from './types';

export interface ComposioRuntime {
  sessions: {
    create(
      userId: string,
      config?: { toolkits?: string[]; manageConnections?: boolean },
    ): Promise<ComposioSessionLike>;
    use(sessionId: string): Promise<ComposioSessionLike>;
  };
}

export interface ComposioSessionLike {
  sessionId: string;
  tools(): Promise<ComposioToolLike[]>;
  toolkits?(options?: { toolkits?: string[] }): Promise<{
    items: Array<{ connection?: { isActive?: boolean; connectedAccount?: { id: string } } }>;
  }>;
  authorize(
    toolkit: string,
    options?: { callbackUrl?: string; alias?: string },
  ): Promise<{ id: string; status?: string; redirectUrl?: string | null; toJSON?: () => { id: string; status?: string; redirectUrl?: string | null } }>;
  execute(
    toolSlug: string,
    args?: Record<string, unknown>,
    options?: { account?: string },
  ): Promise<{ data: Record<string, unknown>; error: string | null; logId: string }>;
}

export interface ComposioExecuteInput {
  projectId: string;
  connectorSlug: string;
  toolkit: string;
  toolSlug: string;
  args: Record<string, unknown>;
  accountId: string | null;
  userId: string | null;
}

let runtime: ComposioRuntime | null = null;

export function composioConfigured(): boolean {
  return !!process.env.COMPOSIO_API_KEY;
}

export function composioUserId(projectId: string, slug: string, connectionId?: string | null): string {
  return connectionId ? `kortix-connection:${connectionId}` : `kortix-connector:${projectId}:${slug}`;
}

export function getComposioRuntime(): ComposioRuntime {
  if (!composioConfigured()) throw new Error('Composio is not configured (set COMPOSIO_API_KEY)');
  if (!runtime) {
    runtime = new Composio({
      apiKey: process.env.COMPOSIO_API_KEY,
      allowTracking: false,
      dangerouslyAllowAutoUploadDownloadFiles: false,
    }) as unknown as ComposioRuntime;
  }
  return runtime;
}

export function setComposioRuntimeForTest(next: ComposioRuntime | null): void {
  runtime = next;
}

export async function composioSessionTools(input: {
  projectId: string;
  connectorSlug: string;
  toolkit: string;
  userId?: string | null;
  runtime?: ComposioRuntime;
}): Promise<ComposioToolLike[]> {
  const session = await (input.runtime ?? getComposioRuntime()).sessions.create(
    composioUserId(input.projectId, input.connectorSlug, input.userId ?? null),
    { toolkits: [input.toolkit], manageConnections: true },
  );
  return session.tools();
}

export async function executeComposio(input: ComposioExecuteInput & { runtime?: ComposioRuntime }): Promise<ExecResult> {
  const session = await (input.runtime ?? getComposioRuntime()).sessions.create(
    composioUserId(input.projectId, input.connectorSlug, input.userId),
    { toolkits: [input.toolkit], manageConnections: true },
  );
  const response = await session.execute(
    input.toolSlug,
    input.args,
    input.accountId ? { account: input.accountId } : undefined,
  );
  const requestId = typeof response.logId === 'string' ? response.logId.trim() : '';
  if (!requestId) throw new Error('composio execution returned no log id');
  if (response.error) return { ok: false, status: 502, data: response };
  return { ok: true, status: 200, data: { provider: 'composio', requestId, result: response.data } };
}

export async function composioConnectUrl(input: {
  projectId: string;
  slug: string;
  app: string;
  externalUserId: string;
  redirects?: { success?: string; error?: string };
  runtime?: ComposioRuntime;
}): Promise<{ connectUrl: string; requestId?: string; connectedAccountId?: string }> {
  const runtime = input.runtime ?? getComposioRuntime();
  const session = await runtime.sessions.create(input.externalUserId, {
    toolkits: [input.app],
    manageConnections: true,
  });
  const request = await session.authorize(input.app, {
    ...(input.redirects?.success ? { callbackUrl: input.redirects.success } : {}),
    alias: input.slug,
  });
  const state = request.toJSON ? request.toJSON() : request;
  const connectUrl = state.redirectUrl ?? '';
  if (!connectUrl) throw new Error('composio authorize returned no redirect url');
  return {
    connectUrl,
    requestId: state.id,
    connectedAccountId: state.id,
  };
}

export async function finalizeComposioConnection(input: {
  projectId: string;
  slug: string;
  app: string;
  externalUserId: string;
  expectedAccountId: string;
  runtime?: ComposioRuntime;
}): Promise<{ connected: boolean; connectedAccountId?: string; requestId?: string }> {
  const session = await (input.runtime ?? getComposioRuntime()).sessions.create(input.externalUserId, {
    toolkits: [input.app],
    manageConnections: true,
  });
  const toolkits = await session.toolkits?.({ toolkits: [input.app] });
  const connectedAccountId = toolkits?.items?.[0]?.connection?.connectedAccount?.id ?? input.expectedAccountId;
  const isActive = toolkits?.items?.[0]?.connection?.isActive === true;
  return {
    connected: connectedAccountId === input.expectedAccountId && isActive,
    connectedAccountId,
    requestId: connectedAccountId,
  };
}
