# Fast cold boot runtime

Status: experimental on dev. Staging and production remain disabled.

## Problem

A clean dev session reaches runtime readiness in 25.3 seconds at p50.
The current image contains browsers, LibreOffice, TeX, and the complete Python package floor.
Every sandbox pays the image startup cost even when the first turn does not use those tools.

Measured dev baseline on 2026-08-19, using five new default-template sessions:

| Milestone | p50 | p90 |
|---|---:|---:|
| Runtime ready | 25,288 ms | 32,607 ms |
| Sandbox row active | 19,288 ms | — |
| Daemon reachable | 21,756 ms | — |
| Repository materialized | 7,489 ms | 8,007 ms |
| OpenCode answering | 5,308 ms | 6,908 ms |

## Design

`KORTIX_FAST_COLD_BOOT_ENABLED=true` selects one shared, content-addressed fast image.
It does not create or retain running sandboxes.
The standard image remains available through the same flag.

The fast image contains the complete session-critical path:

- Ubuntu 24.04, matching the standard runtime's faster OpenCode startup path
- Git and the baked scaffold repository
- Node.js, npm, pnpm, Bun, uv, OpenCode, the Kortix daemon, and the Kortix CLI
- OpenCode configuration dependencies, tool bundle cache, database migration, and instance warm-up
- The model catalog, managed skills, and Slack or Teams CLI shims

Large tools install once per sandbox on first use:

- `python` or `python3`: the pinned managed Python runtime
- `make`, `gcc`, `g++`, `cc`, `c++`, or `pkg-config`: development pack
- `agent-browser` or `chromium`: browser pack
- Anydoc, document, PDF, OCR, media, and TeX commands: document pack

`kortix-toolpack development|browser|documents|all` installs a pack explicitly.
An inter-process lock prevents two first-use commands from running `apt` concurrently.

Custom and meta templates do not change under the flag.
Platinum cannot reuse the standard template ID for a fast-image session.

## Rollout and rollback

Dev enables the flag in `infra/terraform/environments/dev/variables.tf`.
Staging, production, and self-hosted installations default to `false`.

Set `KORTIX_FAST_COLD_BOOT_ENABLED=false` and redeploy to restore the standard image.
Rollback does not require a database migration or sandbox cleanup.
Existing sessions continue on the image that created them.

## Acceptance gates

The experiment can advance beyond dev only when all gates pass:

1. Five clean dev boots complete without a provider or runtime failure.
2. Runtime-ready p50 and p90 improve against the baseline above.
3. A first prompt completes through OpenCode.
4. Git, Kortix CLI, Python, development, browser, and document paths pass smoke tests.
5. The fast image remains smaller than the standard runtime image.

Disable the flag if runtime-ready p90 exceeds 32,607 ms or a lazy tool path fails.
