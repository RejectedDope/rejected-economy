-- ============================================================
-- RESALEIQ — Upload Audit Trail & Ingestion Logging
-- Migration 007: Tracks every import session and its outcomes.
-- Additive only — no existing tables modified.
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- UPLOAD SESSIONS
-- One row per import attempt (CSV, XLSX, screenshot batch).
-- Links to raw_uploads (existing) when a file is stored.
-- ──────────────────────────────────────────────────────────

create table if not exists upload_sessions (
  id              uuid         primary key default gen_random_uuid(),
  user_id         uuid         references auth.users not null,

  -- File metadata
  file_name       text         not null,
  file_size_bytes integer,
  file_type       text         not null,  -- 'csv', 'xlsx', 'screenshot', 'manual'

  -- Processing results
  status          text         not null default 'pending',
  -- pending | parsing | complete | partial | failed

  rows_in_file    integer      not null default 0,
  rows_imported   integer      not null default 0,
  rows_failed     integer      not null default 0,
  rows_duplicates integer      not null default 0,
  rows_excluded   integer      not null default 0,

  -- Structured error log (array of {row, message} objects)
  error_log       jsonb,

  -- Batch link (ties to inventory_items.import_batch_id)
  batch_id        uuid,

  -- Audit timestamps
  started_at      timestamptz  not null default now(),
  completed_at    timestamptz,

  -- Duration in milliseconds (filled on completion)
  duration_ms     integer
);

create index if not exists idx_upload_sessions_user
  on upload_sessions (user_id, started_at desc);

create index if not exists idx_upload_sessions_batch
  on upload_sessions (batch_id)
  where batch_id is not null;

alter table upload_sessions enable row level security;

create policy "Users see own upload sessions"
  on upload_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────
-- INGESTION FAILURES
-- Per-row parse failures from CSV/XLSX imports.
-- Allows post-mortem review of what was rejected and why.
-- ──────────────────────────────────────────────────────────

create table if not exists ingestion_failures (
  id              uuid         primary key default gen_random_uuid(),
  upload_session_id uuid       references upload_sessions(id) on delete cascade not null,
  user_id         uuid         references auth.users not null,

  row_index       integer      not null,
  raw_row         jsonb,       -- original unparsed data
  failure_reason  text         not null,
  field           text,        -- which field caused the failure (if known)

  created_at      timestamptz  not null default now()
);

create index if not exists idx_ingestion_failures_session
  on ingestion_failures (upload_session_id);

alter table ingestion_failures enable row level security;

create policy "Users see own ingestion failures"
  on ingestion_failures for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────
-- IMAGE INGESTION RESULTS
-- Stores OCR extraction results for screenshot imports.
-- Each row corresponds to one processed image.
-- ──────────────────────────────────────────────────────────

create table if not exists image_ingestion_results (
  id              uuid         primary key default gen_random_uuid(),
  upload_session_id uuid       references upload_sessions(id) on delete cascade,
  user_id         uuid         references auth.users not null,
  inventory_item_id uuid       references inventory_items(id) on delete set null,

  -- Source image
  file_name       text,
  file_size_bytes integer,

  -- OCR extraction
  extraction_method   text    not null default 'ocr',   -- 'ocr', 'manual', 'none'
  confidence_level    text    not null default 'none',  -- 'high', 'medium', 'low', 'none'

  -- Extracted fields (raw, pre-normalization)
  extracted_title     text,
  extracted_price     text,
  extracted_platform  text,
  extracted_category  text,
  extracted_days      text,
  extracted_views     text,
  extracted_watchers  text,

  -- Processing outcome
  was_imported    boolean      not null default false,
  failure_reason  text,

  created_at      timestamptz  not null default now()
);

create index if not exists idx_image_ingestion_user
  on image_ingestion_results (user_id, created_at desc);

alter table image_ingestion_results enable row level security;

create policy "Users see own image ingestion results"
  on image_ingestion_results for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────
-- UPLOAD HISTORY VIEW
-- Convenience view for the upload history page.
-- ──────────────────────────────────────────────────────────

create or replace view upload_history as
  select
    us.id,
    us.user_id,
    us.file_name,
    us.file_type,
    us.status,
    us.rows_in_file,
    us.rows_imported,
    us.rows_failed,
    us.rows_duplicates,
    us.batch_id,
    us.started_at,
    us.completed_at,
    us.duration_ms,
    count(f.id) as failure_count
  from upload_sessions us
  left join ingestion_failures f on f.upload_session_id = us.id
  group by us.id;
