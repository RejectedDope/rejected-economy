-- Operational event telemetry for retention signals and usage analytics.
-- Stores lightweight events keyed by user, category, and event type.

create table if not exists operational_events (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  event_type   text        not null,
  category     text        not null check (category in ('import','automation','recovery','integration','inventory','session')),
  properties   jsonb       not null default '{}',
  occurred_at  timestamptz not null default now()
);

-- Efficient per-user event history queries
create index operational_events_user_occurred
  on operational_events (user_id, occurred_at desc);

-- Category rollups (e.g. "how many imports this week?")
create index operational_events_user_category_occurred
  on operational_events (user_id, category, occurred_at desc);

-- Event-type lookups for specific signal detection
create index operational_events_user_type_occurred
  on operational_events (user_id, event_type, occurred_at desc);

alter table operational_events enable row level security;

create policy "Users read own events"
  on operational_events for select
  using (auth.uid() = user_id);

-- Service role inserts; user-facing reads only
create policy "Service inserts events"
  on operational_events for insert
  with check (true);
