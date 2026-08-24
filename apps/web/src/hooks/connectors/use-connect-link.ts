'use client';

export interface ConnectLinkResponse {
  connectUrl?: string;
  redirectUrl?: string;
  token?: string;
  app?: string;
}

export interface ConnectLinkFinalizeResult {
  connected: boolean;
}

export interface ConnectLinkFlowOptions {
  openWindow?: (url: string) => Window | null;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  pollIntervalMs?: number;
  timeoutMs?: number;
}

const DEFAULT_POLL_INTERVAL_MS = 2_000;
const DEFAULT_TIMEOUT_MS = 10 * 60_000;

const defaultSleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

export function connectLinkUrl(response: ConnectLinkResponse): string | null {
  return response.connectUrl || response.redirectUrl || null;
}

export async function runConnectLinkFlow(
  response: ConnectLinkResponse,
  finalize: () => Promise<ConnectLinkFinalizeResult>,
  options: ConnectLinkFlowOptions = {},
): Promise<{ connected: boolean }> {
  const url = connectLinkUrl(response);
  if (!url) throw new Error('App connect is not configured');
  if (typeof window === 'undefined' && !options.openWindow) {
    throw new Error('Connect Link requires a browser window');
  }

  const openWindow = options.openWindow ?? ((targetUrl: string) => window.open(targetUrl, '_blank'));
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? (() => Date.now());
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const deadline = now() + timeoutMs;

  const popup = openWindow(url);
  if (!popup) throw new Error('Allow popups to connect this app');
  popup.focus?.();

  while (now() <= deadline) {
    const result = await finalize();
    if (result.connected) return { connected: true };
    if (popup.closed) return { connected: false };
    await sleep(pollIntervalMs);
  }

  return { connected: false };
}
