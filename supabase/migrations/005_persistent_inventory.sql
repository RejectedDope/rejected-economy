-- ============================================================
-- RESALEIQ — Persistent Inventory Intelligence
-- Migration 005: lifecycle tracking, inventory events,
--               portfolio metrics, import sync
-- ============================================================
-- Additive only. All existing tables remain unchanged.
-- inventory_items, recovery_actions, scoring_snapshots
-- already exist from migration 001.
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- ENUM: inventory lifecycle stage
-- Tracks the operational health stage of each listing.
-- Derived from age + scoring signals + recovery history.
-- ──────────────────────────────────────────────────────────

create type lifecycle_stage as enum (
  'newly_imported',  -- < 14 days, peak organic visibility
  'active',          -- 14–60 days, performing normally
  'slowing',         -- 60–90 days, engagement declining
  'stale',           -- 90–180 days, past freshness cliff
  'critical',        -- 180+ days, deep decay
  'liquidating',     -- marked for clearance pricing
  'sold',            -- sold — final state
  'archived'         -- ended/removed — final state
);

-- ──────────────────────────────────────────────────────────
-- ENUM: inventory event types
-- Every significant lifecycle or engagement change is an event.
-- ──────────────────────────────────────────────────────────

create type inventory_event_type as enum (
  -- Lifecycle transitions
  'imported',
  'stage_transition',
  'status_changed',
  -- Recovery actions taken
  'markdown_performed',
  'relisted',
  'sell_similar_used',
  'promoted',
  'crosslisted',
  'bundled',
  'liquidated',
  'title_rewritten',
  'photos_updated',
  'specifics_completed',
  -- Outcomes
  'sold',
  'ended',
  'archived',
  -- Monitoring
  'score_updated',
  'engagement_snapshot'
);

-- ──────────────────────────────────────────────────────────
-- ADD LIFECYCLE TRACKING TO INVENTORY ITEMS
-- Extends the core table with lifecycle + import tracking.
-- ──────────────────────────────────────────────────────────

alter table inventory_items
  add column if not exists lifecycle_stage  lifecycle_stage not null default 'active',
  add column if not exists relist_count     integer not null default 0,
  add column if not exists markdown_count   integer not null default 0,
  add column if not exists last_action_at   timestamptz,
  add column if not exists last_seen_at     timestamptz,     -- last time engaged via platform export
  add column if not exists imported_via     text,            -- 'csv', 'xlsx', 'manual', 'api'
  add column if not exists import_batch_id  uuid,            -- links to raw_uploads
  add column if not exists stale_flagged_at timestamptz,     -- when first entered stale/critical
  add column if not exists recovery_attempts integer not null default 0;

-- Index for lifecycle queries
create index if not exists idx_inventory_lifecycle
  on inventory_items (user_id, lifecycle_stage)
  where status = 'active';

create index if not exists idx_inventory_stale_flagged
  on inventory_items (user_id, stale_flagged_at)
  where stale_flagged_at is not null;

-- ──────────────────────────────────────────────────────────
-- INVENTORY EVENTS
-- Immutable event log. One row per significant change.
-- Source of truth for lifecycle history and trend analysis.
-- ──────────────────────────────────────────────────────────

create table inventory_events (
  id              uuid         primary key default gen_random_uuid(),
  item_id         uuid         references inventory_items(id) on delete cascade not null,
  user_id         uuid         references auth.users not null,

  event_type      inventory_event_type not null,

  -- Lifecycle transition data
  from_stage      lifecycle_stage,
  to_stage        lifecycle_stage,

  -- State at time of event (snapshot)
  price_at_event          numeric(12,2),
  dead_score_at_event     integer,
  days_listed_at_event    integer,
  views_at_event          integer,
  watchers_at_event       integer,
  visibility_risk_at_event text,

  -- Free-form metadata (JSON for flexibility)
  metadata        jsonb,

  -- Causation
  triggered_by    text,        -- 'user', 'system', 'import', 'recovery_engine'
  notes           text,

  occurred_at     timestamptz  not null default now()
);

create index idx_events_item_id   on inventory_events (item_id, occurred_at desc);
create index idx_events_user_id   on inventory_events (user_id, occurred_at desc);
create index idx_events_type      on inventory_events (user_id, event_type, occurred_at desc);
create index idx_events_stage_tx  on inventory_events (user_id, from_stage, to_stage)
  where event_type = 'stage_transition';

alter table inventory_events enable row level security;

create policy "Users see own events"
  on inventory_events for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────
-- INVENTORY SNAPSHOTS
-- Daily/weekly portfolio health snapshots.
-- Enables trend detection and period-over-period comparison.
-- ──────────────────────────────────────────────────────────

create table inventory_snapshots (
  id              uuid         primary key default gen_random_uuid(),
  user_id         uuid         references auth.users not null,

  -- Portfolio-level metrics at snapshot time
  total_items             integer not null,
  active_items            integer not null,
  total_value             numeric(14,2) not null,
  trapped_cash            numeric(14,2) not null,
  trapped_pct             numeric(6,2),

  -- Stale distribution
  stale_count             integer not null default 0,
  critical_count          integer not null default 0,
  newly_imported_count    integer not null default 0,

  -- Score averages
  avg_dead_score          numeric(6,2),
  avg_days_listed         numeric(8,2),
  avg_listing_health      numeric(6,2),

  -- Recovery potential
  total_recovery_opportunity  numeric(14,2),
  quick_win_count             integer not null default 0,
  liquidation_candidate_count integer not null default 0,

  -- Portfolio health score (0–100)
  portfolio_health_score  integer,

  -- Snapshot context
  snapshot_type  text not null default 'scheduled',  -- 'scheduled', 'manual', 'import_trigger'
  snapshotted_at timestamptz not null default now()
);

create index idx_snapshots_user_id
  on inventory_snapshots (user_id, snapshotted_at desc);

alter table inventory_snapshots enable row level security;

create policy "Users see own snapshots"
  on inventory_snapshots for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────
-- PORTFOLIO METRICS
-- Aggregated daily metrics per user for dashboard trends.
-- One row per user per day — upserted by a scheduled job.
-- ──────────────────────────────────────────────────────────

create table portfolio_metrics (
  id              uuid         primary key default gen_random_uuid(),
  user_id         uuid         references auth.users not null,
  metric_date     date         not null,

  -- Inventory counts
  active_count            integer not null default 0,
  sold_count_period       integer not null default 0,  -- sold in this period
  newly_listed_count      integer not null default 0,

  -- Financial metrics
  total_active_value      numeric(14,2) not null default 0,
  sold_value_period       numeric(14,2) not null default 0,
  recovery_opportunity    numeric(14,2) not null default 0,

  -- Health metrics
  dead_inventory_pct      numeric(6,2) not null default 0,
  avg_dead_score          numeric(6,2),
  avg_days_listed         numeric(8,2),
  portfolio_health_score  integer,

  -- Lifecycle distribution
  critical_count          integer not null default 0,
  stale_count             integer not null default 0,
  slowing_count           integer not null default 0,
  active_stage_count      integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, metric_date)
);

create index idx_portfolio_metrics_user_date
  on portfolio_metrics (user_id, metric_date desc);

alter table portfolio_metrics enable row level security;

create policy "Users see own metrics"
  on portfolio_metrics for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────
-- INVENTORY SYNC LOG
-- Tracks import/sync attempts against existing inventory.
-- Enables deduplication history and merge audit trail.
-- ──────────────────────────────────────────────────────────

create table inventory_sync_log (
  id              uuid         primary key default gen_random_uuid(),
  user_id         uuid         references auth.users not null,
  upload_id       uuid         references raw_uploads(id) on delete set null,

  -- Sync results
  items_in_file          integer not null default 0,
  items_new              integer not null default 0,  -- no existing match
  items_updated          integer not null default 0,  -- matched and data refreshed
  items_skipped          integer not null default 0,  -- matched, no changes needed
  items_flagged          integer not null default 0,  -- dedup conflict, needs review

  -- Dedup stats
  high_confidence_matches   integer not null default 0,
  medium_confidence_matches integer not null default 0,
  low_confidence_matches    integer not null default 0,

  sync_type       text not null default 'import',     -- 'import', 'refresh', 'merge'
  status          text not null default 'completed',  -- 'completed', 'partial', 'failed'
  notes           text,

  synced_at       timestamptz  not null default now()
);

create index idx_sync_log_user_id
  on inventory_sync_log (user_id, synced_at desc);

alter table inventory_sync_log enable row level security;

create policy "Users see own sync logs"
  on inventory_sync_log for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────
-- FUNCTION: record_lifecycle_transition
-- Call this when an item's lifecycle_stage changes.
-- Inserts an event and updates stale_flagged_at if first entry.
-- ──────────────────────────────────────────────────────────

create or replace function record_lifecycle_transition(
  p_item_id         uuid,
  p_user_id         uuid,
  p_from_stage      lifecycle_stage,
  p_to_stage        lifecycle_stage,
  p_triggered_by    text default 'system'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Insert the transition event
  insert into inventory_events (
    item_id, user_id, event_type,
    from_stage, to_stage, triggered_by,
    price_at_event, dead_score_at_event,
    days_listed_at_event
  )
  select
    p_item_id, p_user_id, 'stage_transition',
    p_from_stage, p_to_stage, p_triggered_by,
    price, dead_inventory_score, days_listed
  from inventory_items
  where id = p_item_id;

  -- Update item lifecycle stage
  update inventory_items
  set
    lifecycle_stage = p_to_stage,
    stale_flagged_at = case
      when p_to_stage in ('stale', 'critical') and stale_flagged_at is null
      then now()
      else stale_flagged_at
    end
  where id = p_item_id and user_id = p_user_id;
end;
$$;

-- ──────────────────────────────────────────────────────────
-- FUNCTION: get_portfolio_summary
-- Returns a quick portfolio health summary for a user.
-- Used by dashboard server actions.
-- ──────────────────────────────────────────────────────────

create or replace function get_portfolio_summary(p_user_id uuid)
returns table (
  total_active        bigint,
  total_value         numeric,
  trapped_cash        numeric,
  critical_count      bigint,
  stale_count         bigint,
  avg_dead_score      numeric,
  avg_days_listed     numeric,
  recovery_opportunity numeric
)
language sql
security definer
set search_path = public
as $$
  select
    count(*)                                                          as total_active,
    sum(price)                                                        as total_value,
    sum(case when coalesce(dead_inventory_score, 0) >= 50 then price else 0 end) as trapped_cash,
    count(*) filter (where coalesce(dead_inventory_score, 0) >= 75)   as critical_count,
    count(*) filter (where coalesce(dead_inventory_score, 0) >= 30)   as stale_count,
    round(avg(coalesce(dead_inventory_score, 0)), 1)                  as avg_dead_score,
    round(avg(days_listed), 1)                                        as avg_days_listed,
    sum(case when coalesce(dead_inventory_score, 0) >= 50 then coalesce(estimated_recovery, 0) else 0 end) as recovery_opportunity
  from inventory_items
  where user_id = p_user_id
    and status = 'active';
$$;
