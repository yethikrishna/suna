SET lock_timeout = '1s';
SET statement_timeout = '5s';

CREATE TABLE kortix.executor_oauth_applications (
  application_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL,
  project_id uuid NOT NULL,
  connector_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  config_enc text NOT NULL,
  created_by uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT executor_oauth_applications_profile_tenant_fk
    FOREIGN KEY (account_id, project_id, connector_id, profile_id)
    REFERENCES kortix.executor_connection_profiles
      (account_id, project_id, connector_id, profile_id)
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_executor_oauth_applications_profile
  ON kortix.executor_oauth_applications (profile_id);
CREATE INDEX idx_executor_oauth_applications_project
  ON kortix.executor_oauth_applications (project_id);

CREATE TABLE kortix.executor_oauth_sessions (
  session_id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id uuid NOT NULL
    REFERENCES kortix.executor_oauth_applications (application_id) ON DELETE CASCADE,
  account_id uuid NOT NULL,
  project_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  initiated_by uuid NOT NULL,
  flow varchar(32) NOT NULL,
  status varchar(32) DEFAULT 'pending' NOT NULL,
  state_hash varchar(64),
  pkce_verifier_enc text,
  device_code_enc text,
  success_redirect_uri text,
  error_redirect_uri text,
  scopes text[],
  interval_seconds integer,
  next_poll_at timestamptz,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  error_code varchar(128),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT executor_oauth_sessions_flow_check
    CHECK (flow IN ('authorization_code', 'device_authorization')),
  CONSTRAINT executor_oauth_sessions_status_check
    CHECK (status IN ('pending', 'active', 'consumed', 'error', 'expired')),
  CONSTRAINT executor_oauth_sessions_material_check CHECK (
    (
      flow = 'authorization_code'
      AND state_hash IS NOT NULL
      AND pkce_verifier_enc IS NOT NULL
      AND device_code_enc IS NULL
    )
    OR
    (
      flow = 'device_authorization'
      AND state_hash IS NULL
      AND pkce_verifier_enc IS NULL
      AND device_code_enc IS NOT NULL
    )
  )
);

CREATE UNIQUE INDEX idx_executor_oauth_sessions_state_hash
  ON kortix.executor_oauth_sessions (state_hash)
  WHERE state_hash IS NOT NULL;
CREATE INDEX idx_executor_oauth_sessions_profile
  ON kortix.executor_oauth_sessions (profile_id);
CREATE INDEX idx_executor_oauth_sessions_expires
  ON kortix.executor_oauth_sessions (expires_at);
