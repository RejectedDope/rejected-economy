-- ============================================================
-- RESALEIQ — Ingestion Staging Architecture
-- Migration 004: uploads, parsed_inventory, ingestion_errors,
--               normalization_metadata
-- ============================================================
-- Flow:
--   raw_uploads
--     → parsed_inventory  (normalized rows awaiting review)
--     → inventory_items   (after user approval)
--
-- ingestion_errors logs every malformed row.
-- normalization_metadata logs per-session stats.
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- ENUM: upload source type
-- ──────────────────────────────────────────────────────────

create type upload_source_type as enum (
  'csv',
  'xlsx',
  'screenshot',
  'manual'
);

-- ──────────────────────────────────────────────────────────
-- ENUM: ingestion processing status
-- ──────────────────────────────────────────────────────────

create type ingestion_status as enum (
  'pending',           -- uploaded, not yet parsed
  'parsing',           -- actively being processed
  'pending_review',    -- parsed, awaiting user review
  'approved',          -- user approved all rows
  'partial_approval',  -- some rows approved, some excluded
  'failed',            -- parse error, no usable rows
  'cancelled'          -- user abandoned the import
);

-- ──────────────────────────────────────────────────────────
-- RAW UPLOADS
-- One row per file upload attempt.
-- ──────────────────────────────────────────────────────────

create table raw_uploads (
  id              uuid         primary key default gen_random_uuid(),
  user_id         uuid         references auth.users not null,

  file_name       text         not null,
  file_size_bytes integer      not null,
  mime_type       text         not null,
  source_type     upload_source_type not null,

  -- Supabase Storage path (set after successful upload)
  storage_path    text,

  status          ingestion_status not null default 'pending',

  -- Parse summary (populated after processing)
  total_rows_found    integer,
  rows_valid          integer,
  rows_with_errors    integer,
  rows_with_warnings  integer,

  -- Error message if status = 'failed'
  error_message   text,

  created_at      timestamptz  not null default now(),
  updated_at      timestamptz  not null default now()
);

create index idx_raw_uploads_user_id  on raw_uploads (user_id, created_at desc);
create index idx_raw_uploads_status   on raw_uploads (user_id, status);

create trigger raw_uploads_updated_at
  before update on raw_uploads
  for each row execute function update_updated_at();

-- ──────────────────────────────────────────────────────────
-- PARSED INVENTORY
-- Normalized staging rows — awaiting user review before
-- being promoted to inventory_items.
-- ──────────────────────────────────────────────────────────

create table parsed_inventory (
  id              uuid         primary key default gen_random_uuid(),
  upload_id       uuid         references raw_uploads(id) on delete cascade not null,
  user_id         uuid         references auth.users not null,
  row_index       integer      not null,  -- 1-based position in source file

  -- Core normalized fields (mirrors inventory_items structure)
  title           text         not null,
  platform        text         not null,  -- plain text pre-validation
  category        text,
  price           numeric(12,2) not null,
  original_price  numeric(12,2),
  days_listed     integer      not null default 0,

  -- Listing quality signals
  item_specifics_complete   boolean  not null default false,
  image_count               integer  not null default 1,
  title_keyword_strength    integer  not null default 50,
  has_promoted_listing      boolean  not null default false,
  shipping_type             text,
  shipping_cost             numeric(8,2),

  -- Engagement
  views       integer not null default 0,
  watchers    integer not null default 0,
  impressions integer not null default 0,

  -- Review workflow
  review_status   text not null default 'pending',  -- pending | approved | excluded | corrected
  exclusion_reason text,

  -- Normalization metadata
  has_warnings      boolean not null default false,
  warnings_json     jsonb,                         -- array of {field, issue} objects

  -- Duplicate detection
  dedupe_key        text,
  is_duplicate      boolean not null default false,
  duplicate_of_row  integer,

  -- Screenshot-specific (OCR)
  screenshot_upload_id  uuid,
  ocr_confidence        text,  -- 'high' | 'medium' | 'low' | 'none'

  -- Once approved, set to the created inventory_items.id
  inventory_item_id uuid references inventory_items(id) on delete set null,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_parsed_inventory_upload_id  on parsed_inventory (upload_id, row_index);
create index idx_parsed_inventory_user_id    on parsed_inventory (user_id, created_at desc);
create index idx_parsed_inventory_review     on parsed_inventory (upload_id, review_status);
create index idx_parsed_inventory_dedupe     on parsed_inventory (user_id, dedupe_key) where dedupe_key is not null;

create trigger parsed_inventory_updated_at
  before update on parsed_inventory
  for each row execute function update_updated_at();

-- ──────────────────────────────────────────────────────────
-- INGESTION ERRORS
-- One row per malformed/rejected row during parse.
-- Separate from normalization warnings (warnings = fixable,
-- errors = row rejected entirely).
-- ──────────────────────────────────────────────────────────

create table ingestion_errors (
  id          uuid        primary key default gen_random_uuid(),
  upload_id   uuid        references raw_uploads(id) on delete cascade not null,
  user_id     uuid        references auth.users not null,
  row_index   integer     not null,

  -- Which field(s) caused the rejection
  field       text,
  error_code  text        not null,  -- e.g. 'missing_title', 'invalid_price', 'negative_price'
  message     text        not null,

  -- Raw data that caused the error (for debugging)
  raw_value   text,

  created_at  timestamptz not null default now()
);

create index idx_ingestion_errors_upload_id on ingestion_errors (upload_id, row_index);
create index idx_ingestion_errors_user_id   on ingestion_errors (user_id, created_at desc);

-- ──────────────────────────────────────────────────────────
-- NORMALIZATION METADATA
-- Per-upload stats written after parse completes.
-- Powers the observability dashboard.
-- ──────────────────────────────────────────────────────────

create table normalization_metadata (
  id                  uuid        primary key default gen_random_uuid(),
  upload_id           uuid        references raw_uploads(id) on delete cascade not null unique,
  user_id             uuid        references auth.users not null,

  -- Parse performance
  parse_duration_ms   integer,

  -- Field coverage (what % of rows had each field populated)
  pct_with_title      numeric(5,2),
  pct_with_price      numeric(5,2),
  pct_with_category   numeric(5,2),
  pct_with_images     numeric(5,2),
  pct_with_views      numeric(5,2),
  pct_with_watchers   numeric(5,2),

  -- Data quality
  duplicate_count     integer not null default 0,
  truncated           boolean not null default false,
  platform_breakdown  jsonb,  -- {platform: count} map

  created_at  timestamptz not null default now()
);

create index idx_normalization_metadata_user_id on normalization_metadata (user_id, created_at desc);

-- ──────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ──────────────────────────────────────────────────────────

alter table raw_uploads           enable row level security;
alter table parsed_inventory      enable row level security;
alter table ingestion_errors      enable row level security;
alter table normalization_metadata enable row level security;

-- Users manage their own ingestion data
create policy "Users manage own uploads"
  on raw_uploads for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own parsed inventory"
  on parsed_inventory for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own ingestion errors"
  on ingestion_errors for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own normalization metadata"
  on normalization_metadata for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────
-- HELPER: approve staged rows → inventory_items
-- Called by the review workflow after user confirms rows.
-- ──────────────────────────────────────────────────────────

create or replace function approve_parsed_rows(
  p_upload_id uuid,
  p_user_id   uuid,
  p_row_ids   uuid[]
)
returns integer as $$
declare
  inserted_count integer := 0;
  rec parsed_inventory%rowtype;
  new_item_id uuid;
begin
  for rec in
    select * from parsed_inventory
    where upload_id = p_upload_id
      and user_id = p_user_id
      and id = any(p_row_ids)
      and review_status = 'pending'
  loop
    insert into inventory_items (
      user_id, title, platform, category, price, original_price,
      days_listed, item_specifics_complete, image_count,
      title_keyword_strength, has_promoted_listing,
      shipping_type, shipping_cost, views, watchers, impressions, status
    ) values (
      p_user_id,
      rec.title,
      rec.platform::platform_type,
      rec.category,
      rec.price,
      rec.original_price,
      rec.days_listed,
      rec.item_specifics_complete,
      rec.image_count,
      rec.title_keyword_strength,
      rec.has_promoted_listing,
      coalesce(rec.shipping_type, 'calculated')::shipping_type,
      rec.shipping_cost,
      rec.views,
      rec.watchers,
      rec.impressions,
      'active'
    ) returning id into new_item_id;

    update parsed_inventory
      set review_status = 'approved',
          inventory_item_id = new_item_id
      where id = rec.id;

    inserted_count := inserted_count + 1;
  end loop;

  -- Update upload status
  update raw_uploads
  set status = case
    when (select count(*) from parsed_inventory where upload_id = p_upload_id and review_status = 'pending') = 0
    then 'approved'
    else 'partial_approval'
  end
  where id = p_upload_id;

  return inserted_count;
end;
$$ language plpgsql security definer;
