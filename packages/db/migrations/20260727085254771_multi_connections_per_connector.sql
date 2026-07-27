-- Migration: multi_connections_per_connector
--
-- SAFETY HEADER (house rules -- see packages/db/MIGRATIONS.md#zero-downtime-rules).
set lock_timeout = '2s';
set statement_timeout = '30s';

-- Let ONE connector hold MANY connections: several shared team accounts
-- (support@ + sales@) AND several per-member personal ones ("Work", "Personal").
-- Two partial unique indexes previously capped it at one connection per owner
-- and one default per connector.
--
--   1. `_owner` gains `label` as the discriminator, so one owner may hold
--      several connections while reconcile stays idempotent (the same label
--      updates in place; a new label adds a connection).
--   2. `_default` is replaced by a PER-OWNER pair: exactly one team default
--      (`_default_project`) and at most one default per member/agent/external
--      owner (`_default_owner`). Split in two because project rows have
--      owner_id NULL, where SQL NULLs compare distinct and a single composite
--      index would not cap them.
--
-- Purely widening for existing data:
--   [x] Every current row already satisfies the new indexes -- the old
--       (connector_id, owner_type, owner_id) uniqueness implies uniqueness with
--       `label` appended, and the old one-default-per-connector implies at most
--       one default in either new partial index.
--   [x] Index-only change: no table rewrite, no backfill, no column added.
--   [x] Callers that read "the default" now filter owner_type = 'project'
--       (apps/api executor/credentials.ts, projects/lib/session-connector-bindings.ts)
--       so an unbound session can never resolve a member's personal connection.

DROP INDEX "kortix"."idx_executor_connection_profiles_default";--> statement-breakpoint
DROP INDEX "kortix"."idx_executor_connection_profiles_owner";--> statement-breakpoint
CREATE UNIQUE INDEX "idx_executor_connection_profiles_default_project" ON "kortix"."executor_connection_profiles" USING btree ("connector_id") WHERE "kortix"."executor_connection_profiles"."is_default" = true and "kortix"."executor_connection_profiles"."owner_type" = 'project';--> statement-breakpoint
CREATE UNIQUE INDEX "idx_executor_connection_profiles_default_owner" ON "kortix"."executor_connection_profiles" USING btree ("connector_id","owner_type","owner_id") WHERE "kortix"."executor_connection_profiles"."is_default" = true and "kortix"."executor_connection_profiles"."owner_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_executor_connection_profiles_owner" ON "kortix"."executor_connection_profiles" USING btree ("connector_id","owner_type","owner_id","label") WHERE "kortix"."executor_connection_profiles"."owner_id" is not null;
