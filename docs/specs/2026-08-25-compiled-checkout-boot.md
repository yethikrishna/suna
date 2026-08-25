# Compiled checkout boot experiment

## Objective

Remove `git clone` from sandbox cold boot without keeping idle sandboxes.

Git remains the source of truth. The API compiles an exact commit into one
compressed checkout artifact. The sandbox verifies the artifact before it
starts OpenCode.

## Rollout flag

Set `KORTIX_COMPILED_BOOT_MODE` in the API environment:

- `off`: Use the existing clone path. This is the default.
- `shadow`: Download and verify the artifact, then use the existing clone path.
- `prefer`: Use the artifact. Fall back to the existing clone path on failure.

The flag applies only to new full-repository sessions. Resumed sessions,
replacement sandboxes, and runtime-only sessions keep their existing behavior.

## Boot path

1. The API resolves the requested branch to an exact commit SHA.
2. The API creates or reads a content-addressed checkout artifact.
3. The sandbox downloads the artifact with its session token.
4. The sandbox verifies its SHA-256, manifest, project, ref, Git HEAD, and clean
   working tree.
5. The sandbox creates the local session branch and starts OpenCode.
6. The existing background history fetch continues after startup.

The artifact includes Git metadata. The sandbox sets `origin` to the Kortix Git
proxy. The sandbox does not receive an upstream Git credential.

## Local test

Add this machine-local setting to `apps/api/.env.local`:

```dotenv
KORTIX_COMPILED_BOOT_MODE=prefer
```

Restart the local stack and create a new session. The sandbox health response
must contain `compiled_boot_mode: "prefer"` and `compiled_checkout: true`.

Set the value to `off`, restart the stack, and create another new session to
measure the existing clone path.

## Measured result

The benchmark used one managed GitHub project and a ready Daytona base image.
Each sample created and then deleted a new sandbox.

| Mode                              | Repo materialization |
| --------------------------------- | -------------------: |
| Existing clone                    |             2,916 ms |
| Compiled checkout, cold API cache |             1,609 ms |
| Compiled checkout, warm API cache |               845 ms |

The warm artifact removes 2,071 ms, or 71%, from repository materialization.
OpenCode startup remains the largest measured boot stage at approximately
17-21 seconds.

## Current limits

- The API compiles the first artifact on demand.
- The artifact cache uses local ephemeral API storage.
- One compressed artifact cannot exceed 512 MiB.
- This experiment replaces repository cloning. It does not replace OpenCode.

The next compiler step is to build artifacts when Git state changes and store
them in shared object storage. That moves compilation outside the session boot
path and shares cache entries across API replicas.

## Standalone MJS runtime prototype

`experiments/compiled-boot-mjs` contains the next runtime prototype. It is not
connected to the Kortix session path.

The prototype builds one `server.mjs` artifact and serves it through a stable
reverse proxy. A runtime update builds and starts a candidate in parallel. The
supervisor verifies the candidate, atomically routes new requests to it, drains
requests assigned to the previous process, and then stops the previous process.
A build or health failure leaves the previous process and artifact active.
