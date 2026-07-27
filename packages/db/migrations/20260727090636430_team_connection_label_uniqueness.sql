-- Migration: team_connection_label_uniqueness
--
-- SAFETY HEADER (house rules -- see packages/db/MIGRATIONS.md#zero-downtime-rules).
set lock_timeout = '2s';
set statement_timeout = '30s';

-- A connector may hold several TEAM (project-owned) connections -- support@ and
-- sales@ on one `gmail` connector. Project rows carry owner_id NULL, so
-- idx_executor_connection_profiles_owner (partial on owner_id IS NOT NULL)
-- cannot dedupe them; this keeps the team set unique by label, mirroring how
-- label discriminates a member's own connections.
--
-- Purely additive:
--   [x] Existing data already satisfies it -- before this change a connector
--       could hold at most ONE project-owned row (created only by
--       ensureDefaultProfile, which short-circuits on the existing default).
--   [x] Index-only: no table rewrite, no backfill, no column added.

CREATE UNIQUE INDEX "idx_executor_connection_profiles_project_label" ON "kortix"."executor_connection_profiles" USING btree ("connector_id","label") WHERE "kortix"."executor_connection_profiles"."owner_id" is null;
