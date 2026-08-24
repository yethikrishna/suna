-- Up Migration
--
-- Fresh databases get `composio` from the schema baseline after this change.
-- Faked-baseline environments need this forward-only enum backfill before
-- `syncProjectConnectors` can materialize provider_type='composio'.

ALTER TYPE kortix.connector_provider ADD VALUE IF NOT EXISTS 'composio' AFTER 'pipedream';

CREATE INDEX IF NOT EXISTS idx_connector_connections_composio_account
  ON kortix.connector_connections ((metadata->>'connected_account_id'))
  WHERE metadata->>'provider' = 'composio';

-- Down Migration
-- PostgreSQL enum values are intentionally forward-only here. Removing
-- `composio` would break persisted Composio connector rows.
