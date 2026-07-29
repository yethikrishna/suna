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

-- mixed-version-safe: both columns are NOT NULL WITH DEFAULT and the currently
-- deployed API references neither, so old pods keep inserting/updating
-- session_sandboxes exactly as before; the trigger supplies every value they
-- omit. Nothing is dropped or narrowed, so a rollback to the previous API is
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

-- (3) THE load-bearing object: active_since is assigned here and NOWHERE else.
CREATE OR REPLACE FUNCTION "kortix"."session_sandboxes_anchor_guard"()
RETURNS trigger LANGUAGE plpgsql AS $$
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
    RETURN NEW;
  END IF;

  IF OLD.status = 'active' AND NEW.status = 'active' THEN
    -- I1: IMMUTABLE within a running stretch. Carried forward silently rather
    -- than raised: an ORM whole-object UPDATE that re-sends the column is not a
    -- bug and must not 500 a hot path. What matters is that it cannot MOVE.
    NEW.active_since := OLD.active_since;

  ELSIF OLD.status <> 'active' AND NEW.status = 'active' THEN
    -- I2: every non-active -> active transition is anchored, so the proxy heal,
    -- an in-place restart and runtime recovery cannot produce an unanchored
    -- active row, nor inherit the stale deadline the box carried while parked
    -- (which presents to a user as "Start does nothing").
    NEW.active_since := now();
    IF NEW.deadline_at IS NOT DISTINCT FROM OLD.deadline_at OR NEW.deadline_at <= now() THEN
      NEW.deadline_at := now() + interval '20 minutes';
    END IF;
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
-- Deliberately NO silent clamp inside the trigger: clamping would make this
-- CHECK unreachable and hide the exact class of future bug it exists to surface.
ALTER TABLE "kortix"."session_sandboxes"
  ADD CONSTRAINT "session_sandboxes_deadline_within_cap"
  CHECK ("deadline_at" <= "active_since" + interval '24 hours') NOT VALID;

COMMENT ON COLUMN "kortix"."session_sandboxes"."active_since" IS
  'Start of this box''s current continuous running stretch. Anchor operand of the 24h cap. Assigned ONLY by kortix.session_sandboxes_anchor_guard(); immutable while status = ''active''.';
COMMENT ON COLUMN "kortix"."session_sandboxes"."deadline_at" IS
  'When the control plane stops this box. Single TS writer: apps/api/src/projects/sandbox-deadline.ts. Bounded by deadline_at <= active_since + 24h.';
