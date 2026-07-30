/**
 * Pure, dependency-free building blocks for `auth.ts` — extracted so they can
 * be unit-tested against the REAL implementation regardless of test-file
 * ordering.
 *
 * Why this file exists: several test suites register process-wide
 * `mock.module('../core/http/auth', …)` stubs (Bun's `mock.module` replaces a
 * specifier for the remainder of the process, for every importer — see the
 * note in `opencode/client.test.ts`). Any test that wants to exercise the real
 * retry/timeout semantics therefore can't import them from `./auth` — on some
 * Bun versions/orderings it would receive a stub. Nothing mocks THIS module,
 * so `auth-core.test.ts` always tests the genuine article, and `auth.ts` stays
 * a thin delegating shell whose behavior is pinned here.
 */

/** Options accepted by the token-retry helpers (`getAuthTokenWithRetry` et al). */
export interface TokenRetryOptions {
	attempts?: number;
	baseDelayMs?: number;
	invalidateBetweenAttempts?: boolean;
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry `getToken` up to `attempts` times (default 1 = no retry) until it
 * returns a truthy token, waiting `baseDelayMs` between attempts. When
 * `invalidateBetweenAttempts` is set, `onInvalidate` runs before each retry —
 * a host that layers its own cache on `getToken` wires cache invalidation
 * there. Returns the last (possibly falsy) result after exhausting attempts.
 */
export async function withTokenRetry(
	getToken: () => Promise<string | null>,
	options?: TokenRetryOptions,
	onInvalidate?: () => void,
): Promise<string | null> {
	const attempts = Math.max(1, options?.attempts ?? 1);
	const baseDelayMs = options?.baseDelayMs ?? 0;
	const invalidateBetweenAttempts = options?.invalidateBetweenAttempts ?? false;

	let token: string | null = null;
	for (let attempt = 0; attempt < attempts; attempt++) {
		if (attempt > 0) {
			if (invalidateBetweenAttempts) onInvalidate?.();
			if (baseDelayMs > 0) await delay(baseDelayMs);
		}
		token = await getToken();
		if (token) return token;
	}
	return token;
}

export const DEFAULT_FETCH_TIMEOUT_MS = 30_000;

/**
 * Long-lived streaming calls reached through the auth fetch injection point.
 * OpenCode REST uses `/global/event`. ACP uses the in-sandbox bridge
 * `/kortix/acp/:acpServerId` and the managed platform endpoint
 * `/projects/:projectId/sessions/:sessionId/acp`. Every one of these callers
 * manages its own abort, timeout, and reconnect lifecycle.
 *
 * The managed endpoint carries BOTH the SSE stream (`GET`) and every JSON-RPC
 * request (`POST`), including `session/prompt`, which stays open for as long as
 * the turn runs. A blanket 30s abort there cut the stream every 30 seconds and
 * failed any turn longer than 30 seconds, while the server still recorded the
 * result. `AcpClient` imposes its own per-method deadline instead
 * (`DEFAULT_REQUEST_TIMEOUT_MS`, and unbounded for `session/prompt`).
 *
 * `/acp/transcript` is a bounded JSON read and deliberately keeps the default
 * timeout — only a path ending in `/acp` is treated as streaming.
 */
export function isStreamingRequest(input: RequestInfo | URL): boolean {
	const url = input instanceof Request ? input.url : String(input);
	if (url.includes('/global/event') || url.includes('/kortix/acp/')) return true;
	const path = url.split('#')[0].split('?')[0];
	return path.endsWith('/acp');
}

/**
 * Compose the request's own abort signal with a default 30s timeout, so a
 * hung non-streaming call can't wedge a "Kortix as a Backend" server-side
 * handler forever. The SSE event stream is exempted (see
 * `isStreamingRequest`): its caller signal — if any — passes through
 * untouched. Falls back to the caller's bare signal on a runtime without
 * `AbortSignal.any` (older Node/engines) — guarded so a caller-supplied
 * signal is never silently dropped.
 */
export function withDefaultTimeout(
	input: RequestInfo | URL,
	init: RequestInit | undefined,
	timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
): AbortSignal | undefined {
	const callerSignal = input instanceof Request ? input.signal : init?.signal;
	if (isStreamingRequest(input)) return callerSignal ?? undefined;

	const timeoutSignal = AbortSignal.timeout(timeoutMs);
	if (!callerSignal) return timeoutSignal;
	if (typeof AbortSignal.any === 'function') {
		return AbortSignal.any([callerSignal, timeoutSignal]);
	}
	return callerSignal;
}

/**
 * Build a Headers object from request input + init, injecting the auth token
 * as a Bearer Authorization header (unless one is already present).
 */
export function buildAuthHeaders(
	input: RequestInfo | URL,
	init?: RequestInit,
	token?: string | null,
): Headers {
	const headers = new Headers(input instanceof Request ? input.headers : undefined);
	if (init?.headers) {
		new Headers(init.headers).forEach((value, key) => {
			headers.set(key, value);
		});
	}
	if (token && !headers.has('Authorization')) {
		headers.set('Authorization', `Bearer ${token}`);
	}
	return headers;
}

/**
 * The synthetic 401 returned when no token is available — safe for all
 * callers including the OpenCode SDK, which expects fetch() semantics
 * (returns a Response, never throws), and it means the request never goes
 * out on the wire unauthenticated.
 */
export function syntheticUnauthenticatedResponse(): Response {
	return new Response(JSON.stringify({ error: 'Not authenticated' }), {
		status: 401,
		headers: { 'Content-Type': 'application/json' },
	});
}
