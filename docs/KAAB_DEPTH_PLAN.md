# Kortix-as-a-Backend — depth plan

Written 2026-07-27, after a 7-lens adversarial audit (63 agents, 45 findings that
survived refutation) and a day of shipping against it. Ordered by
(real user impact × confidence) ÷ effort. Every item cites evidence; anything I
could not verify is marked as such rather than asserted.

## Phase 0 — the thing that makes every other number untrustworthy

**The `apps/api` suite does not run in CI.** `DOTENV_PRIVATE_KEY` is unset, so
~1757 tests are green-but-vacuous. Three separate files were found broken *on
main* in a single day:

| File | State on main |
| --- | --- |
| `unit-preview-auth-principal.test.ts` | 0 ran (fixed → 24, #5583) |
| `e2e-preview-proxy.test.ts` | 0 ran (fixed → 52 pass / 4 fail, #5583) |
| `e2e-project-session-contract.test.ts` | 18 pass / **26 fail** — still broken |

Two of those cover the sandbox-proxy auth surface, which is exactly where the
session-isolation fix lives. **Do this first**: every confidence claim below is
weaker until the suite actually runs.

- Get the decryption key into CI, or make the suite runnable without it.
- Fix `e2e-project-session-contract` (26 failures, uninvestigated).
- Decide the 4 `e2e-preview-proxy` failures: they assert a rejected env sync
  returns 502; current behaviour returns 200. Tests or product — someone who owns
  that behaviour must choose. Do not force either to green.
- Add a lint that fails a `mock.module` factory omitting exports the graph needs.
  That single class of bug silently zeroed two files.

## Phase 1 — correctness holes the audit confirmed

1. **`created_by` is still the isolation boundary for backend rows.** #5577
   stopped a sandbox token reaching a sibling session, but the underlying model —
   every KaaB session sharing one creator — remains. Until `origin='backend'`
   rows stop deriving ownership from `created_by`, each new read path is a fresh
   chance to leak. *No e2e proof exists yet that the current fix holds.*
2. **A create whose failure was already returned gets re-queued**
   (`engine.ts:275` passes `retryable` on the synchronous path; `store.ts:232`
   flips it to `queued`). The wrapper is told "try again", retries with a fresh
   key, and the original silently creates a second billed sandbox 2–20s later —
   same `end_user_ref`, both running the baked prompt. Fix: `retryable: false`
   on the inline path.
3. **Three connector-alias forms across three gates** (`db-deps.ts:845`,
   `router.ts:380`, `sessions.ts:880`). A manifest grant of `kortix_email` makes
   the connector invisible in the catalog; a grant of `email` makes it visible
   and then 403s on call. Canonicalize once at grant construction. Folds in the
   duplicate-alias raw-Postgres 500.
4. **`403 CONNECTOR_NOT_ASSIGNED` is undocumented** — and it is the first error
   the public docs' own flagship example hits on any project declaring agents.

## Phase 2 — finish the demo (it is the spec people copy)

Done: `end_user_ref` stamping, charge-by-end-user.

Remaining, in order of what teaches the most:

1. **`409 CONNECTOR_CONNECTION_REQUIRED`.** The one genuinely novel KaaB UX —
   the session refuses to start until *this end-user* connects their own account.
   Nothing in the demo models it; without it, wrapper authors will not know the
   flow exists.
2. **Connector-binding picker** — choose which connection a session runs as,
   using the per-row `profile_id`.
3. **Model switcher** wired to `PUT /sessions/{id}/model`, showing the
   `applied_live` distinction honestly rather than pretending it is instant.
4. **Secrets allowlist** — narrow a session to a subset, and show that the
   allowlist is *immutable* for that session's life.
5. **Idempotency** — demonstrate that replaying a key under a different
   end-user is refused, which is the safety property wrapper authors most often
   get wrong.
6. **Per-end-user concurrency cap** — currently `KORTIX_BACKEND_PER_ORIGIN_SESSION_LIMIT`
   defaults to 0 (off) and is set in no chart, so it is dark everywhere.

## Phase 3 — prove it, don't assert it

The two security fixes shipped today are covered by unit tests of their decision
functions and wiring — not by end-to-end proof:

- A token minted for session A must 404 on session B's transcript.
- Two connections under one connector must resolve to *different* policies
  through the gateway.
- A revoked secret must be absent from a child process spawned after revocation.

Each is a single integration test. Each currently rests on reasoning.

## Naming and docs debt

- `origin_ref` → `end_user_ref` is done at the wire, with the alias permanent.
  The DB column, the ops env var, and the error codes deliberately keep the old
  name; that is a defensible boundary but it should be written down where the
  next person looks.
- The public page claimed per-end-user metering did not exist for 108 minutes
  after it shipped, and nobody noticed until an audit read it. Docs drift on the
  only customer-facing KaaB page deserves a check, not vigilance.
