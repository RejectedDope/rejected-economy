-- ============================================================
-- RESALEIQ — Subscription Metadata
-- Migration 009: Plan definitions, user subscriptions,
-- and usage counters for quota enforcement.
-- Additive only — no existing tables modified.
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- SUBSCRIPTION PLANS
-- Static reference table — seeded below.
-- Updated via migration when plan limits change.
-- ──────────────────────────────────────────────────────────

create table if not exists subscription_plans (
  id                    text        primary key,  -- 'free', 'starter', 'pro', 'business'
  name                  text        not null,
  max_items             integer,    -- null = unlimited
  max_imports_per_month integer,    -- null = unlimited
  max_batch_size        integer     not null default 200,
  price_monthly_cents   integer     not null default 0,
  is_active             boolean     not null default true,
  created_at            timestamptz not null default now()
);

-- Seed plan definitions
insert into subscription_plans (id, name, max_items, max_imports_per_month, max_batch_size, price_monthly_cents) values
  ('free',     'Free',     100,   3,    200,    0),
  ('starter',  'Starter',  500,   10,   1000,   999),
  ('pro',      'Pro',      5000,  null, 10000,  2999),
  ('business', 'Business', null,  null, 10000,  9999)
on conflict (id) do nothing;

-- ──────────────────────────────────────────────────────────
-- USER SUBSCRIPTIONS
-- One active row per user — tracks their current plan.
-- ──────────────────────────────────────────────────────────

create table if not exists user_subscriptions (
  id                 uuid        primary key default gen_random_uuid(),
  user_id            uuid        references auth.users not null unique,
  plan_id            text        references subscription_plans(id) not null default 'free',

  status             text        not null default 'active',
  -- 'active' | 'cancelled' | 'past_due' | 'trialing'

  -- Billing references (populated when Stripe is integrated)
  stripe_customer_id    text,
  stripe_subscription_id text,

  -- Plan dates
  started_at         timestamptz not null default now(),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancelled_at       timestamptz,
  trial_ends_at      timestamptz,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_user_subscriptions_user
  on user_subscriptions (user_id);

alter table user_subscriptions enable row level security;

create policy "Users see own subscription"
  on user_subscriptions for select
  using (auth.uid() = user_id);

-- Service role can update subscriptions (Stripe webhook handler)
create policy "Service role manages subscriptions"
  on user_subscriptions for all
  using (auth.jwt() ->> 'role' = 'service_role');

-- ──────────────────────────────────────────────────────────
-- USAGE COUNTERS
-- Monthly rolling counters per user.
-- One row per user per calendar month.
-- ──────────────────────────────────────────────────────────

create table if not exists usage_counters (
  id                 uuid        primary key default gen_random_uuid(),
  user_id            uuid        references auth.users not null,
  month              date        not null,  -- first day of month: 2025-01-01

  imports_used       integer     not null default 0,
  items_imported     integer     not null default 0,
  api_calls_made     integer     not null default 0,
  screenshots_processed integer  not null default 0,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  unique (user_id, month)
);

create index if not exists idx_usage_counters_user_month
  on usage_counters (user_id, month desc);

alter table usage_counters enable row level security;

create policy "Users see own usage"
  on usage_counters for select
  using (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────
-- FUNCTION: increment_usage
-- Atomically increment a usage counter for the current month.
-- Call after a successful import or API action.
-- ──────────────────────────────────────────────────────────

create or replace function increment_usage(
  p_user_id         uuid,
  p_imports         integer default 0,
  p_items           integer default 0,
  p_screenshots     integer default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month date := date_trunc('month', now())::date;
begin
  insert into usage_counters (user_id, month, imports_used, items_imported, screenshots_processed)
  values (p_user_id, v_month, p_imports, p_items, p_screenshots)
  on conflict (user_id, month) do update
    set
      imports_used          = usage_counters.imports_used + excluded.imports_used,
      items_imported        = usage_counters.items_imported + excluded.items_imported,
      screenshots_processed = usage_counters.screenshots_processed + excluded.screenshots_processed,
      updated_at            = now();
end;
$$;

-- ──────────────────────────────────────────────────────────
-- FUNCTION: get_user_plan
-- Returns the effective plan for a user (defaults to 'free').
-- ──────────────────────────────────────────────────────────

create or replace function get_user_plan(p_user_id uuid)
returns text
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select plan_id from user_subscriptions
     where user_id = p_user_id and status in ('active', 'trialing')
     limit 1),
    'free'
  );
$$;
