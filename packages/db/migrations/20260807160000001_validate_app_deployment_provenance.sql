set lock_timeout = '2s';
set statement_timeout = '30s';

ALTER TABLE "kortix"."app_deployments"
  VALIDATE CONSTRAINT "app_deployments_source_session_fk";
ALTER TABLE "kortix"."app_deployments"
  VALIDATE CONSTRAINT "app_deployments_actor_type_check";
