/**
 * Kortix egress proxy — the Daytona half of network-boundary secrets.
 *
 * Platinum injects credentials at its own edge. Daytona has no equivalent and
 * no way to redirect traffic into one (`outboundProxyUrl` is accepted and
 * ignored — measured, see docs/NETWORK_BOUNDARY_ON_DAYTONA.md §7). What Daytona
 * does give us is a runner-enforced egress allow-list that root inside the
 * guest cannot escape. So:
 *
 *   guest ──(allow-list: ONLY this proxy)──▶ Kortix egress proxy ──▶ upstream
 *
 * Enforcement is the allow-list's job and lives outside the guest. This file is
 * only the injection half: it may assume every packet already has to come
 * through it.
 *
 * ## What it does
 *
 * `CONNECT host:443` arrives. If `host` has an injection rule, the proxy
 * terminates TLS with a per-sandbox ephemeral CA, adds the configured header,
 * re-originates the request over real TLS, and redacts the credential from the
 * response on the way back. If it has no rule, the bytes are tunnelled blind —
 * the proxy never sees them.
 *
 * ## Why selective termination is not an optimisation
 *
 * Blanket MITM would break every pinned-certificate client and mTLS handshake
 * in the sandbox, and would put Kortix in the middle of traffic that has
 * nothing to do with any secret. Terminating only the hosts that carry an
 * injection rule bounds both the breakage and the liability.
 */
import { Buffer } from 'node:buffer';
import type { Duplex } from 'node:stream';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';

import { redactSecretFromResponse } from '../http-broker';
import { LeafIssuer, type EphemeralCa } from './ca';

/** One host→header rule. `hosts` match exactly: no wildcards, no suffixes. */
export interface EgressInjectionRule {
  readonly hosts: readonly string[];
  readonly header: string;
  readonly value: string;
  /**
   * What to do when the upstream echoes the credential back.
   *  - `redact`  replace it in the body and return the rest (default)
   *  - `block`   cut the connection, matching Platinum's on_echo
   *
   * `redact` is the better default and this is a considered disagreement with
   * Platinum: cutting the connection surfaces as `curl: (52) Empty reply from
   * server`, which reads as "the feature is broken" and has cost this project
   * days of confusion. Redaction leaves a usable response with `[REDACTED]`
   * where the credential would have been.
   */
  readonly onEcho?: 'redact' | 'block';
}

export interface EgressProxyOptions {
  readonly ca: EphemeralCa;
  /**
   * Map a proxy credential to that sandbox's rules. Returning null rejects the
   * connection with 407 — a sandbox must identify itself before the proxy will
   * carry a byte for it, so one sandbox can never borrow another's injection.
   */
  readonly resolveRules: (token: string | null) => readonly EgressInjectionRule[] | null;
  /**
   * Test seam: extra `https.request` options for the upstream leg, so a test
   * can redirect `api.example.com` to a local HTTPS server and hand over its
   * CA. Shaped as request options rather than a "trust this CA" config value,
   * because a production knob that relaxes upstream verification is exactly the
   * knob that gets set by accident. Unset in production, where the upstream is
   * verified against the system trust store.
   */
  readonly upstreamOptions?: (host: string) => https.RequestOptions;
  readonly onError?: (where: string, err: Error) => void;
}

const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 30_000;

function proxyToken(req: http.IncomingMessage): string | null {
  const header = req.headers['proxy-authorization'];
  if (typeof header !== 'string') return null;
  const [scheme, ...rest] = header.trim().split(/\s+/);
  const value = rest.join(' ');
  if (!value) return null;
  if (scheme?.toLowerCase() === 'bearer') return value;
  if (scheme?.toLowerCase() === 'basic') {
    // curl and most clients only speak Basic to a proxy. The token rides as the
    // password so it never has to be URL-safe.
    const decoded = Buffer.from(value, 'base64').toString('utf8');
    const sep = decoded.indexOf(':');
    return sep === -1 ? decoded : decoded.slice(sep + 1);
  }
  return null;
}

function ruleFor(
  rules: readonly EgressInjectionRule[],
  host: string,
): EgressInjectionRule | null {
  const needle = host.toLowerCase();
  return rules.find((rule) => rule.hosts.some((h) => h.toLowerCase() === needle)) ?? null;
}

function parseTarget(target: string): { host: string; port: number } | null {
  // CONNECT targets are `host:port`; an IPv6 literal is bracketed.
  const match = /^(\[[^\]]+\]|[^:]+):(\d{1,5})$/.exec(target.trim());
  if (!match) return null;
  const host = match[1].replace(/^\[|\]$/g, '');
  const port = Number(match[2]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  return { host, port };
}

/**
 * Async because the proxy owns a loopback TLS listener that must be bound
 * before the first CONNECT can be served.
 */
export async function createEgressProxy(options: EgressProxyOptions): Promise<http.Server> {
  const issuer = new LeafIssuer(options.ca);
  const fail = options.onError ?? (() => {});

  /**
   * Serves the guest's decrypted requests.
   *
   * This is a REAL listener on loopback that the guest's tunnel is piped into,
   * rather than an `http.Server` handed a socket via `emit('connection')`. That
   * trick is Node-only — measured: under Bun the request event never fires and
   * the connection just hangs, while the identical script works under Node. The
   * API runs on Bun, so the socket has to reach a genuine listening port.
   *
   * The per-connection rule is keyed by the loopback source port, which is
   * unique per connection and is what the inner server sees as
   * `req.socket.remotePort`.
   */
  const bindings = new Map<number, { rule: EgressInjectionRule; host: string }>();
  const onTerminatedRequest: http.RequestListener = (req, res) => {
    const binding = bindings.get(req.socket.remotePort ?? -1);
    const rule = binding?.rule;
    const host = binding?.host ?? '';
    if (!rule) {
      res.writeHead(500).end('kortix egress proxy: no rule bound to connection');
      return;
    }

    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      // Strip hop-by-hop and any client-supplied copy of the managed header:
      // the injected value must be the ONLY one on the wire, or an agent could
      // shadow it and learn whether its guess matched.
      const headers: Record<string, string | string[]> = {};
      for (const [name, value] of Object.entries(req.headers)) {
        const lower = name.toLowerCase();
        if (lower === 'proxy-authorization' || lower === 'connection') continue;
        if (lower === rule.header.toLowerCase()) continue;
        if (value !== undefined) headers[name] = value;
      }
      headers[rule.header] = rule.value;
      headers.host = host;
      // Ask for an uncompressed body. Echo redaction is a byte scan, and a
      // gzipped response would sail through it — the credential would be
      // present but unrecognisable, so the protection would silently not
      // apply. Costs bandwidth on the Kortix→upstream leg only.
      headers['accept-encoding'] = 'identity';

      const upstream = https.request(
        {
          host,
          port: 443,
          method: req.method,
          path: req.url,
          headers,
          servername: host,
          timeout: UPSTREAM_TIMEOUT_MS,
          ...(options.upstreamOptions?.(host) ?? {}),
        },
        (upstreamRes) => {
          const body: Buffer[] = [];
          let total = 0;
          let truncated = false;
          upstreamRes.on('data', (chunk: Buffer) => {
            total += chunk.length;
            if (total > MAX_RESPONSE_BYTES) {
              truncated = true;
              upstreamRes.destroy();
              return;
            }
            body.push(chunk);
          });
          upstreamRes.on('end', () => {
            const raw = Buffer.concat(body);
            const echoed = raw.includes(rule.value);
            if (echoed && (rule.onEcho ?? 'redact') === 'block') {
              // Platinum's behaviour: kill it rather than return anything.
              res.socket?.destroy();
              return;
            }
            const redacted = echoed ? redactSecretFromResponse(raw, rule.value) : raw;
            const out = truncated
              ? Buffer.concat([redacted, Buffer.from('\n[truncated by kortix egress proxy]')])
              : redacted;

            const safeHeaders = { ...upstreamRes.headers };
            // The body has been fully buffered, so the upstream's framing no
            // longer describes it: redaction changes the length, and its
            // chunked encoding was already undone by reading to the end. State
            // the real length explicitly rather than deleting it and letting
            // the server pick — dropping both headers leaves Bun's HTTP server
            // holding the response instead of flushing it, which reads as a
            // hang with no error anywhere (measured: the handler ran to
            // completion and the client received nothing).
            delete safeHeaders['transfer-encoding'];
            safeHeaders['content-length'] = String(out.length);
            // Mirror the client's connection intent. Without this a client that
            // sent `Connection: close` is left holding an open socket, because
            // the upstream's own keep-alive header gets forwarded in its place.
            if (/close/i.test(String(req.headers.connection ?? ''))) {
              safeHeaders.connection = 'close';
            } else {
              delete safeHeaders.connection;
            }
            res.writeHead(upstreamRes.statusCode ?? 502, safeHeaders);
            res.end(out);
          });
        },
      );
      upstream.on('error', (err) => {
        fail('upstream', err);
        if (!res.headersSent) res.writeHead(502);
        res.end('kortix egress proxy: upstream error');
      });
      if (chunks.length > 0) upstream.write(Buffer.concat(chunks));
      upstream.end();
    });
  };

  /**
   * One loopback TLS listener per terminated host, each holding that host's
   * leaf as a STATIC cert.
   *
   * The obvious design is a single listener with `SNICallback` picking the leaf
   * per connection. Bun never invokes SNICallback — measured: the handshake
   * completes against a default certificate and the callback does not fire,
   * while the same script works under Node — so the certificate has to be fixed
   * at listen() time. Listeners are bounded by the number of distinct hosts
   * carrying an injection rule, which is small, and are created once.
   *
   * Loopback only: the decrypted leg must never be reachable from outside this
   * process.
   */
  const listeners = new Map<string, Promise<number>>();
  const innerServers: https.Server[] = [];
  function listenerFor(host: string): Promise<number> {
    const existing = listeners.get(host);
    if (existing) return existing;
    const started = (async () => {
      const leaf = issuer.issue(host);
      const inner = https.createServer({ cert: leaf.certPem, key: leaf.keyPem });
      inner.on('request', onTerminatedRequest);
      inner.on('clientError', (err) => fail('terminated-client', err));
      await new Promise<void>((resolve) => inner.listen(0, '127.0.0.1', resolve));
      innerServers.push(inner);
      return (inner.address() as net.AddressInfo).port;
    })();
    listeners.set(host, started);
    return started;
  }

  const server = http.createServer((_req, res) => {
    // Plain HTTP through the proxy is refused outright. Injecting a credential
    // into a cleartext request would put it on the wire unencrypted, which is
    // strictly worse than not having the feature.
    res.writeHead(405).end('kortix egress proxy: HTTPS CONNECT only');
  });

  server.on('connect', (req: http.IncomingMessage, socket: Duplex, head: Buffer) => {
    const rules = options.resolveRules(proxyToken(req));
    if (!rules) {
      socket.end('HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm="kortix"\r\n\r\n');
      return;
    }
    const target = parseTarget(req.url ?? '');
    if (!target) {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
      return;
    }

    const rule = target.port === 443 ? ruleFor(rules, target.host) : null;
    socket.on('error', (err) => fail('client', err as Error));

    if (!rule) {
      // No injection rule: blind tunnel. The proxy carries the bytes and never
      // looks at them, so a pinned or mTLS client is unaffected.
      const upstream = net.connect(target.port, target.host, () => {
        socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        if (head?.length) upstream.write(head);
        upstream.pipe(socket);
        socket.pipe(upstream);
      });
      upstream.on('error', (err) => {
        fail('tunnel', err);
        socket.destroy();
      });
      return;
    }

    // Injection rule: hand the tunnel to our own TLS listener for this host,
    // which terminates it, parses the request, and adds the header.
    void listenerFor(target.host)
      .then((terminatedPort) => {
        const inner = net.connect(terminatedPort, '127.0.0.1', () => {
          // Bind BEFORE any byte flows, so the request handler can never look
          // up a port that has not been registered yet.
          bindings.set(inner.localPort ?? -1, { rule, host: target.host });
          socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
          if (head?.length) inner.write(head);
          inner.pipe(socket);
          socket.pipe(inner);
        });
        const release = () => {
          if (inner.localPort) bindings.delete(inner.localPort);
        };
        inner.on('close', release);
        inner.on('error', (err) => {
          fail('terminate', err);
          release();
          socket.destroy();
        });
      })
      .catch((err) => {
        fail('listener', err as Error);
        socket.destroy();
      });
  });

  // Closing the proxy must also close every per-host listener, or the process
  // hangs on open handles after server.close().
  server.on('close', () => {
    for (const inner of innerServers) inner.close();
  });
  return server;
}
