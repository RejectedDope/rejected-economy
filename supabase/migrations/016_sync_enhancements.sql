-- Sync enhancements: adds sync_source to inventory_items and creates execution_queue table.

-- ─── inventory_items: sync_source column ──────────────────────────────────────

alter table inventory_items
  add column if not exists sync_source text
    check (sync_source in ('csv_import', 'ocr_import', 'ebay_sync', 'manual'));

create index if not exists inventory_items_user_sync_source
  on inventory_items (user_id, sync_source)
  where sync_source is not null;

-- ─── execution_queue ──────────────────────────────────────────────────────────
-- Stores pending and historical automation/sync actions awaiting approval or execution.

create table if not exists execution_queue (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users(id) on delete cascade,
  item_id          uuid        references inventory_items(id) on delete set null,
  action_type      text        not null,
  action_payload   jsonb       not null default '{}',
  status           text        not null default 'pending'
                               check (status in ('pending','approved','rejected','executing','completed','failed','expired')),
  source           text        not null default 'manual'
                               check (source in ('manual','automation','sync')),
  approved_at      timestamptz,
  rejected_at      timestamptz,
  executed_at      timestamptz,
  completed_at     timestamptz,
  error_message    text,
  expires_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Indexes --------------------------------------------------------------------

create index if not exists execution_queue_user_status
  on execution_queue (user_id, status);

create index if not exists execution_queue_user_created
  on execution_queue (user_id, created_at desc);

-- Row-level security ---------------------------------------------------------

alter table execution_queue enable row level security;

create policy "Users manage own execution queue"
  on execution_queue for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
