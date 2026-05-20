-- ============================================================
-- RESALEIQ — Platform Sync Readiness
-- Migration 008: Schema foundations for future marketplace
-- sync, scheduled imports, and webhook ingestion.
-- Additive only — no existing tables modified.
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- PLATFORM CONNECTIONS
-- One row per user per platform when they connect an account.
-- No credentials stored here — reference to secure vault only.
-- ──────────────────────────────────────────────────────────

create table if not exists platform_connections (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        references auth.users not null,

  platform         text        not null,  -- 'eBay', 'Poshmark', 'Mercari', etc.
  display_name     text,                  -- user's seller name on that platform

  is_active        boolean     not null default true,
  connected_at     timestamptz not null default now(),
  disconnected_at  timestamptz,

  -- Reference to credential vault (never store raw tokens here)
  credential_ref   text,

  -- Last successful sync
  last_synced_at   timestamptz,
  last_sync_status text,                  -- 'success', 'partial', 'failed'
  last_sync_count  integer,               -- items synced in last run

  -- Platform-specific config (rate limits, scope, etc.)
  config_json      jsonb,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  unique (user_id, platform)
);

create index if not exists idx_platform_connections_user
  on platform_connections (user_id)
  where is_active = true;

alter table platform_connections enable row level security;

create policy "Users manage own platform connections"
  on platform_connections for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────
-- SYNC JOBS
-- Scheduled or on-demand sync tasks per user per platform.
-- Status machine: pending → running → complete | failed
-- ──────────────────────────────────────────────────────────

create table if not exists sync_jobs (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        references auth.users not null,
  connection_id    uuid        references platform_connections(id) on delete cascade,

  platform         text        not null,
  job_type         text        not null default 'full_sync',
  -- 'full_sync' | 'incremental' | 'status_check' | 'price_refresh'

  status           text        not null default 'pending',
  -- 'pending' | 'running' | 'complete' | 'partial' | 'failed' | 'cancelled'

  -- Scheduling
  scheduled_at     timestamptz not null default now(),
  started_at       timestamptz,
  completed_at     timestamptz,
  next_run_at      timestamptz,           -- set for recurring jobs

  -- Results
  items_found      integer,
  items_synced     integer,
  items_failed     integer,
  duration_ms      integer,

  -- Error details
  error_message    text,
  retry_count      integer     not null default 0,
  max_retries      integer     not null default 3,

  -- Trigger metadata
  triggered_by     text        not null default 'user',
  -- 'user' | 'scheduler' | 'webhook' | 'import_complete'

  created_at       timestamptz not null default now()
);

create index if not exists idx_sync_jobs_user_status
  on sync_jobs (user_id, status, scheduled_at desc);

create index if not exists idx_sync_jobs_pending
  on sync_jobs (scheduled_at)
  where status = 'pending';

alter table sync_jobs enable row level security;

create policy "Users see own sync jobs"
  on sync_jobs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────
-- INGESTION EVENTS
-- Append-only event log for all data flowing into the system.
-- Powers audit trail, debugging, and future automation hooks.
-- ──────────────────────────────────────────────────────────

create table if not exists ingestion_events (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        references auth.users not null,

  event_type       text        not null,
  -- 'file_uploaded' | 'parse_started' | 'parse_complete' | 'trust_check'
  -- | 'dedupe_run' | 'rows_inserted' | 'rows_quarantined' | 'session_complete'
  -- | 'session_failed' | 'sync_triggered' | 'webhook_received'

  source_type      text,        -- 'csv', 'xlsx', 'screenshot', 'api', 'webhook'
  session_id       uuid,        -- references upload_sessions.id (soft FK)
  sync_job_id      uuid,        -- references sync_jobs.id (soft FK)

  -- Counts relevant to this event
  rows_affected    integer,
  rows_ok          integer,
  rows_failed      integer,

  -- Structured payload (event-specific)
  payload          jsonb,

  -- Timing
  occurred_at      timestamptz not null default now()
);

create index if not exists idx_ingestion_events_user
  on ingestion_events (user_id, occurred_at desc);

create index if not exists idx_ingestion_events_session
  on ingestion_events (session_id)
  where session_id is not null;

alter table ingestion_events enable row level security;

create policy "Users see own ingestion events"
  on ingestion_events for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
