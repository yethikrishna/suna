# Compiled OpenCode boot experiment

## Objective

Remove compilation and `git clone` from sandbox cold boot without keeping idle
sandboxes.

Git remains the source of truth. The API compiles one exact commit into two
immutable artifacts:

- `checkout.tar.gz`: the project files and Git metadata.
- `server.mjs`: the verified OpenCode runtime launcher and compiled agent
  configuration.

The sandbox downloads and verifies both artifacts. `server.mjs` starts the
OpenCode-based Kortix daemon that is already present in the sandbox image.
This design does not use Pi and does not change the OpenCode API.

Secrets are not compiled into either artifact. The sandbox receives secrets as
runtime environment variables through the existing provider integration.

## Rollout flag

Set `KORTIX_COMPILED_BOOT_MODE` in the API environment:

- `off`: Use the existing clone path. This is the default.
- `shadow`: Download and verify both artifacts, then use the existing clone and
  baked-agent paths.
- `prefer`: Use both artifacts. Fall back to the existing paths on failure.
- `required`: Require both artifacts. Fail the sandbox boot if either artifact
  is unavailable or invalid.

The flag applies only to new full-repository sessions. Resumed sessions,
replacement sandboxes, and runtime-only sessions keep their existing behavior.

## Boot path

1. The API resolves the requested branch to an exact commit SHA.
2. The API starts both builds while the provider creates the sandbox.
3. The sandbox downloads both artifacts with its session token.
4. The sandbox verifies each SHA-256, format, project, ref, and source SHA.
5. The sandbox verifies Git HEAD and the clean working tree in the checkout.
6. The sandbox creates the local session branch.
7. The sandbox executes `server.mjs`.
8. `server.mjs` validates its runtime identity and launches the baked daemon.
9. The daemon starts OpenCode in the compiled checkout.
10. The existing background Git history fetch continues after startup.

The artifact includes Git metadata. The sandbox sets `origin` to the Kortix Git
proxy. The sandbox does not receive an upstream Git credential.

An accepted Git push also prebuilds both default-branch artifacts. This work is
asynchronous and does not delay the Git response. The session route still
builds on demand when the requested ref has not been prebuilt.

## Local test

Add this machine-local setting to `apps/api/.env.local`:

```dotenv
KORTIX_COMPILED_BOOT_MODE=prefer
```

Restart the local stack and create a new session. The sandbox health response
must contain:

```json
{
  "compiled_boot_mode": "prefer",
  "compiled_checkout": true,
  "compiled_runtime": true,
  "compiled_runtime_format": "kortix.compiled-runtime.v1"
}
```

Set the value to `off`, restart the stack, and create another new session to
measure the existing clone path.

## Measured result

The checkout benchmark used one managed GitHub project and a ready Daytona base image.
Each sample created and then deleted a new sandbox.

| Mode                              | Repo materialization |
| --------------------------------- | -------------------: |
| Existing clone                    |             2,916 ms |
| Compiled checkout, cold API cache |             1,609 ms |
| Compiled checkout, warm API cache |               845 ms |

The warm checkout removes 2,071 ms, or 71%, from repository materialization.
A later local Daytona sample measured OpenCode spawn-to-ready at 5.96 seconds.
The compiled launcher preserves that process and therefore does not remove this
time.

## Current limits

- The API prebuilds on a managed Git push and overlaps on-demand builds with
  provider provisioning.
- The artifact cache uses local ephemeral API storage. Another API replica can
  rebuild the same content-addressed artifact.
- One compressed checkout cannot exceed 512 MiB.
- One compiled runtime cannot exceed 16 MiB.
- `server.mjs` compiles configuration and launch behavior. It does not package
  the OpenCode executable.
- OpenCode process initialization remains on the critical path.

The next compiler step is shared object storage. It will let every API replica
serve the artifact produced by the Git push. The next latency target after that
is OpenCode process initialization.

## Standalone MJS runtime prototype

`experiments/compiled-boot-mjs` contains an isolated runtime-update prototype.
The production session path now uses a separate compiled `server.mjs` launcher.

The prototype serves `server.mjs` through a stable reverse proxy. A runtime
update builds and starts a candidate in parallel. The supervisor verifies the
candidate, atomically routes new requests to it, drains requests assigned to the
previous process, and then stops the previous process. A build or health failure
leaves the previous process and artifact active. Candidate promotion is not yet
connected to the production session proxy.
