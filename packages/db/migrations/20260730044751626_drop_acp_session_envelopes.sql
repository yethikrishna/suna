-- Migration: drop_acp_session_envelopes
--
-- Remove the ACP JSON-RPC envelope audit table after the ACP routes, runtime,
-- SDK client, and sandbox adapter code have been removed.
--
-- mixed-version-safe: old API pods use this table only while handling ACP
-- traffic. Main no longer advertises or accepts ACP sessions. Requests that
-- reach an old pod during rollout can fail without affecting OpenCode REST
-- sessions, which never read or write this table.

set lock_timeout = '2s';
set statement_timeout = '30s';

-- squawk-ignore ban-drop-table
DROP TABLE IF EXISTS "kortix"."acp_session_envelopes" CASCADE;

-- Down Migration
-- Forward-only: ACP runtime storage is intentionally not recreated.
