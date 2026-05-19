-- ============================================================
-- RESALEIQ — Performance Indexes & Query Optimizations
-- Migration 006: Additional indexes for common query patterns
-- ============================================================
-- Additive only. No schema changes to existing tables.
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- INVENTORY ITEMS — high-frequency query patterns
-- ──────────────────────────────────────────────────────────

-- Dashboard: active items sorted by dead_inventory_score
create index if not exists idx_inventory_dead_score
  on inventory_items (user_id, dead_inventory_score desc)
  where status = 'active';

-- Recovery page: items with high score + active status
create index if not exists idx_inventory_critical
  on inventory_items (user_id, days_listed desc)
  where status = 'active' and dead_inventory_score >= 75;

-- Inventory list: platform filter
create index if not exists idx_inventory_platform
  on inventory_items (user_id, platform, status);

-- Dedup queries: title prefix for similarity matching
create index if not exists idx_inventory_title_prefix
  on inventory_items using gin (to_tsvector('english', title))
  where status = 'active';

-- ──────────────────────────────────────────────────────────
-- SCORING SNAPSHOTS — trend queries
-- ──────────────────────────────────────────────────────────

-- Per-item trend lookups (most common query)
create index if not exists idx_snapshots_item_recent
  on scoring_snapshots (item_id, scored_at desc);

-- Dedup window check: most recent per user
create index if not exists idx_snapshots_user_recent
  on scoring_snapshots (user_id, scored_at desc);

-- ──────────────────────────────────────────────────────────
-- RECOVERY ACTIONS — effectiveness analytics
-- ──────────────────────────────────────────────────────────

-- Action effectiveness grouping
create index if not exists idx_recovery_action_type
  on recovery_actions (user_id, action_type, action_status, outcome);

-- Per-item history (item detail page)
create index if not exists idx_recovery_item_history
  on recovery_actions (item_id, created_at desc);

-- ──────────────────────────────────────────────────────────
-- PORTFOLIO METRICS — trend dashboard
-- ──────────────────────────────────────────────────────────

create index if not exists idx_portfolio_metrics_trend
  on portfolio_metrics (user_id, metric_date desc);

-- ──────────────────────────────────────────────────────────
-- USER SETTINGS — single-row lookup
-- ──────────────────────────────────────────────────────────

create index if not exists idx_user_settings_user
  on user_settings (user_id);
