# Production Supabase migration to `us-west-2`

## Status

- Source project: `jbriwassebxdwoieikga` in `eu-west-2`.
- Target project: `iaepefxnmhjqhilaxevk` in `us-west-2`.
- Target status: `ACTIVE_HEALTHY`.
- Target PostgreSQL version: `17.6`.
- Target compute: XL with 4 dedicated vCPU and 16 GB RAM.
- Target disk: 500 GB gp3 with 3,000 IOPS and 125 MiB/s throughput.
- Target PITR: 7 days.
- Target dedicated IPv4: enabled.
- Target credentials: AWS Secrets Manager secret `kortix/prod-us-west-2-migration`.
- Fresh-project bootstrap: applied.
- Repository migration ledger: 75 migrations applied through
  `20260725003708138_align_nullable_schema_contract`.
- `pg_cron`: enabled at version 1.6.4 with zero scheduled jobs.
- Production data copied: none.
- Production traffic still uses the source project.

Do not print or copy secret values into this document, shell output, or Git.

## Verified source inventory

| Item | Value |
|---|---:|
| PostgreSQL version | 15.8 |
| Provisioned disk | 378 GB |
| Database data | approximately 286 GB |
| Storage objects | 452,290 |
| Storage data | approximately 138 GB |
| Auth users | 405,859 |
| MFA factors | 8,606 |
| `public` schema | 250 GB |
| `kortix` schema | 29 GB |
| `auth` schema | 11 GB |
| `cron` schema | 33 GB |
| `net` schema | 2.7 GB |

The source has `wal_level=logical`. It has 24 replication slots and 24 WAL
senders. The measured WAL rate is approximately 0.39 MB/s. The current
`max_slot_wal_keep_size` is 3 GB.

Increase and monitor WAL retention before creating a long-lived replication
slot.

## Migration scope

### Verified live `public` dependencies

The source `pg_stat_statements` counters were reset on 2026-06-24.
The counters prove that the application still reads these legacy Suna tables:

| Relation | Calls since reset |
|---|---:|
| `public.projects` | 6,206 |
| `public.resources` | 149 |
| `public.threads` | 1,086 |
| `public.messages` | 1,076 |

The same counters distinguish the retired and current credit tables:

| Relation | Calls since reset |
|---|---:|
| `public.credit_accounts` | 0 |
| `public.credit_ledger` | 1 |
| `kortix.credit_accounts` | 4,475,763 |
| `kortix.credit_ledger` | 311,776 |

The application also called the public credit RPC functions at least 295,678
times since the reset. These functions operate on `kortix.credit_accounts` and
`kortix.credit_ledger`.

The current control-table row counts are:

| Relation | Rows |
|---|---:|
| `public.daily_refresh_tracking` | 389,009 |
| `public.renewal_processing` | 3,450 |
| `public.contact_forms` | 101 |
| `public.webhook_config` | 1 |

Do not treat the complete `public` schema as one migration unit. Select live
relations by verified repository dependency, production query activity, and
the approved retention policy.

### Always migrate

1. All `kortix` schema data.
2. All Supabase Auth users, identities, MFA factors, and required Auth data.
3. All Supabase Storage metadata and all 452,290 storage objects.
4. These `public` control tables:

   - `daily_refresh_tracking`
   - `renewal_processing`
   - `contact_forms`
   - `webhook_config`

5. The `public` credit functions and Auth signup trigger from
   `packages/db/drizzle/0000_bootstrap.sql`.
6. The `kortix_global_tick` cron job created by
   `kortix.configure_scheduler(...)`.

### Do not migrate as live runtime data

1. `cron.job_run_details`.
2. `net._http_response`.
3. `net.http_request_queue`.
4. The 3,537 legacy jobs named `trigger_<uuid>`.
5. Legacy `public` billing tables superseded by `kortix.credit_accounts` and
   `kortix.credit_ledger`.
6. Legacy `public` API keys superseded by `kortix.api_keys`.
7. Legacy operational and analytics tables with no current repository
   dependency.

The legacy trigger jobs call removed routes:

- 2,201 jobs call `/api/triggers/<uuid>/webhook`.
- 1,336 jobs call `/v1/triggers/<uuid>/webhook`.

The latest 24,538 `pg_net` responses all returned HTTP `404`. Do not recreate
these jobs on the target.

### Product decision: legacy Suna data

The self-service Suna migration feature reads four legacy tables:

- `public.projects`
- `public.resources`
- `public.threads`
- `public.messages`

The complete four-table corpus is approximately 112 GiB. The current
repository still exposes these routes:

- `GET /v1/projects/suna-migration/eligibility`
- `POST /v1/projects/suna-migration/start`
- `GET /v1/projects/suna-migration/status`

Verified account scope on 2026-07-25:

| Scope | Accounts | Projects | Resources | Threads | Messages |
|---|---:|---:|---:|---:|---:|
| Active in the last 30 days and not migrated | 712 | 6,011 | 4,196 | 5,897 | 706,172 |
| Active 31 to 90 days ago and not migrated | 2,955 | 88,141 | 17,319 | 86,858 | 2,457,654 |
| Active in the last 90 days and not migrated | 3,667 | 94,152 | 21,515 | 92,755 | 3,163,826 |

The 90-day subset is approximately 6.4 GiB with proportional index overhead.

Recommended policy:

1. Snapshot the 90-day subset at the replication cutover time.
2. Load it into a dedicated `legacy_suna` schema on the target.
3. Update the Suna migration worker to read `legacy_suna`.
4. Export the complete four-table corpus to encrypted S3 archival storage.
5. Keep a documented manual restore path for older accounts.
6. Remove the self-service migration feature after a fixed deprecation date.

Do not delete or omit the complete legacy corpus without the archive and
retention policy.

## Supabase support requirements

Open one Supabase support case before the rehearsal.

Request these actions:

1. Assist with a managed-project migration where the source database exceeds
   150 GB.
2. Migrate Supabase-owned `auth` and `storage` schemas.
3. Validate PostgreSQL 15.8 to 17.6 compatibility.
4. Preserve the legacy JWT secret until all applications use the target keys.
5. Coordinate the `supa.kortix.com` custom-domain transfer.
6. Confirm the minimal-downtime logical replication plan.
7. Confirm the supported Storage object migration method for 452,290 objects
   and approximately 138 GB.

Official references:

- <https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore>
- <https://supabase.com/docs/guides/resources/migrating-to-supabase/postgres>
- <https://supabase.com/docs/guides/platform/custom-domains>

## Target preparation

1. Run the fresh-project bootstrap.
2. Apply the repository migration ledger with `pnpm migrate`.
3. Verify every migration on PostgreSQL 17.6.
4. Verify all required extensions, functions, triggers, RLS policies, grants,
   and sequences.
5. Insert the source `webhook_config` row without printing its values.
6. Configure only `kortix_global_tick`.
7. Keep application traffic disabled.

Do not use `supabase db push`. The repository migration ledger is the schema
source of truth.

## Data movement

1. Take a consistent initial copy.
2. Start logical replication for approved application tables.
3. Copy Auth and Storage through the Supabase-supported path.
4. Copy Storage objects with checksums and metadata reconciliation.
5. Copy the approved legacy Suna subset.
6. Reset every migrated sequence to `max(column) + 1`.
7. Monitor replication lag and retained WAL.

Do not publish Supabase-owned internal tables through a publication owned by
the application role. Supabase Support must handle those schemas.

## Reconciliation gates

The cutover cannot start until all gates pass.

1. Row counts match for every migrated table.
2. Primary-key set hashes match for every migrated table.
3. Critical aggregate hashes match for Auth, billing, accounts, projects,
   sessions, API keys, and the legacy Suna subset.
4. Storage bucket counts, object counts, and total bytes match.
5. A deterministic object sample passes content checksum verification.
6. Auth password login succeeds on the target.
7. MFA enrollment and challenge succeed on the target.
8. Signed Storage URLs and public object URLs succeed on the target.
9. Credit use, credit add, and renewal idempotency succeed on the target.
10. New-user signup fires the welcome webhook once.
11. API-key authentication uses `kortix.api_keys`.
12. `kortix_global_tick` fires once per minute.
13. Logical replication lag reaches zero.
14. The target passes the production smoke suite before DNS changes.

## Cutover

1. Announce the maintenance window.
2. Stop all production writers.
3. Wait for replication lag to reach zero.
4. Run final row-count, sequence, and checksum reconciliation.
5. Disable source cron and worker writers.
6. Switch application secrets to the target project.
7. Transfer `supa.kortix.com`.
8. Start the `us-west-2` application stack.
9. Run authenticated API, web, Auth, Storage, billing, and trigger checks.
10. Reopen writes.

Target downtime: the final write freeze, final reconciliation, secret switch,
custom-domain activation, and smoke checks.

## Rollback

Rollback is permitted only before target writes reopen.

1. Keep the source project unchanged and writable until the cutover gate.
2. If a target check fails, point applications and the custom domain back to
   the source.
3. Restart source writers.
4. Discard target writes from the failed rehearsal.

After target writes reopen, use a forward recovery plan. Do not run two
writable primaries.
