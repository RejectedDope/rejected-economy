-- ============================================================
-- RESALEIQ — Audit Lead Scoring & Admin Access
-- Adds: scoring output columns + authenticated read/update RLS
-- Run after 002_audit_leads.sql
-- ============================================================

-- ── Scoring columns ───────────────────────────────────────────
alter table audit_leads
  add column if not exists severity_score      integer,
  add column if not exists recovery_est_low    integer,
  add column if not exists recovery_est_high   integer,
  add column if not exists suggested_action    text,
  add column if not exists reviewed_at         timestamptz;

-- ── Admin RLS ─────────────────────────────────────────────────
-- Authenticated users (logged-in admin) can read all leads.
create policy "auth_select_audit_leads"
  on audit_leads
  for select
  to authenticated
  using (true);

-- Authenticated users can update status and review fields.
create policy "auth_update_audit_leads"
  on audit_leads
  for update
  to authenticated
  using (true)
  with check (true);
