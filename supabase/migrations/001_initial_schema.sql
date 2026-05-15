-- ============================================================
-- RESALEIQ — Initial Database Schema
-- by Rejected Economy
-- ============================================================
-- Run this in your Supabase SQL editor or via CLI:
--   supabase db push
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- EXTENSIONS
-- ──────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ──────────────────────────────────────────────────────────
-- ENUM TYPES
-- ──────────────────────────────────────────────────────────

create type platform_type as enum (
  'eBay',
  'Poshmark',
  'Mercari',
  'Depop',
  'Facebook Marketplace',
  'StockX',
  'GOAT',
  'Whatnot',
  'Grailed',
  'Other'
);

create type item_status as enum (
  'active',
  'sold',
  'ended',
  'draft',
  'relisted'
);

create type shipping_type as enum (
  'free',
  'calculated',
  'flat',
  'local_pickup'
);

create type recovery_action_type as enum (
  'relist_now',
  'strategic_markdown',
  'bundle',
  'move_platform',
  'optimize_specifics',
  'add_photos',
  'liquidate',
  'hold',
  'sell_similar',
  'adjust_shipping'
);

create type action_status as enum (
  'pending',
  'completed',
  'skipped',
  'snoozed'
);

create type visibility_risk as enum (
  'Low',
  'Medium',
  'High',
  'Critical'
);

-- ──────────────────────────────────────────────────────────
-- INVENTORY ITEMS
-- Core table. Every active/sold/ended listing lives here.
-- ──────────────────────────────────────────────────────────

create table inventory_items (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid references auth.users not null,

  -- Listing identity
  title           text not null,
  platform        platform_type not null default 'eBay',
  category        text,
  subcategory     text,

  -- Pricing
  price           numeric(12,2) not null,
  original_price  numeric(12,2),               -- first listed price
  cost_basis      numeric(12,2),               -- what you paid (COGS)

  -- Listing age
  days_listed     integer not null default 0,  -- denormalized for fast queries
  date_listed     timestamptz,                 -- actual listing date

  -- Listing quality signals
  item_specifics_complete   boolean not null default false,
  image_count               integer not null default 1,
  title_keyword_strength    integer not null default 50 check (title_keyword_strength between 0 and 100),
  has_promoted_listing      boolean not null default false,
  shipping_type             shipping_type not null default 'calculated',
  shipping_cost             numeric(8,2),

  -- Engagement metrics (from platform exports, optional)
  views           integer not null default 0,
  watchers        integer not null default 0,
  impressions     integer not null default 0,

  -- Status & external reference
  status          item_status not null default 'active',
  platform_listing_id  text,                  -- eBay item number, etc.
  external_url    text,

  -- Scoring cache (updated on each scan)
  dead_inventory_score     integer check (dead_inventory_score between 0 and 100),
  listing_health_score     integer check (listing_health_score between 0 and 100),
  visibility_risk          visibility_risk,
  primary_recovery_action  recovery_action_type,
  estimated_recovery       numeric(12,2),
  last_scored_at           timestamptz,

  -- User notes
  notes           text,
  tags            text[],
  image_url       text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Indexes
create index idx_inventory_items_user_id      on inventory_items (user_id);
create index idx_inventory_items_status       on inventory_items (user_id, status);
create index idx_inventory_items_platform     on inventory_items (user_id, platform);
create index idx_inventory_items_risk         on inventory_items (user_id, visibility_risk);
create index idx_inventory_items_days_listed  on inventory_items (user_id, days_listed desc);
create index idx_inventory_items_dead_score   on inventory_items (user_id, dead_inventory_score desc nulls last);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger inventory_items_updated_at
  before update on inventory_items
  for each row execute function update_updated_at();

-- ──────────────────────────────────────────────────────────
-- PRICE HISTORY
-- Every price change, relist, or markdown logged here.
-- ──────────────────────────────────────────────────────────

create table price_history (
  id              uuid default gen_random_uuid() primary key,
  item_id         uuid references inventory_items(id) on delete cascade not null,
  user_id         uuid references auth.users not null,

  old_price       numeric(12,2),
  new_price       numeric(12,2) not null,
  change_pct      numeric(6,2),                -- negative = markdown

  -- What caused the change
  change_type     text not null,               -- 'markdown', 'relist', 'correction', 'sale', 'increase'
  triggered_by    text,                        -- 'user', 'recovery_action', 'csv_import'

  notes           text,
  created_at      timestamptz not null default now()
);

create index idx_price_history_item_id  on price_history (item_id, created_at desc);
create index idx_price_history_user_id  on price_history (user_id, created_at desc);

-- ──────────────────────────────────────────────────────────
-- RECOVERY ACTIONS
-- Logs every action a user takes (or is recommended) per item.
-- ──────────────────────────────────────────────────────────

create table recovery_actions (
  id              uuid default gen_random_uuid() primary key,
  item_id         uuid references inventory_items(id) on delete cascade not null,
  user_id         uuid references auth.users not null,

  action_type     recovery_action_type not null,
  action_status   action_status not null default 'pending',

  -- State at time of recommendation
  dead_score_snapshot     integer,
  price_snapshot          numeric(12,2),
  days_listed_snapshot    integer,
  visibility_risk_snapshot visibility_risk,

  -- Outcome tracking (filled in after outcome)
  outcome           text,                      -- 'sold', 'still_active', 'ended', 'no_change'
  days_to_outcome   integer,
  recovery_amount   numeric(12,2),             -- actual sale price if outcome = 'sold'

  notes           text,
  snoozed_until   timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz not null default now()
);

create index idx_recovery_actions_item_id  on recovery_actions (item_id, created_at desc);
create index idx_recovery_actions_user_id  on recovery_actions (user_id, action_status);
create index idx_recovery_actions_pending  on recovery_actions (user_id, action_status)
  where action_status = 'pending';

-- ──────────────────────────────────────────────────────────
-- SCORING SNAPSHOTS
-- Periodic scoring history — enables trend analysis.
-- Written on each inventory scan.
-- ──────────────────────────────────────────────────────────

create table scoring_snapshots (
  id              uuid default gen_random_uuid() primary key,
  item_id         uuid references inventory_items(id) on delete cascade not null,
  user_id         uuid references auth.users not null,

  -- Composite scores
  dead_inventory_score  integer not null,
  listing_health_score  integer not null,
  visibility_risk       visibility_risk not null,
  primary_action        recovery_action_type,
  estimated_recovery    numeric(12,2),

  -- Score component breakdown (for transparency / audit trail)
  score_days_component      integer,  -- how many pts came from days_listed
  score_specifics_component integer,  -- how many pts from missing specifics
  score_photos_component    integer,  -- how many pts from low photo count
  score_title_component     integer,  -- how many pts from weak title

  -- Extended analysis snapshot
  sell_through_probability  integer,  -- 0-100
  recovery_probability      integer,  -- 0-100
  pricing_risk              text,

  price_at_snapshot   numeric(12,2),
  days_at_snapshot    integer,

  scored_at timestamptz not null default now()
);

create index idx_scoring_snapshots_item_id  on scoring_snapshots (item_id, scored_at desc);
create index idx_scoring_snapshots_user_id  on scoring_snapshots (user_id, scored_at desc);

-- ──────────────────────────────────────────────────────────
-- USER SETTINGS
-- Per-user platform defaults, fee assumptions, thresholds.
-- ──────────────────────────────────────────────────────────

create table user_settings (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid references auth.users not null unique,

  -- Platform preferences
  primary_platform    platform_type default 'eBay',
  active_platforms    text[] default array['eBay'],

  -- Fee assumptions (percentages, used for net recovery calc)
  ebay_fee_pct        numeric(5,2) default 13.25,
  poshmark_fee_pct    numeric(5,2) default 20.00,
  mercari_fee_pct     numeric(5,2) default 10.00,
  depop_fee_pct       numeric(5,2) default 10.00,

  -- Shipping assumptions
  avg_shipping_cost         numeric(8,2) default 5.00,
  free_shipping_threshold   numeric(8,2) default 50.00,

  -- Aging thresholds (days) — when to start surfacing warnings
  stale_warning_days    integer not null default 60,
  stale_critical_days   integer not null default 90,
  dead_threshold_days   integer not null default 180,

  -- Notifications
  notify_critical_items   boolean not null default true,
  notify_weekly_report    boolean not null default true,
  notify_new_death_pile   boolean not null default true,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger user_settings_updated_at
  before update on user_settings
  for each row execute function update_updated_at();

-- ──────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- Users can only see and modify their own data.
-- ──────────────────────────────────────────────────────────

alter table inventory_items    enable row level security;
alter table price_history      enable row level security;
alter table recovery_actions   enable row level security;
alter table scoring_snapshots  enable row level security;
alter table user_settings      enable row level security;

-- inventory_items
create policy "Users manage own inventory"
  on inventory_items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- price_history
create policy "Users manage own price history"
  on price_history for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- recovery_actions
create policy "Users manage own recovery actions"
  on recovery_actions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- scoring_snapshots
create policy "Users manage own scoring snapshots"
  on scoring_snapshots for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- user_settings
create policy "Users manage own settings"
  on user_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────
-- HELPER FUNCTIONS
-- ──────────────────────────────────────────────────────────

-- Recompute days_listed from date_listed (call via cron or trigger)
create or replace function sync_days_listed()
returns void as $$
begin
  update inventory_items
  set days_listed = extract(day from now() - date_listed)::integer
  where date_listed is not null
    and status = 'active';
end;
$$ language plpgsql security definer;

-- Get trapped cash for a user
create or replace function get_trapped_cash(p_user_id uuid)
returns numeric as $$
  select coalesce(sum(price), 0)
  from inventory_items
  where user_id = p_user_id
    and status = 'active';
$$ language sql security definer;
