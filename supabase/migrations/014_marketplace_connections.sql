-- Marketplace connections: OAuth tokens and sync status per user per platform.

create table if not exists marketplace_connections (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users(id) on delete cascade,
  platform         text        not null check (platform in ('ebay','poshmark','mercari','depop','facebook','stockx','goat','whatnot','grailed')),
  status           text        not null default 'disconnected'
                               check (status in ('connected','disconnected','expired','error','pending')),
  account_name     text,
  account_id       text,
  access_token     text,
  refresh_token    text,
  token_expires_at timestamptz,
  scopes           text[],
  last_sync_at     timestamptz,
  last_sync_error  text,
  sync_enabled     boolean     not null default true,
  metadata         jsonb       not null default '{}',
  connected_at     timestamptz,
  disconnected_at  timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  unique (user_id, platform)
);

create index marketplace_connections_user
  on marketplace_connections (user_id);

create index marketplace_connections_user_status
  on marketplace_connections (user_id, status);

alter table marketplace_connections enable row level security;

create policy "Users manage own connections"
  on marketplace_connections for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
