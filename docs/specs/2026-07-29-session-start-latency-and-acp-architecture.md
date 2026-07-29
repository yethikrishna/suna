# Session-start latency and ACP architecture

**Date:** 2026-07-29

**Status:** Measured baseline, cache A/B, selected-harness refactor, and target
architecture

**Scope:** Daytona, Platinum, local, dev, production, OpenCode, Pi, ACP, and
repository materialization

## 1. Answer

The normal OpenCode sandbox process already uses ACP.

`opencode.start()` is a sandbox-daemon method. It starts `opencode acp` and
waits for ACP `initialize`.

The Kortix SDK does not call this method. The SDK calls the Kortix session
lifecycle route.

The measured cold path performs two expensive operations:

1. It materializes the repository.
2. It starts and initializes a cold OpenCode process.

The sub-one-second target requires both operations to leave the claim path.

The multi-harness implementation on `origin/main` had a third problem.

It started legacy OpenCode before it started the selected ACP harness.

Selecting Pi therefore added Pi startup after OpenCode startup.

This branch removes legacy OpenCode from a managed session. It starts and
initializes only the selected ACP harness.

## 2. Current call graph

```text
@kortix/sdk session.start() or useSession()
  -> POST /v1/projects/:projectId/sessions/:sessionId/start
  -> API session lifecycle
  -> provider create or resume
  -> sandbox entrypoint
  -> kortix-sandbox-agent-server
  -> repository materialization
  -> selected runtime branch
       -> legacy session:
            opencode.start()
            -> spawn opencode acp
            -> ACP initialize
       -> managed session:
            AcpRuntime.getOrCreate(selected harness)
            -> spawn selected ACP harness
            -> ACP initialize
  -> ACP session/new or session/resume
  -> runtimeReady
```

These methods share the word `start`. They have different responsibilities.

| name | owner | operation |
|---|---|---|
| SDK `session.start()` | `@kortix/sdk` | Calls the Kortix lifecycle API |
| API `/sessions/:sessionId/start` | `apps/api` | Resolves or provisions runtime capacity |
| daemon `opencode.start()` | sandbox daemon | Starts and initializes the legacy OpenCode ACP process |
| ACP `session/new` | runtime harness | Creates the canonical harness session |

## 3. ACP status

The normal process launch is:

```text
opencode acp --port <port> --hostname 127.0.0.1 --cwd <workspace>
```

The default process transport is `acp`.

The repository contains two OpenCode compatibility surfaces:

1. A low-level `opencode serve` process rollback.
2. An SDK REST compatibility client for the OpenCode internal HTTP server.

Managed ACP sessions no longer start these surfaces. Legacy sessions keep them.

The client and process transports are separate concepts.

## 4. Comparable starter-project baseline

Each target contains five sequential sessions.

Every sample used a `default-cold` image.

| environment | provider | ready p50 | ready p90 | provider create p50 | repository p50 | OpenCode ACP initialize p50 | ACP session p50 |
|---|---:|---:|---:|---:|---:|---:|---:|
| production | Daytona | 22.430 s | 46.467 s | 1.412 s | 7.764 s | 7.222 s | 768 ms |
| production | Platinum | 27.279 s | 32.202 s | 2.271 s | 6.287 s | 12.973 s | 1.639 s |
| dev | Daytona | 20.573 s | 47.840 s | 5.197 s | 5.974 s | 7.610 s | 698 ms |
| dev | Platinum | 29.103 s | 33.167 s | 2.427 s | 6.923 s | 12.385 s | 1.651 s |
| local | Daytona | 15.222 s | 17.795 s | 1.898 s | 3.978 s | 6.996 s | 820 ms |
| local | Platinum | 20.728 s | 21.770 s | 2.055 s | 2.873 s | 11.977 s | 1.602 s |

Raw files:

- `tests/performance/session-start/results/2026-07-29/production-starter.json`
- `tests/performance/session-start/results/2026-07-29/dev-starter.json`
- `tests/performance/session-start/results/2026-07-29/local-starter.json`
- `tests/performance/session-start/results/2026-07-29/session-boot-analysis.json`

## 5. Exact ACP image warm-up A/B

The image build ran ACP `initialize` and `session/new`.

Both providers booted `kortix-default-9f0b65e21921`.

| provider | ready | provider create | repository | first ACP output | ACP initialize | root session |
|---|---:|---:|---:|---:|---:|---:|
| Daytona | 35.997 s | 2.066 s | 5.593 s | 23.314 s | 299 ms | 1.202 s |
| Platinum | 41.310 s | 13.209 s | 10.749 s | 8.466 s | 631 ms | 3.210 s |

The runtime HOME is `/home/kortix` on both providers.

Both providers retained these image files:

```text
/home/kortix/.local/share/opencode/opencode.db
/home/kortix/.local/share/opencode/opencode.db-shm
/home/kortix/.local/share/opencode/opencode.db-wal
```

The main database size was 249,856 bytes on both providers.

The persisted database did not remove project configuration loading.

Daytona loaded the project `opencode.jsonc` at `00:31:23.184Z`. It completed
the configuration stage at `00:31:44.681Z`. This stage took 21.497 seconds.

Platinum loaded the project `opencode.jsonc` at `00:31:40.637Z`. It completed
the configuration stage at `00:31:46.961Z`. This stage took 6.324 seconds.

The image retained the database. OpenCode still evaluated the project
configuration and plugins for the new process and workspace.

Raw files:

- `tests/performance/session-start/results/2026-07-29/local-baked-acp-a-b.json`
- `tests/performance/session-start/results/2026-07-29/local-baked-acp-a-b-cache-inspection.json`

## 6. What `opencode.start()` measures

The historical `opencode-spawned` mark occurs after `opencode.start()` returns.

`opencode.start()` returns after ACP `initialize`.

The mark therefore includes:

1. Binary resolution.
2. Working-directory resolution.
3. Environment and auth materialization.
4. OpenCode configuration construction.
5. Child process creation.
6. OpenCode internal server startup.
7. OpenCode configuration and plugin loading.
8. The first ACP output.
9. ACP `initialize`.
10. Optional canonical session resume.

It does not measure only process creation.

The new timeline adds these marks:

```text
runtime-binary-resolved
runtime-cwd-resolved
runtime-config-ready
runtime-process-spawned
runtime-acp-first-output
runtime-acp-initialized
runtime-canonical-session-resumed
runtime-session-new-requested
runtime-session-resume-requested
```

## 7. OpenCode local isolation

OpenCode version: `1.18.7`.

The benchmark uses the Kortix starter OpenCode configuration.

| HOME state | process spawn p50 | first ACP output p50 | ACP initialize p50 | `session/new` p50 | total p50 |
|---|---:|---:|---:|---:|---:|
| fresh | 1.733 ms | 7.547 s | 7.659 s | 186 ms | 7.841 s |
| warmed by `opencode serve` | 1.014 ms | 471 ms | 556 ms | 166 ms | 722 ms |
| warmed by exact ACP lifecycle | 1.147 ms | 436 ms | 522 ms | 171 ms | 700 ms |
| persistent ACP-warmed HOME | 1.080 ms | 428 ms | 513 ms | 166 ms | 679 ms |

The cold delay occurs before the first ACP output.

Node child process creation is not the delay.

ACP JSON-RPC negotiation adds approximately 80–130 ms after first output.

The old `opencode serve` warm-up produces a locally warm HOME.

The image A/B proves that HOME persistence is insufficient. A running warmed
process avoids project configuration evaluation. A database-only snapshot does
not avoid it.

## 8. Pi comparison

Pi version: `0.81.1`.

| path | result |
|---|---:|
| Fresh `pi --mode rpc` to `get_state`, p50 | 439 ms |
| In-process module import, one time | 372 ms |
| In-process `createAgentSession()`, p50 | 2.865 ms |
| Third-party `pi-acp` initialize, p50 | 91 ms |
| Third-party `pi-acp` `session/new`, p50 | 1.549 s |
| Third-party `pi-acp` total, p50 | 1.635 s |

The third-party adapter starts a separate Pi process during `session/new`.

The target Pi design must keep Pi imported in the sandbox daemon.

The daemon must expose a Kortix-owned ACP adapter around in-process Pi sessions.

This design removes repeated module and process startup.

Pi does not remove repository materialization.

The registered Pi adapter is `pi-acp`.

The selected-harness refactor removes the OpenCode delay from Pi sessions.

It does not remove the `pi-acp` child process created during `session/new`.

## 9. Refresh without restart

The repository already exposes a no-restart workspace refresh:

```text
POST /kortix/refresh?base=1&base_sha=<sha>&restart=0
```

The refresh route can:

1. Update the repository base.
2. Preserve the running daemon.
3. Preserve the running harness process.
4. Avoid the cold ACP initialization.

OpenCode ACP does not expose the TUI worker's `SIGUSR2` reload path.

OpenCode loads project state by working directory and ACP session operations.

The safe OpenCode design keeps a stable workspace path. It atomically changes
the filesystem view under that path. It then creates or resumes the canonical
ACP session.

## 10. Target architecture

### 10.1 Commit artifact

Create one content-addressed project artifact per accepted commit:

```text
artifact key = project_id + commit_sha + runtime_image_fingerprint
```

The artifact contains:

1. An immutable repository lower layer.
2. Resolved project runtime configuration.
3. Installed project dependencies when the manifest requests them.
4. A verified runtime cache manifest.

Build the artifact asynchronously after each accepted commit.

Do not clone during session claim.

### 10.2 Running runtime slot

Maintain already-running slots for each provider, region, runtime image, and
harness.

Each slot contains:

1. The sandbox daemon.
2. An initialized ACP harness.
3. A pre-created blank canonical ACP session.
4. Session-independent LLM and executor proxy configuration.
5. A stable workspace mount point.

### 10.3 Session claim

The claim path performs only bounded local operations:

```text
reserve slot
  -> inject session tokens into local proxies
  -> attach commit artifact as immutable lower layer
  -> create writable session overlay
  -> create local session branch
  -> create or reset canonical ACP session
  -> return runtimeReady
```

Target budget:

| phase | p50 budget | p95 budget |
|---|---:|---:|
| Slot reservation | 25 ms | 75 ms |
| Token and environment adoption | 25 ms | 75 ms |
| Artifact and overlay attach | 75 ms | 200 ms |
| Branch creation and repository verification | 50 ms | 150 ms |
| ACP session reset or creation | 50 ms | 250 ms |
| API and network overhead | 75 ms | 200 ms |
| **Total** | **300 ms** | **950 ms** |

### 10.4 Miss behavior

The latest commit can miss the artifact cache.

The API must return one explicit state:

1. `ready`: exact commit artifact is attached.
2. `building`: exact commit artifact is being created.
3. `stale_available`: an older verified artifact is available.
4. `failed`: exact artifact creation failed.

The API must not silently attach an older commit.

### 10.5 Provider implementation

Daytona requires running sandbox slots.

Platinum can use running slots now.

Platinum process-memory restore remains disabled until it passes:

1. Network receive stress.
2. ACP SSE stress.
3. PTY stress.
4. Long-running prompt stress.
5. Repeated restore stress.

The previous stateful restore path kept `/kortix/health` available while ACP and
PTY traffic stalled. A health response alone is not restore proof.

## 11. Implemented first step

This branch changes the managed runtime path:

1. It skips legacy `opencode.start()`.
2. It skips OpenCode dependency preparation for non-OpenCode harnesses.
3. It injects managed skills only into the selected harness.
4. It initializes the selected ACP connection before `runtimeReady`.
5. It records process spawn, first ACP output, and ACP initialization.
6. It stops inherited warm-seed OpenCode when the adopted session selects a
   managed harness.

The legacy OpenCode path remains available when no managed ACP server exists.

## 12. Delivery sequence

1. Deploy the granular runtime marks and selected-harness refactor.
2. Benchmark selected Pi and selected OpenCode on local and dev.
3. Add the in-process Pi ACP adapter.
4. Run OpenCode and Pi feature-parity tests.
5. Enable already-running harness-specific slot claims.
6. Move repository materialization to commit artifacts and overlays.
7. Fail artifact publication when its repository or runtime manifest is absent.
8. Remove the OpenCode REST process rollback.
9. Remove the SDK REST compatibility client.

Steps 8 and 9 simplify the architecture. They are not the first latency levers.

## 13. Acceptance criteria

All criteria apply separately to Daytona and Platinum.

| path | requirement |
|---|---|
| Warm exact-commit claim | p50 below 500 ms and p95 below 1 s |
| Cold exact-commit miss | Every phase is attributed |
| Repository correctness | `HEAD` equals requested `base_sha` |
| Runtime correctness | ACP `initialize` and canonical session succeed |
| Event correctness | ACP SSE receives prompt, tool, and idle events |
| Terminal correctness | PTY input and output remain live |
| Restart correctness | Canonical session resumes without duplicate prompt |
| Security | No project or session token exists in the immutable artifact |

## 14. Current decision

Do not remove an ACP readiness wait.

Remove legacy `opencode.start()` from managed ACP sessions.

Keep the harness initialized before a user requests a session.

Use commit artifacts and writable overlays instead of repository clone.

Build Pi in-process behind the same ACP contract.

## 15. Post-deploy dev proof

Dev API commit `7935cd9360afbd8f182ba6ac1dd12d0b3fdb6d3e` contains the
selected-harness change.

The live API returned:

```text
status=ok
version=0.11.1-dev.7935cd93
environment=dev
```

The first Daytona Pi session missed the snapshot cache.

| phase | elapsed |
|---|---:|
| Row and tokens | 499 ms |
| Snapshot cache resolution | 341.853 s |
| Daytona create | 1.237 s |
| Host provision total | 343.589 s |
| Guest repository materialization | 5.418 s |
| Pi ACP initialization after repository | 132 ms |
| Guest ACP ready | 5.575 s |

The first chat request used `kortix/glm-5.2`.

It returned `503` after the API's 25-second processing deadline.

The second Daytona Pi session hit the snapshot cache.

| phase | elapsed |
|---|---:|
| Row and tokens | 658 ms |
| Snapshot cache resolution | 94 ms |
| Daytona create | 1.569 s |
| Host provision total | 2.320 s |
| Guest repository materialization | 15 ms |
| Pi ACP initialization after repository | 136 ms |
| Guest ACP ready | 183 ms |

The second chat lifecycle used `kortix/deepseek-v4-flash`.

It passed the initial response, follow-up, transcript reload, restart, and
post-restart response.

The live daemon reported:

```text
runtimeReady=true
runtime_harness=pi
opencode=down
opencode_pid=null
runtime-acp-initialized=183ms
```

The guest repository returned the same SHA for `HEAD` and remote `main`:

```text
8de781b942a3154dfd23ed7918ada8ae97f7c4a9
```

The raw record is
`tests/performance/session-start/results/2026-07-29/dev-pi-post-deploy.json`.

The result isolates three separate costs:

1. ACP is a protocol. It does not remove provider or repository latency.
2. Selected Pi removes the OpenCode process from the readiness path.
3. Exact artifact cache hits remove snapshot build and repository clone costs.
