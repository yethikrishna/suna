-- Bounded sandbox lifetime: one deadline column, one immutable anchor, one cap.
--
-- WHY: measured live on prod 2026-07-29, 187 genuinely running boxes, 156 of
-- which had never emitted a single LLM usage_event, the oldest 264 hours old.
-- Every mechanism that judged a running box read a timestamp the SANDBOX ITSELF
-- wrote, so a wedged box renewed its own reprieve forever. The replacement is
-- the control plane recording, in its own row, when the box should die.
--
-- THE INVARIANT: a sandbox-reported signal may only SHORTEN a box's life. Only
-- a control-plane-OBSERVED event may EXTEND it, and only up to a bounded
-- ceiling. `deadline_at` is written by exactly one TS module
-- (apps/api/src/projects/sandbox-deadline.ts); `active_since` is written by NO
-- TypeScript at all — the trigger below owns it, because a CHECK on a
-- difference whose left operand a caller can slide forward is a suggestion,
-- not a bound.

set lock_timeout = '2s';
set statement_timeout = '30s';

-- MIXED-VERSION BEHAVIOUR, stated honestly. Both columns are NOT NULL WITH
-- DEFAULT and the currently deployed API references NEITHER, so no old-pod
-- statement fails to compile or breaks on a missing value. But it is NOT true
-- that old pods are unaffected: the TRIGGER below fires on every INSERT and
-- UPDATE of this table, including theirs, and it CHANGES what their writes
-- produce. Specifically, for a pod that has never heard of these columns:
--   * every INSERT is anchored at now() and floored to a 20-minute deadline;
--   * every UPDATE has active_since carried forward from OLD, so their
--     whole-object ORM writes cannot move the anchor (silently, not by raising —
--     a hot path must not 500 for re-sending a column it always re-sent);
--   * a park -> active flip they perform (the proxy heal, an in-place restart)
--     re-anchors the stretch and FLOORS the deadline at 20 minutes, so their
--     boxes acquire a bounded lifetime they never asked for and the new reaper
--     will stop them when it passes.
-- That is the intended, safe direction: an old pod's box gets a deadline instead
-- of immortality, and it can never be given LESS life than the floor. The
-- trigger raises no exceptions on any path (every value it derives is clamped
-- under the CHECK before it returns), so it cannot turn an old-pod write into an
-- error. Nothing is dropped or narrowed, so a rollback to the previous API is
-- safe with the columns still in place (and they must NEVER be rolled back —
-- dropping a NOT NULL column while any instance still writes it turns a bad
-- deploy into an outage).

-- (1) The two columns. A bare now() default is STABLE, so PG11+ stores it as a
-- catalog missing-value: metadata-only, no table rewrite, no long
-- ACCESS EXCLUSIVE hold. (A composite default like now() + interval '20
-- minutes' would be rejected by squawk and is unnecessary — the boot floor
-- belongs in the trigger, which also repairs a stale value and covers the
-- provisioning -> active transition.)
ALTER TABLE "kortix"."session_sandboxes"
  ADD COLUMN "active_since" timestamptz DEFAULT now() NOT NULL,
  ADD COLUMN "deadline_at"  timestamptz DEFAULT now() NOT NULL;

-- (2) Backfill: 30 minutes of amnesty for everything currently live. Long
-- enough that a genuinely working box takes a real turn and extends itself,
-- short enough that the zombie backlog is gone half an hour after deploy. Rows
-- already stopped/archived keep the bare default and are never kill candidates,
-- so their value is inert.
UPDATE "kortix"."session_sandboxes"
   SET "deadline_at" = now() + interval '30 minutes'
 WHERE "status" IN ('active', 'provisioning');

-- (3) THE load-bearing object: active_since is assigned here and NOWHERE else,
-- and a new stretch may only be anchored by a PARK the trigger itself witnessed.
--
-- Three properties this has to deliver, each of which was missing in the first
-- cut of this function:
--
--  I1  THE ANCHOR IS NEVER MOVABLE BY APPLICATION CODE, IN ANY STATE. The first
--      version pinned it only while OLD.status = 'active', so a plain Drizzle
--      UPDATE that landed the row on any other status moved the cap's left
--      operand freely — and a CHECK whose left operand a caller can slide is a
--      suggestion. It is now carried forward unconditionally, and the ONLY
--      assignment other than that is the witnessed re-anchor in I2.
--
--  I2  A NEW STRETCH REQUIRES A WITNESSED PARK. The first version re-anchored on
--      ANY non-active -> active transition, so the 24h cap was resettable an
--      unbounded number of times by flipping status out and back — including via
--      `provisioning`, which application code writes routinely (identity
--      recovery, in-place restart) with no provider stop anywhere in sight. Now
--      the trigger stamps `metadata.stretchParkedAt` when, and only when, it
--      sees an ACTIVE row being parked (stopped/error/archived, or provisioning
--      with the external box released), and it STRIPS that key on every other
--      write so application code cannot pre-seed it. A re-anchor happens only if
--      that witness is present, and consumes it. What remains, stated plainly:
--      a reset still requires writing a park status FROM an active row, which in
--      this codebase happens only in reaping/sandbox-state-sync.ts
--      applyStoppedState — after a provider stop, and closing the compute window
--      as it goes. Requiring more than that would mean asking the provider from
--      inside a trigger. What is closed is every OTHER transition.
--
--  I3  A STATUS FLIP NEVER DISCARDS A LIVE GRANT. The first version replaced the
--      deadline with the 20-minute boot floor on any flip that did not itself
--      write deadline_at — including markSandboxUsed's own heal path, whose WHERE
--      clause requires `deadline_at > now()`, i.e. it fired precisely when there
--      WAS a live grant to throw away. A box mid-turn with 3h50m left came back
--      from a transient blip with 20 minutes. The floor is now a floor: GREATEST.
CREATE OR REPLACE FUNCTION "kortix"."session_sandboxes_anchor_guard"()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  -- True when the trigger (not the caller) raised deadline_at, and must
  -- therefore clamp its own arithmetic under the CHECK. A value the CALLER
  -- stated is left exactly as written, so the CHECK stays reachable for the
  -- future-writer bug it exists to surface.
  derived boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.active_since := now();
    -- Boot floor for EVERY insert regardless of status: a row is normally born
    -- `provisioning` and flipped to `active` when the provider returns, so a
    -- floor applied only to active inserts would leave every in-flight
    -- provision expired from birth. `<= active_since` (not IS NULL) is an exact
    -- test for "no meaningful deadline was supplied", because the column is NOT
    -- NULL with a default and no legitimate writer states a deadline at or
    -- before the anchor.
    IF NEW.deadline_at <= NEW.active_since THEN
      NEW.deadline_at := now() + interval '20 minutes';
    END IF;
    -- A fresh row has no park to remember, and an INSERT must not be able to
    -- carry in a forged witness that buys a free re-anchor on its first flip.
    NEW.metadata := coalesce(NEW.metadata, '{}'::jsonb) - 'stretchParkedAt';
    RETURN NEW;
  END IF;

  -- I1, unconditional.
  NEW.active_since := OLD.active_since;

  IF OLD.status = 'active'
     AND (NEW.status IN ('stopped', 'error', 'archived')
          OR (NEW.status = 'provisioning' AND NEW.external_id IS NULL)) THEN
    -- A PARK, witnessed while the row still claimed to be running. This is the
    -- only way the witness is ever created.
    NEW.metadata := coalesce(NEW.metadata, '{}'::jsonb)
                    || jsonb_build_object('stretchParkedAt', to_jsonb(now()));

  ELSIF NOT (OLD.status <> 'active' AND NEW.status = 'active') THEN
    -- Any write that is neither a park nor the re-anchor below cannot leave a
    -- witness behind — that is what makes the witness unforgeable by callers.
    NEW.metadata := coalesce(NEW.metadata, '{}'::jsonb) - 'stretchParkedAt';
  END IF;

  IF OLD.status <> 'active' AND NEW.status = 'active' THEN
    IF OLD.metadata ? 'stretchParkedAt' THEN
      -- I2: a witnessed park is being resumed → a genuinely new stretch.
      NEW.active_since := now();
      NEW.metadata := coalesce(NEW.metadata, '{}'::jsonb) - 'stretchParkedAt';
    END IF;
    -- I3: floor, never discard. `IS NOT DISTINCT FROM OLD` is the exact test for
    -- "this writer did not state a deadline" (an ORM whole-object UPDATE
    -- re-sends the same value it read).
    IF NEW.deadline_at IS NOT DISTINCT FROM OLD.deadline_at THEN
      NEW.deadline_at := GREATEST(OLD.deadline_at, now() + interval '20 minutes');
      derived := true;
    ELSIF NEW.deadline_at <= now() THEN
      NEW.deadline_at := now() + interval '20 minutes';
      derived := true;
    END IF;
  END IF;

  IF derived THEN
    -- Only ever clamps the trigger's OWN floor, and only when carrying a live
    -- grant across a flip late in a stretch would otherwise breach the CHECK.
    -- Without this, a heal 23h50m into a stretch would raise 23514 and 500 a
    -- path whose whole job is to recover a box.
    NEW.deadline_at := LEAST(NEW.deadline_at, NEW.active_since + interval '24 hours');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "trg_session_sandboxes_anchor_guard" ON "kortix"."session_sandboxes";
CREATE TRIGGER "trg_session_sandboxes_anchor_guard"
BEFORE INSERT OR UPDATE ON "kortix"."session_sandboxes"
FOR EACH ROW EXECUTE FUNCTION "kortix"."session_sandboxes_anchor_guard"();

-- (4) The ceiling. NOT VALID so this migration takes no long ACCESS EXCLUSIVE
-- scan; it is enforced on every new write immediately, which is what matters.
-- (Validated CONCURRENTLY-style in the companion .concurrent.ts migration.)
-- The trigger clamps ONLY the floor it derives itself (see `derived`), never a
-- value a caller stated, so this CHECK stays reachable for exactly the class of
-- future bug it exists to surface: a new writer that computes a deadline past
-- the cap.
ALTER TABLE "kortix"."session_sandboxes"
  ADD CONSTRAINT "session_sandboxes_deadline_within_cap"
  CHECK ("deadline_at" <= "active_since" + interval '24 hours') NOT VALID;

COMMENT ON COLUMN "kortix"."session_sandboxes"."active_since" IS
  'Start of this box''s current continuous running stretch. Anchor operand of the 24h cap. Assigned ONLY by kortix.session_sandboxes_anchor_guard(); never movable by application code in any state, and re-anchored only on resume of a park the trigger itself witnessed.';
COMMENT ON COLUMN "kortix"."session_sandboxes"."deadline_at" IS
  'When the control plane stops this box. Single TS writer: apps/api/src/projects/sandbox-deadline.ts. Bounded by deadline_at <= active_since + 24h.';
