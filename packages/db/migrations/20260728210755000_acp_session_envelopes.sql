set lock_timeout = '2s';
set statement_timeout = '30s';

CREATE TABLE IF NOT EXISTS "kortix"."acp_session_envelopes" (
  "ordinal" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "event_id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "session_id" text NOT NULL REFERENCES "kortix"."project_sessions"("session_id") ON DELETE CASCADE,
  "project_id" uuid NOT NULL REFERENCES "kortix"."projects"("project_id") ON DELETE CASCADE,
  "runtime_instance_id" text NOT NULL,
  "direction" varchar(32) NOT NULL CHECK ("direction" IN ('client_to_agent', 'agent_to_client')),
  "upstream_event_id" bigint,
  "envelope" jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_acp_session_envelopes_event_id"
  ON "kortix"."acp_session_envelopes" ("event_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_acp_session_envelopes_upstream_event"
  ON "kortix"."acp_session_envelopes" (
    "session_id",
    "direction",
    "runtime_instance_id",
    "upstream_event_id"
  )
  WHERE "upstream_event_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_acp_session_envelopes_session_ordinal"
  ON "kortix"."acp_session_envelopes" ("session_id", "ordinal");
