/**
 * A stand-in for a Kortix environment: a plain HTTP server that executes the
 * ExecutionEnv RPC protocol against a real filesystem and a real shell.
 *
 * This exists so the worker can be proven end-to-end with no Kortix
 * credentials and no provisioned sandbox. In production this role is played by
 * the sandbox daemon behind `/v1/p/<external_id>/8000/...`; the protocol is
 * the same, the transport is the same, only the address changes.
 *
 * It deliberately runs with its own root directory so a test can assert that
 * files created by the agent land HERE and not in the worker's process cwd.
 */
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

const execAsync = promisify(execCb);

export interface StubEnvOptions { root: string; port?: number }

const codeFor = (e: any): string => {
  switch (e?.code) {
    case 'ENOENT': return 'not_found';
    case 'EACCES': case 'EPERM': return 'permission_denied';
    case 'ENOTDIR': return 'not_directory';
    case 'EISDIR': return 'is_directory';
    default: return 'unknown';
  }
};

export async function startStubEnvironment(opts: StubEnvOptions) {
  const root = path.resolve(opts.root);
  await fs.mkdir(root, { recursive: true });

  /** Resolve into the environment root. Nothing may address outside it. */
  const abs = (p: string, cwd: string) => {
    const joined = path.isAbsolute(p) ? p : path.join(cwd, p);
    const full = path.resolve(root, '.' + (joined.startsWith('/') ? joined : '/' + joined));
    if (!full.startsWith(root)) throw Object.assign(new Error('outside root'), { code: 'EACCES' });
    return full;
  };
  const toInfo = async (full: string, shown: string) => {
    const st = await fs.lstat(full);
    return {
      name: path.basename(shown),
      path: shown,
      kind: st.isDirectory() ? 'directory' : st.isSymbolicLink() ? 'symlink' : 'file',
      size: st.size,
      mtimeMs: st.mtimeMs,
    };
  };

  const ops: Record<string, (a: any, cwd: string) => Promise<unknown>> = {
    absolutePath: async (a, cwd) => (path.isAbsolute(a.path) ? a.path : path.posix.join(cwd, a.path)),
    joinPath: async (a) => path.posix.join(...a.parts),
    readTextFile: async (a, cwd) => fs.readFile(abs(a.path, cwd), 'utf8'),
    readTextLines: async (a, cwd) => {
      const t = await fs.readFile(abs(a.path, cwd), 'utf8');
      const lines = t.split('\n');
      return a.maxLines ? lines.slice(0, a.maxLines) : lines;
    },
    readBinaryFile: async (a, cwd) => (await fs.readFile(abs(a.path, cwd))).toString('base64'),
    writeFile: async (a, cwd) => {
      const f = abs(a.path, cwd);
      await fs.mkdir(path.dirname(f), { recursive: true });
      await fs.writeFile(f, a.encoding === 'base64' ? Buffer.from(a.content, 'base64') : a.content);
    },
    appendFile: async (a, cwd) => {
      const f = abs(a.path, cwd);
      await fs.mkdir(path.dirname(f), { recursive: true });
      await fs.appendFile(f, a.encoding === 'base64' ? Buffer.from(a.content, 'base64') : a.content);
    },
    renameFile: async (a, cwd) => { await fs.rename(abs(a.sourcePath, cwd), abs(a.destinationPath, cwd)); },
    fileInfo: async (a, cwd) => toInfo(abs(a.path, cwd), path.isAbsolute(a.path) ? a.path : path.posix.join(cwd, a.path)),
    listDir: async (a, cwd) => {
      const shown = path.isAbsolute(a.path) ? a.path : path.posix.join(cwd, a.path);
      const names = await fs.readdir(abs(a.path, cwd));
      return Promise.all(names.map((n) => toInfo(path.join(abs(a.path, cwd), n), path.posix.join(shown, n))));
    },
    canonicalPath: async (a, cwd) => {
      const real = await fs.realpath(abs(a.path, cwd));
      return real.slice(root.length) || '/';
    },
    exists: async (a, cwd) => { try { await fs.lstat(abs(a.path, cwd)); return true; } catch (e: any) { if (e.code === 'ENOENT') return false; throw e; } },
    createDir: async (a, cwd) => { await fs.mkdir(abs(a.path, cwd), { recursive: a.recursive !== false }); },
    remove: async (a, cwd) => { await fs.rm(abs(a.path, cwd), { recursive: !!a.recursive, force: !!a.force }); },
    createTempDir: async (a, cwd) => {
      const d = await fs.mkdtemp(path.join(abs('/tmp', cwd), a.prefix ?? 'tmp-').replace(/\/$/, ''));
      return d.slice(root.length);
    },
    createTempFile: async (a, cwd) => {
      const d = abs('/tmp', cwd);
      await fs.mkdir(d, { recursive: true });
      const f = path.join(d, `${a.prefix ?? ''}${Date.now()}${Math.floor(Math.random() * 1e6)}${a.suffix ?? ''}`);
      await fs.writeFile(f, '');
      return f.slice(root.length);
    },
    exec: async (a, cwd) => {
      const wd = abs(a.cwd ?? cwd, cwd);
      await fs.mkdir(wd, { recursive: true });
      try {
        const { stdout, stderr } = await execAsync(a.command, {
          cwd: wd,
          env: { ...process.env, ...(a.env ?? {}) },
          timeout: a.timeout ? a.timeout * 1000 : undefined,
          maxBuffer: 16 * 1024 * 1024,
        });
        return { stdout, stderr, exitCode: 0 };
      } catch (e: any) {
        return { stdout: e.stdout ?? '', stderr: e.stderr ?? String(e.message), exitCode: e.code ?? 1 };
      }
    },
  };

  const server = createServer((req, res) => {
    if (req.method !== 'POST' || !req.url?.startsWith('/rpc')) { res.writeHead(404).end(); return; }
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', async () => {
      let out: any;
      try {
        const { op, args, cwd } = JSON.parse(body);
        const fn = ops[op];
        if (!fn) out = { ok: false, error: { code: 'not_supported', message: `no op ${op}` } };
        else out = { ok: true, value: await fn(args ?? {}, cwd ?? '/workspace') };
      } catch (e: any) {
        out = { ok: false, error: { code: codeFor(e), message: String(e?.message ?? e), path: e?.path } };
      }
      const payload = JSON.stringify(out);
      res.writeHead(200, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) });
      res.end(payload);
    });
  });

  // Per-call HTTP is fragile precisely the way the plan predicts: without
  // these, Node retires an idle keep-alive socket while the client is still
  // reusing it and the next RPC dies with "socket connection was closed".
  // The production answer is one multiplexed connection per session, not a
  // longer timeout — this is the spike making the problem visible, not solved.
  // Multiplexed transport: one socket, many in-flight calls correlated by id.
  // Same op table as /rpc — the transport changes, the protocol does not.
  const wss = new WebSocketServer({ server, path: '/rpc-ws' });
  wss.on('connection', (socket) => {
    socket.on('message', async (raw) => {
      let msg: any;
      try { msg = JSON.parse(String(raw)); } catch { return; }
      let body: unknown;
      try {
        const fn = ops[msg.op];
        body = fn
          ? { ok: true, value: await fn(msg.args ?? {}, msg.cwd ?? '/workspace') }
          : { ok: false, error: { code: 'not_supported', message: `no op ${msg.op}` } };
      } catch (e: any) {
        body = { ok: false, error: { code: codeFor(e), message: String(e?.message ?? e), path: e?.path } };
      }
      socket.send(JSON.stringify({ id: msg.id, body }));
    });
  });

  server.keepAliveTimeout = 120_000;
  server.headersTimeout = 125_000;

  await new Promise<void>((r) => server.listen(opts.port ?? 0, '0.0.0.0', r));
  const port = (server.address() as any).port;
  return {
    port, root, url: `http://127.0.0.1:${port}`,
    // Forceful on purpose: `server.close()` waits for every live connection to
    // end, and a keep-alive socket or an open WebSocket will hold it open
    // forever. A test that hangs on teardown looks exactly like a test that
    // silently passed, which is worse than one that fails.
    close: () =>
      new Promise<void>((r) => {
        for (const client of wss.clients) client.terminate();
        wss.close();
        (server as any).closeAllConnections?.();
        server.close(() => r());
      }),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.env.ENV_ROOT ?? path.join(os.tmpdir(), 'kortix-stub-env');
  startStubEnvironment({ root, port: Number(process.env.PORT ?? 8100) }).then((s) =>
    console.log(`[stub-environment] ${s.url}  root=${s.root}`),
  );
}
