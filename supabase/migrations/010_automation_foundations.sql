-- ============================================================
-- 010 — Automation Foundations
-- Interfaces for future automated recovery workflows.
-- Nothing runs automatically yet — these tables define the
-- contract for scheduled markdowns, auto-relist, and
-- marketplace sync automation.
-- ============================================================

-- ─── Automation Rules ────────────────────────────────────────────────────────
-- User-defined rules that trigger automated recovery actions.
-- All rules default to disabled — users must opt in explicitly.

create table if not exists automation_rules (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  rule_type    text not null check (rule_type in (
    'auto_markdown',      -- reduce price by X% after Y days with no sale
    'auto_relist',        -- relist after Y days of no activity
    'auto_crosslist',     -- cross-post to another platform after Y days
    'stale_alert'         -- notify when items cross stale threshold
  )),
  enabled      boolean not null default false,
  conditions   jsonb not null default '{}',
  -- e.g. { "min_days_listed": 90, "min_dead_score": 60 }
  actions      jsonb not null default '{}',
  -- e.g. { "markdown_pct": 15, "notify": true }
  last_run_at  timestamptz,
  run_count    integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table automation_rules enable row level security;
create policy "Users manage own automation rules"
  on automation_rules for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_automation_rules_user_id
  on automation_rules (user_id, enabled, rule_type);

-- ─── Recovery Scans ──────────────────────────────────────────────────────────
-- Audit trail of every time the recovery engine ran for a user.
-- Supports future scheduled scans + scan history UI.

create table if not exists recovery_scans (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  status               text not null default 'pending'
                         check (status in ('pending','running','complete','failed')),
  triggered_by         text not null default 'manual'
                         check (triggered_by in ('manual','scheduled','webhook','cron')),
  items_scanned        integer,
  actions_recommended  integer,
  critical_count       integer,
  high_risk_count      integer,
  total_recoverable    numeric(12,2),
  error                text,
  started_at           timestamptz not null default now(),
  completed_at         timestamptz
);

alter table recovery_scans enable row level security;
create policy "Users manage own recovery scans"
  on recovery_scans for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_recovery_scans_user_id
  on recovery_scans (user_id, started_at desc);

-- ─── Markdown Schedule ───────────────────────────────────────────────────────
-- Planned price reductions — can be created manually or by automation rules.

create table if not exists markdown_schedule (
  id              uuid primary key default gen_random_uuid(),
  item_id         uuid not null references inventory_items(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  current_price   numeric(10,2) not null,
  target_price    numeric(10,2) not null,
  markdown_pct    numeric(5,2) not null,
  scheduled_for   timestamptz not null,
  status          text not null default 'pending'
                    check (status in ('pending','applied','cancelled','expired')),
  triggered_by    text not null default 'manual',
  applied_at      timestamptz,
  created_at      timestamptz not null default now()
);

alter table markdown_schedule enable row level security;
create policy "Users manage own markdown schedule"
  on markdown_schedule for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_markdown_schedule_user_id
  on markdown_schedule (user_id, status, scheduled_for);
create index if not exists idx_markdown_schedule_item_id
  on markdown_schedule (item_id, status);
