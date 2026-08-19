# Deploy to dev — the explicit Deploy Dev action

**Dev deploys are EXPLICIT.** Merging to `main` does NOT deploy to dev. You
trigger the deploy yourself, on demand. This is a GitHub Actions
`workflow_dispatch` on `.github/workflows/deploy-dev.yml` — the "Deploy Dev"
workflow.

## Why it is explicit, not per-push

`main` is a high-traffic trunk. Auto-deploying every push meant deploys queued
and cancelled all day (the concurrency group serialises, and the slow surface
loses), dev lagged 30–60 min behind, and nobody could tell which SHA was live.
An explicit deploy collapses a burst of merges into ONE intentional deploy of
`main` HEAD, when you decide dev should move.

`staging` and `prod` are unaffected — they were always promote-gated, never
per-push (see the `kortix-release` skill).

## How to deploy

Three equivalent ways. All deploy `main` HEAD.

1. **GitHub UI** — Actions tab → **Deploy Dev** → **Run workflow** → pick a
   `surface` → **Run workflow**.
2. **CLI** — `gh workflow run deploy-dev.yml -f surface=changed`
3. **From an agent session** — the same `gh workflow run` call.

### The `surface` input

| value | what it builds + deploys | when |
| --- | --- | --- |
| `changed` (default) | only the surfaces STALE vs the SHA dev is currently running | the normal case — fast, skips unchanged surfaces |
| `all` | force-rebuild + redeploy every surface (API, gateway, frontend, CLI, terraform) | recovery, or when you want a guaranteed full refresh |
| `frontend` | the frontend only | a frontend-only change, or to re-ship a stale frontend |

`changed` reads dev's live SHA from `dev-api.kortix.com/v1/health` and diffs
against it, so a surface changed by any commit since the last dev deploy
rebuilds — regardless of how the pushes were grouped. If that SHA cannot be
resolved (health down, force-push, first deploy), it FAILS SAFE and builds every
surface.

## Safety net

A `schedule` fires once a day at 06:00 UTC and runs the `changed` path, so dev
cannot silently rot if nobody dispatched. It is a floor, not a substitute for
the explicit deploy.

## Verify a deploy landed

A green run is not proof by itself. Confirm the deployed artifact carries the
SHA you deployed:

- **API:** `curl -s https://dev-api.kortix.com/v1/health` → `.commit` is your
  merge SHA (or has it as an ancestor).
- **Frontend:** `curl -s https://dev.kortix.com/api/health` → `.commit` likewise.
- Then exercise the actual user-visible behavior against the deployed surface
  (see CLAUDE.md "Default delivery" step 5).

## Common traps

- **Stale browser tab mimics a stale deploy.** `dev.kortix.com` is a single-page
  app; an open tab keeps running the JS bundle it loaded before the deploy. If
  the UI looks old but `/api/health` reports the new commit, hard-reload
  (Cmd/Ctrl+Shift+R). The deploy is fine.
- **Concurrency queues, never cancels.** `cancel-in-progress: false` is
  deliberate (flipping it to `true` caused a 3.5h dev outage on 2026-08-10 — see
  the `learnings` skill). A dispatch while another deploy runs QUEUES behind it;
  the newest pending wins. Do not spam dispatches — one is enough.

## Build speed

Dev builds are single-arch amd64 (dev Fargate is x86_64), with registry layer
cache. The API image builds in ~4–7 min (was ~22 min when it emulated arm64 that
dev never runs). `deploy-prod.yml` keeps multi-arch — that is prod's concern, not
dev's.

## Related

- `.github/workflows/deploy-dev.yml` — the workflow itself.
- `kortix-release` skill — how prod releases work (promote, not dispatch).
- `learnings` skill — the concurrency and frontend-skip incidents behind this design.
