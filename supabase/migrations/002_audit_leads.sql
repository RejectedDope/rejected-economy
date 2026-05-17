-- ============================================================
-- RESALEIQ — Audit Leads Table
-- by Rejected Economy
-- Captures free recovery audit submissions from /recovery-audit.
-- RLS: public insert only. No public select/update/delete.
-- ============================================================

create table if not exists audit_leads (
  id               uuid         primary key default gen_random_uuid(),
  created_at       timestamptz  not null    default now(),

  -- Contact
  name             text         not null,
  email            text         not null,

  -- Intake fields
  -- Plain text, not platform_type enum — audit form includes options
  -- (Vinted, Multiple platforms, Antique booth) not in the main enum.
  primary_platform text         not null,
  inventory_count  text         not null,
  biggest_problem  text         not null,

  -- Optional enrichment
  listing_url      text,
  notes            text,

  -- Internal workflow
  status           text         not null    default 'new',
  source           text         not null    default 'recovery_audit'
);

-- ──────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- Public can insert. Nobody can read, update, or delete
-- via the anon key — leads are write-only from the client.
-- ──────────────────────────────────────────────────────────

alter table audit_leads enable row level security;

-- Allow anyone (including unauthenticated visitors) to submit a lead.
create policy "public_insert_audit_leads"
  on audit_leads
  for insert
  with check (true);

-- Authenticated users (service role / admin) can read leads.
-- No explicit policy means the anon role cannot select at all.
-- Add a service-role or authenticated-only select policy here when
-- you build the admin lead review view.
