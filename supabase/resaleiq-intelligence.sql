-- ResaleIQ Evidence Graph
-- Run in Supabase SQL editor after review.

create extension if not exists pgcrypto;

create table if not exists public.resale_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid,
  sku text,
  title text,
  category text,
  brand text,
  model text,
  condition text,
  acquisition_cost numeric(12,2),
  status text not null default 'researching',
  best_platform text,
  recommended_list_price numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.resale_evidence (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.resale_items(id) on delete cascade,
  evidence_type text not null check (evidence_type in (
    'identity', 'sold_comp', 'active_comp', 'official_product',
    'community_signal', 'policy', 'seller_observation'
  )),
  source_name text,
  source_url text,
  source_external_id text,
  observed_value numeric(12,2),
  currency text,
  payload jsonb not null default '{}'::jsonb,
  observed_at timestamptz,
  collected_at timestamptz not null default now()
);

create table if not exists public.resale_decisions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.resale_items(id) on delete cascade,
  decision_type text not null,
  recommendation text not null,
  rationale text,
  assumptions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.resale_listings (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.resale_items(id) on delete cascade,
  marketplace text not null,
  external_listing_id text,
  listing_url text,
  title text,
  list_price numeric(12,2),
  status text not null default 'draft',
  listed_at timestamptz,
  ended_at timestamptz,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.resale_offers (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.resale_listings(id) on delete cascade,
  amount numeric(12,2) not null,
  direction text,
  status text,
  received_at timestamptz not null default now()
);

create table if not exists public.resale_sales (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.resale_items(id) on delete cascade,
  listing_id uuid references public.resale_listings(id) on delete set null,
  marketplace text not null,
  sale_price numeric(12,2) not null,
  marketplace_fees numeric(12,2),
  seller_shipping numeric(12,2),
  packaging_cost numeric(12,2),
  net_proceeds numeric(12,2),
  sold_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists resale_evidence_item_id_idx on public.resale_evidence(item_id);
create index if not exists resale_evidence_type_idx on public.resale_evidence(evidence_type);
create index if not exists resale_listings_item_id_idx on public.resale_listings(item_id);
create index if not exists resale_listings_status_idx on public.resale_listings(status);
create index if not exists resale_sales_item_id_idx on public.resale_sales(item_id);

comment on table public.resale_evidence is
'Never collapse active_comp and sold_comp into one evidence type. Active asking prices are not realized sales.';
