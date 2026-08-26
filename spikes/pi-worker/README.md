# pi-worker — Phase 0 spike

A working Kortix **worker**: the agent harness, running in a 138 MB Alpine
image, with every file and shell operation routed over RPC into a separate
environment. Its own disk is never touched by any built-in tool.

Reference: `docs/specs/2026-08-26-harness-worker-split.md`.

> This is a spike. It is here to answer questions and produce numbers, not to
> ship. Nothing in `apps/` was changed.

---

## The result in one line

`pi-agent-core`'s built-in tools do not touch the filesystem directly — they
resolve it from an injected `ExecutionEnv`:

```ts
export interface ExecutionToolContext { env: ExecutionEnv }   // pi-agent-core
export interface ExecutionEnv extends FileSystem, Shell {}
```

So the worker does not rewrite, wrap, or forbid a single tool. It supplies one
object:

```ts
const tools = [createBashTool(), createReadTool(), createWriteTool(), createEditTool()]
  .map((t) => bindTool(t, { env: new KortixExecutionEnv({ baseUrl, cwd }) }));
```

That is the whole harness/environment split. One seam, not a policy.

---

## How to test it

### 0. Prerequisites

Docker, and `bun` for the local runs. Everything below works with **no Kortix
credentials and no API key** — the spike uses pi's built-in `fauxProvider`,
which is a real provider interface returning scripted assistant messages, so
the agent loop, the tool dispatch and the RPC are all genuinely exercised.

```bash
cd spikes/pi-worker
npm install
```

### 1. The proof — S0.1, "tool replacement holds"

```bash
bun test/proof.ts
```

Expected:

```
  PASS  every tool call crossed the RPC boundary  — 8 RPC ops: absolutePath, canonicalPath, writeFile, exec, exists, readBinaryFile
  PASS  shell executed through the environment, not locally
  PASS  write executed through the environment
  PASS  the file exists in the ENVIRONMENT
  PASS  the WORKER disk is byte-for-byte unchanged
  PASS  no agent artifact anywhere on the worker
6/6 passed
```

**Read the fifth assertion, not the fourth.** "The agent wrote a file" proves
nothing. "The agent wrote a file *and the worker's disk is byte-for-byte
unchanged*" is the claim — a run that does both the right thing and a local
write is a failure, because that is precisely how the split silently collapses
back into today's single box.

The test snapshots the worker's cwd (size + mtime, recursively) before and
after a real turn and diffs it.

### 2. Build and run the two containers

```bash
bun build src/worker.ts          --target=node --format=esm --minify --outfile dist/worker.mjs
bun build src/stub-environment.ts --target=node --format=esm --minify --outfile dist/environment.mjs

docker build -t kortix-worker:spike .
docker build -t kortix-env:spike -f Dockerfile.environment .

docker network create kx-spike
docker run -d --rm --name kx-env    --network kx-spike kortix-env:spike
docker run -d --rm --name kx-worker --network kx-spike --read-only -p 18080:8080 \
  -e KORTIX_ENV_URL=http://kx-env:8100 kortix-worker:spike
```

Note `--read-only`: the worker runs with an immutable root filesystem as an
unprivileged user. That is defence in depth *behind* the ExecutionEnv seam, not
instead of it.

### 3. Drive a turn

The `script` array scripts the faux model: `{"tool": …}` makes it emit a tool
call, `{"text": …}` makes it answer and stop.

```bash
curl -s -X POST localhost:18080/prompt -H 'content-type: application/json' -d '{
  "text": "write a report and inspect the machine",
  "script": [
    {"tool":"write","args":{"path":"/workspace/report.md","content":"# built by the worker\n"}},
    {"tool":"bash","args":{"command":"head -1 /etc/os-release; ls -la /workspace"}},
    {"tool":"read","args":{"path":"/workspace/report.md"}},
    {"text":"done"}
  ]}'
```

Returns the ops that crossed the boundary:

```json
{"ok":true,"result":{"messages":8},
 "rpcCalls":["absolutePath","absolutePath","canonicalPath","writeFile","exec","absolutePath","exists","readBinaryFile"]}
```

### 4. Check where the work landed — this is the point

```bash
docker exec kx-env    sh -c 'ls -la /env-root/workspace && cat /env-root/workspace/report.md'
docker exec kx-worker sh -c 'find / -name "report.md" -not -path "/proc/*" 2>/dev/null'
```

The file is in the **environment**. The worker has no `/workspace` at all and
the `find` returns nothing.

### 5. Measure cold boot

```bash
for i in 1 2 3 4 5; do
  t0=$(python3 -c 'import time;print(int(time.time()*1000))')
  docker run -d --rm --name kx-boot --network kx-spike --read-only -p 18081:8080 \
    -e KORTIX_ENV_URL=http://kx-env:8100 kortix-worker:spike >/dev/null
  until curl -sf localhost:18081/health >/dev/null 2>&1; do sleep 0.01; done
  t1=$(python3 -c 'import time;print(int(time.time()*1000))')
  echo "run $i: $((t1-t0)) ms"
  docker rm -f kx-boot >/dev/null
done
```

### 6. Other endpoints

```bash
curl -s localhost:18080/health                 # boot ms, model mode, RPC count
curl -sN localhost:18080/events                # SSE: the live agent event stream
curl -s -X POST localhost:18080/interrupt      # abort the current turn
```

### 7. With a real model (needs your own key)

```bash
docker run -d --rm --name kx-worker --network kx-spike --read-only -p 18080:8080 \
  -e KORTIX_ENV_URL=http://kx-env:8100 \
  -e KORTIX_MODEL_MODE=real \
  -e KORTIX_API_KEY="$ANTHROPIC_API_KEY" \
  kortix-worker:spike

curl -s -X POST localhost:18080/prompt -H 'content-type: application/json' \
  -d '{"text":"Create /workspace/hello.txt with a haiku about sandboxes, then cat it."}'
```

Add `-e KORTIX_GATEWAY_URL=https://<gateway>` to route through the Kortix LLM
gateway instead of the provider directly — that single variable is the whole
gateway integration, because pi models `ModelAuth` as
`{ apiKey?, headers?, baseUrl? }`.

---

## Benchmark: real Daytona sandboxes

`bench/daytona-bench.ts` is standalone — no Kortix API, no database, no UI. It
builds a Daytona snapshot from the worker image, boots real sandboxes, measures,
and deletes everything it created.

```bash
bun bench/daytona-bench.ts --runs=5                     # faux model
bun bench/daytona-bench.ts --runs=5 --delete-snapshots  # also drop the snapshots
KORTIX_API_KEY=sk-... bun bench/daytona-bench.ts --real # absolute TTFT
```

Credentials are read with `dotenvx get` from `apps/api/.env` and never written
anywhere. `--keep` leaves the sandboxes up for poking; without it the `finally`
block deletes them even on failure.

### Results — 5 runs, Daytona `us`, 1 vCPU / 1 GB

```
daytona create() call      min  1205 ms   med  1410 ms   max  1633 ms
process start -> serving   min   211 ms   med   543 ms   max   759 ms
time to first token        min    12 ms   med    13 ms   max    16 ms
bash tool round trip       min    60 ms   med    67 ms   max   284 ms
```

**The tool round trip is the finding.** 67 ms median, worker → provider edge →
environment — the same shape production would use (worker → Kortix proxy →
sandbox daemon). At that cost **a 200-tool-call turn pays 13.3 s, on every turn,
forever**, against a `bash` that is a local fork today at roughly 1 ms.

That is larger than the one-off boot saving. The split is a clear win for
reasoning-heavy sessions and a regression for tool-heavy ones unless the RPC is
multiplexed and co-located. It is not a detail to schedule later; it decides
whether the architecture pays.

With the faux model, TTFT is infrastructure only — boot plus dispatch. That is
deliberate: provider latency is identical before and after the split, so
including it only adds noise to the decision.

### Two measurement traps this hit, both worth knowing

1. **Daytona isolates sandboxes from each other.** A worker cannot reach an
   environment by private IP — `EHOSTUNREACH`. The first run reported a
   suspiciously constant "3.07 s round trip" which was a TCP connect timeout
   times one retry, not latency. The reachable path is the provider's edge,
   which is also the production topology.
2. **`/proc/uptime` is virtualized in Daytona** and disagrees with the process
   clock read microseconds later (280 ms vs 513 ms), so "VM boot → serving"
   cannot be measured from inside the sandbox at all. That gap is precisely
   what P1.0's API-side clock exists to measure — independent evidence that it
   is needed, not optional.

---

## Measured locally

| | today (`apps/sandbox`) | this worker |
|---|---|---|
| image | ~6–8 GB | **138 MB** |
| bundle | n/a — clone + resolve at boot | **one 516 KB `.mjs`**, 907 modules inlined |
| container start → serving | — | **226–274 ms** |
| harness construction | — | **56–88 ms** |
| runtime module resolution | npm/plugin load at boot | **none** |

Docker on macOS, so these are a proxy for a micro-VM, not a substitute — see
the Daytona benchmark above for numbers on real infrastructure. The number the
plan still needs is P1.0's: `POST /sessions` → first token, on dev, against
today's warm-pool hit.

---

## What the spike found

1. **`ExecutionEnv` is the seam** — one injected object moves the agent's entire
   world. Better than the per-tool override the plan assumed.
2. **Build on `pi-agent-core`, not `pi-coding-agent`.** The full package drags in
   `jiti` (runtime module loading, fights a hermetic bundle) and
   `@silvia-odwyer/photon-node` (WASM/native, a musl risk). `pi-agent-core` has
   neither and bundles clean.
3. **`AgentHarness` is not implemented in 0.84.3** — all 23 methods throw
   `HarnessNotImplemented`. The working orchestrator is `Agent`
   (`prompt` / `steer` / `followUp` / `abort` / `subscribe`, plus
   `beforeToolCall` / `afterToolCall` / `shouldStopAfterTurn` hooks). Pin the
   version and watch this.
4. **The gateway is a `baseUrl`** — `ModelAuth { apiKey?, headers?, baseUrl? }`.
   S0.2's kill condition does not fire.
5. **The tool RPC tax is measured, and it is the deciding number.** 67 ms
   median per call on Daytona. See the benchmark section.
6. **Per-call HTTP is already fragile at three calls.** The first end-to-end run
   died on `"The socket connection was closed unexpectedly"` — a keep-alive
   socket retired between RPCs. It is patched here with a longer server timeout
   and one client retry, which is a plaster. The plan's requirement for a single
   multiplexed connection is not an optimization; it showed up as a correctness
   bug at trivial scale.

## Still open in Phase 0

- **S0.4** — a custom session store read back with no Pi process running. The
  interfaces exist (`SessionStorage`, `SessionRepo`, `InMemorySessionRepo`,
  `JsonlSessionRepo` with an injectable filesystem); not yet exercised.
- **S0.5** — mapping the `Agent` event stream onto what `apps/web` consumes.
- **S0.2 end-to-end** — a real turn through the deployed Kortix gateway with
  attribution visible in its log. The wiring is in `src/worker.ts`; it needs a
  key and a gateway URL to run.
