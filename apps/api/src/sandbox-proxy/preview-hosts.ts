/**
 * Where a sandbox port is reachable in a browser.
 *
 * ONE resolver, used by BOTH the URL Kortix hands out (`previewOrigin`) and the
 * host matcher that accepts inbound preview traffic (`resolvePreviewHost`) —
 * the same split-brain that once published Apps on a domain an operator did not
 * own is exactly as available here, so the two directions share one shape.
 *
 * ## Why a per-preview ORIGIN and not a path prefix
 *
 * The path form `/v1/p/{sandbox}/{port}/…` is a fine transport for programmatic
 * clients, and it stays. It is not a browser surface: an app served under a path
 * prefix escapes it the moment it emits anything root-absolute —
 * `<a href="/learn">`, `fetch('/api')`, `url(/bg.png)`, `pushState('/x')`, a
 * service worker scoped to `/`, `new WebSocket('/hmr')`. Rewriting HTML cannot
 * close that set; only giving the app its own origin can. That is also why
 * every comparable product (Codespaces, ngrok, StackBlitz, Daytona's own proxy)
 * routes previews by hostname.
 *
 * There is a second reason. Under the path form, arbitrary sandbox code runs on
 * the SAME origin as the Kortix API, so two of a user's previews share cookies,
 * storage, and a same-origin relationship with `/v1/p/…`. A per-preview origin
 * puts each app in its own security principal.
 *
 * ## The shape
 *
 *   deployed   {env}-p{port}-{sandbox-label}.{previewBaseDomain}
 *              dev-p8081-sbx-01m0g4hxcm32bx5r1gpyzdyc1h.p.kortix.com
 *   local      p{port}-{sandbox-label}.localhost:{apiPort}
 *
 * The env prefix is what lets dev, staging and prod share one wildcard
 * certificate and one edge Worker, exactly as Kortix Apps does. The sandbox
 * label is the external id lowercased with `_` → `-`, because DNS labels are
 * case-insensitive and cannot carry an underscore; `loadSandbox` resolves a
 * label back to the canonical row (see backend.ts).
 */
import { config } from '../config';

/** `{env}-p{port}-{label}` on a real domain; `p{port}-{label}` on localhost. */
const DEPLOYED_LABEL = /^(dev|staging|prod|preview)-p(\d{1,5})-([a-z0-9-]+)$/;
const LOCAL_HOST = /^p(\d{1,5})-([a-z0-9-]+)\.localhost$/;

export interface ResolvedPreviewHost {
  /** DNS-safe sandbox label — resolve to a canonical row with `loadSandbox`. */
  sandboxLabel: string;
  port: number;
  local: boolean;
}

/**
 * A sandbox external id as a DNS label. Lowercase because browsers lowercase
 * the Host header, `_` → `-` because an underscore is not a legal hostname
 * character (browsers and CAs both reject it).
 */
export function sandboxHostLabel(externalId: string): string {
  return externalId.trim().toLowerCase().replaceAll('_', '-');
}

function normalizeDomain(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^\.+|\.+$/g, '');
}

/**
 * The registrable domain of this deployment's public API origin: drop the
 * leftmost label once there are three or more, so `api.kortix.com` and
 * `dev-api.kortix.com` both give `kortix.com`. Mirrors apps/hostnames.ts.
 */
function registrableDomain(origin: string): string | null {
  let hostname: string;
  try {
    hostname = new URL(origin).hostname.toLowerCase().replace(/\.$/, '');
  } catch {
    return null;
  }
  if (!hostname || hostname === 'localhost') return null;
  const labels = hostname.split('.');
  if (labels.length < 2) return null;
  return (labels.length >= 3 ? labels.slice(1) : labels).join('.');
}

/** True when previews are served as `p{port}-{label}.localhost:{apiPort}`. */
export function previewLocalMode(): boolean {
  if (process.env.KORTIX_PREVIEW_LOCAL === 'true') return true;
  if (config.KORTIX_PREVIEW_BASE_DOMAIN) return false;
  return config.KORTIX_URL.includes('localhost') || config.KORTIX_URL.includes('127.0.0.1');
}

/**
 * The wildcard domain every preview hostname sits under, or null when this
 * deployment has none — a self-host that never configured one, where previews
 * keep using the path proxy. Never falls back to a domain we do not serve.
 */
export function previewBaseDomain(): string | null {
  const configured = config.KORTIX_PREVIEW_BASE_DOMAIN;
  if (configured && normalizeDomain(configured)) return normalizeDomain(configured);
  const derived = registrableDomain(config.KORTIX_URL);
  return derived ? `p.${derived}` : null;
}

/** Hostname (no scheme, no port) for a sandbox port, or null with no domain. */
export function previewHostname(externalId: string, port: number): string | null {
  const label = sandboxHostLabel(externalId);
  if (!label || !Number.isInteger(port) || port < 1 || port > 65535) return null;
  if (previewLocalMode()) return `p${port}-${label}.localhost`;
  const domain = previewBaseDomain();
  if (!domain) return null;
  return `${config.INTERNAL_KORTIX_ENV}-p${port}-${label}.${domain}`;
}

/** Full origin for a sandbox port, or null when this deployment has no domain. */
export function previewOrigin(externalId: string, port: number): string | null {
  const host = previewHostname(externalId, port);
  if (!host) return null;
  if (previewLocalMode()) {
    return `http://${host}:${process.env.KORTIX_PREVIEW_LOCAL_PORT || String(config.PORT)}`;
  }
  return `https://${host}`;
}

/**
 * The template the SDK substitutes to build a preview URL without duplicating
 * the hostname shape client-side. `{port}` and `{sandbox}` are the only slots;
 * `{sandbox}` receives the RAW external id, which the client label-encodes the
 * same way `sandboxHostLabel` does.
 */
export function previewUrlTemplate(): string | null {
  if (previewLocalMode()) {
    const port = process.env.KORTIX_PREVIEW_LOCAL_PORT || String(config.PORT);
    return `http://p{port}-{sandbox}.localhost:${port}`;
  }
  const domain = previewBaseDomain();
  if (!domain) return null;
  return `https://${config.INTERNAL_KORTIX_ENV}-p{port}-{sandbox}.${domain}`;
}

/**
 * Match an inbound Host header. Returns null for every hostname that is not a
 * preview for THIS environment — including a well-formed preview label for a
 * different env, which must never be served by the wrong deployment.
 */
export function resolvePreviewHost(hostname: string): ResolvedPreviewHost | null {
  // Port first, then the FQDN trailing dot: a Host header may carry both
  // (`host.example.:443`), and stripping the dot first leaves it stranded.
  const host = (hostname || '').toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');

  const local = LOCAL_HOST.exec(host);
  if (local) {
    return { port: Number(local[1]), sandboxLabel: local[2]!, local: true };
  }

  const domain = previewBaseDomain();
  if (!domain || !host.endsWith(`.${domain}`)) return null;
  const label = host.slice(0, -(domain.length + 1));
  if (label.includes('.')) return null;
  const match = DEPLOYED_LABEL.exec(label);
  if (!match || match[1] !== config.INTERNAL_KORTIX_ENV) return null;
  const port = Number(match[2]);
  if (port < 1 || port > 65535) return null;
  return { port, sandboxLabel: match[3]!, local: false };
}
