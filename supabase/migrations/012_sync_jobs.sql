-- Sync job queue: tracks import/export/price-sync/inventory-sync operations
-- for each user across marketplace platforms.

create table if not exists sync_jobs (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users(id) on delete cascade,
  job_type          text        not null check (job_type in ('import','export','price_sync','inventory_sync')),
  status            text        not null default 'pending'
                                check (status in ('pending','running','completed','failed','cancelled')),
  source_platform   text,
  items_processed   integer     not null default 0,
  items_failed      integer     not null default 0,
  error_message     text,
  retry_count       integer     not null default 0,
  started_at        timestamptz,
  completed_at      timestamptz,
  next_scheduled_at timestamptz,
  webhook_url       text,                              -- reserved for future webhook delivery
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Indexes ------------------------------------------------------------------

-- General status lookups for a user (e.g. "show all running jobs")
create index sync_jobs_user_status
  on sync_jobs (user_id, status);

-- Scheduler polling: find jobs that are due to run next
create index sync_jobs_user_scheduled
  on sync_jobs (user_id, next_scheduled_at)
  where status = 'pending';

-- Activity feed / history ordered by newest first
create index sync_jobs_user_created
  on sync_jobs (user_id, created_at desc);

-- Row-level security -------------------------------------------------------

alter table sync_jobs enable row level security;

create policy "Users manage own sync jobs"
  on sync_jobs for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
