-- Automation task pipeline: queued evaluation results pending user review / execution.
-- Tasks are created by the rule evaluation engine and progress through a 7-step lifecycle.

create type automation_task_status as enum (
  'queued',
  'pending_review',
  'approved',
  'completed',
  'skipped',
  'failed',
  'expired'
);

create table if not exists automation_tasks (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  rule_id         uuid references automation_rules(id) on delete set null,
  rule_type       text not null check (rule_type in ('stale_alert','auto_markdown','auto_relist','auto_crosslist')),
  item_id         uuid references inventory_items(id) on delete cascade,

  -- What the engine recommends
  suggested_action text not null,
  alert_message    text,

  -- Lifecycle
  status          automation_task_status not null default 'queued',
  queued_at       timestamptz not null default now(),
  reviewed_at     timestamptz,
  completed_at    timestamptz,
  expires_at      timestamptz default (now() + interval '7 days'),

  -- Snapshot context at evaluation time
  dead_score_snapshot  integer,
  days_listed_snapshot integer,
  price_snapshot       numeric(10,2),

  -- Outcome (filled after completion)
  outcome_notes   text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index automation_tasks_user_status on automation_tasks (user_id, status);
create index automation_tasks_item_id     on automation_tasks (item_id);
create index automation_tasks_expires_at  on automation_tasks (expires_at) where status = 'queued';

alter table automation_tasks enable row level security;

create policy "Users manage own automation tasks"
  on automation_tasks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Automation run log: records each time the engine was evaluated for a user.
create table if not exists automation_runs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  triggered_by    text not null default 'manual' check (triggered_by in ('manual','scheduled','import')),
  rules_evaluated integer not null default 0,
  tasks_created   integer not null default 0,
  items_scanned   integer not null default 0,
  ran_at          timestamptz not null default now()
);

create index automation_runs_user_id on automation_runs (user_id, ran_at desc);

alter table automation_runs enable row level security;

create policy "Users view own automation runs"
  on automation_runs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
