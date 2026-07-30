-- Migration: connector_authorization_strategy_and_session_scope
--
-- SAFETY HEADER (house rules -- see packages/db/MIGRATIONS.md#zero-downtime-rules).
set lock_timeout = '2s';
set statement_timeout = '30s';

-- Pure expand step:
--   [x] The enum type is new. No existing enum value changes.
--   [x] Both columns have constant defaults and do not rewrite existing rows.
--   [x] Existing API versions ignore both new columns.
--   [x] New API versions read existing rows as project authorization with
--       inherited connector bindings.
--   [x] No index, constraint validation, drop, rename, or backfill is required.

CREATE TYPE "kortix"."executor_connector_authorization_strategy" AS ENUM('project', 'user');--> statement-breakpoint
ALTER TABLE "kortix"."executor_connectors" ADD COLUMN "authorization_strategy" "kortix"."executor_connector_authorization_strategy" DEFAULT 'project' NOT NULL;--> statement-breakpoint
ALTER TABLE "kortix"."project_sessions" ADD COLUMN "connector_bindings_configured" boolean DEFAULT false NOT NULL;
