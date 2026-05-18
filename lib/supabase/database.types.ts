// ============================================================
// RESALEIQ — Supabase Database Types
// Keep in sync with supabase/migrations/
// Last updated: migrations 001 + 002 + 003
// ============================================================
//
// KNOWN DIVERGENCES (track until resolved):
//   1. recovery_action_type enum has 'adjust_shipping' — lib/types.ts RecoveryAction
//      has 'title_rewrite' instead. Title rewrite exists only in application logic.
//      Fix: add 'title_rewrite' to enum in a future migration.
//
//   2. scoring_snapshots has 4 component columns (days, specifics, photos, title) but
//      the scoring engine (lib/scoring.ts) computes 7 factors. Missing from DB:
//      pricing_competitiveness, visibility_signals, shipping_competitiveness.
//      Fix: add 3 columns in a future migration.
//
//   3. audit_leads.status is unconstrained text — any string is accepted.
//      The admin table expects only 'new' | 'reviewed' | 'contacted'.
//      Fix: add a CHECK constraint or convert to enum in a future migration.
// ============================================================

// ─── Enum types (standalone — used by table types below) ─────────────────────

export type PlatformType =
  | "eBay"
  | "Poshmark"
  | "Mercari"
  | "Depop"
  | "Facebook Marketplace"
  | "StockX"
  | "GOAT"
  | "Whatnot"
  | "Grailed"
  | "Other";

export type DbItemStatus = "active" | "sold" | "ended" | "draft" | "relisted";

export type DbShippingType = "free" | "calculated" | "flat" | "local_pickup";

// NOTE: enum has 'adjust_shipping', NOT 'title_rewrite'
// lib/types.ts RecoveryAction has 'title_rewrite', NOT 'adjust_shipping'
export type RecoveryActionType =
  | "relist_now"
  | "strategic_markdown"
  | "bundle"
  | "move_platform"
  | "optimize_specifics"
  | "add_photos"
  | "liquidate"
  | "hold"
  | "sell_similar"
  | "adjust_shipping";

export type ActionStatus = "pending" | "completed" | "skipped" | "snoozed";

export type VisibilityRiskLevel = "Low" | "Medium" | "High" | "Critical";

// ─── Table Row types (standalone) ─────────────────────────────────────────────

export type InventoryItemRow = {
  id: string;
  user_id: string;
  title: string;
  platform: PlatformType;
  category: string | null;
  subcategory: string | null;
  price: number;
  original_price: number | null;
  cost_basis: number | null;
  days_listed: number;
  date_listed: string | null;
  item_specifics_complete: boolean;
  image_count: number;
  title_keyword_strength: number;
  has_promoted_listing: boolean;
  shipping_type: DbShippingType;
  shipping_cost: number | null;
  views: number;
  watchers: number;
  impressions: number;
  status: DbItemStatus;
  platform_listing_id: string | null;
  external_url: string | null;
  dead_inventory_score: number | null;
  listing_health_score: number | null;
  visibility_risk: VisibilityRiskLevel | null;
  primary_recovery_action: RecoveryActionType | null;
  estimated_recovery: number | null;
  last_scored_at: string | null;
  notes: string | null;
  tags: string[] | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
};

export type InventoryItemInsert = {
  id?: string;
  user_id: string;
  title: string;
  platform?: PlatformType;
  category?: string | null;
  subcategory?: string | null;
  price: number;
  original_price?: number | null;
  cost_basis?: number | null;
  days_listed?: number;
  date_listed?: string | null;
  item_specifics_complete?: boolean;
  image_count?: number;
  title_keyword_strength?: number;
  has_promoted_listing?: boolean;
  shipping_type?: DbShippingType;
  shipping_cost?: number | null;
  views?: number;
  watchers?: number;
  impressions?: number;
  status?: DbItemStatus;
  platform_listing_id?: string | null;
  external_url?: string | null;
  dead_inventory_score?: number | null;
  listing_health_score?: number | null;
  visibility_risk?: VisibilityRiskLevel | null;
  primary_recovery_action?: RecoveryActionType | null;
  estimated_recovery?: number | null;
  last_scored_at?: string | null;
  notes?: string | null;
  tags?: string[] | null;
  image_url?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type PriceHistoryRow = {
  id: string;
  item_id: string;
  user_id: string;
  old_price: number | null;
  new_price: number;
  change_pct: number | null;
  change_type: "markdown" | "relist" | "correction" | "sale" | "increase";
  triggered_by: "user" | "recovery_action" | "csv_import" | null;
  notes: string | null;
  created_at: string;
};

export type PriceHistoryInsert = {
  id?: string;
  item_id: string;
  user_id: string;
  old_price?: number | null;
  new_price: number;
  change_pct?: number | null;
  change_type: "markdown" | "relist" | "correction" | "sale" | "increase";
  triggered_by?: "user" | "recovery_action" | "csv_import" | null;
  notes?: string | null;
  created_at?: string;
};

export type RecoveryActionRow = {
  id: string;
  item_id: string;
  user_id: string;
  action_type: RecoveryActionType;
  action_status: ActionStatus;
  dead_score_snapshot: number | null;
  price_snapshot: number | null;
  days_listed_snapshot: number | null;
  visibility_risk_snapshot: VisibilityRiskLevel | null;
  outcome: "sold" | "still_active" | "ended" | "no_change" | null;
  days_to_outcome: number | null;
  recovery_amount: number | null;
  notes: string | null;
  snoozed_until: string | null;
  completed_at: string | null;
  created_at: string;
};

export type RecoveryActionInsert = {
  id?: string;
  item_id: string;
  user_id: string;
  action_type: RecoveryActionType;
  action_status?: ActionStatus;
  dead_score_snapshot?: number | null;
  price_snapshot?: number | null;
  days_listed_snapshot?: number | null;
  visibility_risk_snapshot?: VisibilityRiskLevel | null;
  outcome?: "sold" | "still_active" | "ended" | "no_change" | null;
  days_to_outcome?: number | null;
  recovery_amount?: number | null;
  notes?: string | null;
  snoozed_until?: string | null;
  completed_at?: string | null;
  created_at?: string;
};

export type ScoringSnapshotRow = {
  id: string;
  item_id: string;
  user_id: string;
  dead_inventory_score: number;
  listing_health_score: number;
  visibility_risk: VisibilityRiskLevel;
  primary_action: RecoveryActionType | null;
  estimated_recovery: number | null;
  // 4 of 7 engine factors stored (see divergence note above)
  score_days_component: number | null;
  score_specifics_component: number | null;
  score_photos_component: number | null;
  score_title_component: number | null;
  sell_through_probability: number | null;
  recovery_probability: number | null;
  pricing_risk: string | null;
  price_at_snapshot: number | null;
  days_at_snapshot: number | null;
  scored_at: string;
};

export type ScoringSnapshotInsert = {
  id?: string;
  item_id: string;
  user_id: string;
  dead_inventory_score: number;
  listing_health_score: number;
  visibility_risk: VisibilityRiskLevel;
  primary_action?: RecoveryActionType | null;
  estimated_recovery?: number | null;
  score_days_component?: number | null;
  score_specifics_component?: number | null;
  score_photos_component?: number | null;
  score_title_component?: number | null;
  sell_through_probability?: number | null;
  recovery_probability?: number | null;
  pricing_risk?: string | null;
  price_at_snapshot?: number | null;
  days_at_snapshot?: number | null;
  scored_at?: string;
};

export type UserSettingsRow = {
  id: string;
  user_id: string;
  primary_platform: PlatformType | null;
  active_platforms: string[] | null;
  ebay_fee_pct: number | null;
  poshmark_fee_pct: number | null;
  mercari_fee_pct: number | null;
  depop_fee_pct: number | null;
  avg_shipping_cost: number | null;
  free_shipping_threshold: number | null;
  stale_warning_days: number;
  stale_critical_days: number;
  dead_threshold_days: number;
  notify_critical_items: boolean;
  notify_weekly_report: boolean;
  notify_new_death_pile: boolean;
  created_at: string;
  updated_at: string;
};

export type UserSettingsInsert = {
  id?: string;
  user_id: string;
  primary_platform?: PlatformType | null;
  active_platforms?: string[] | null;
  ebay_fee_pct?: number | null;
  poshmark_fee_pct?: number | null;
  mercari_fee_pct?: number | null;
  depop_fee_pct?: number | null;
  avg_shipping_cost?: number | null;
  free_shipping_threshold?: number | null;
  stale_warning_days?: number;
  stale_critical_days?: number;
  dead_threshold_days?: number;
  notify_critical_items?: boolean;
  notify_weekly_report?: boolean;
  notify_new_death_pile?: boolean;
  created_at?: string;
  updated_at?: string;
};

// Core lead capture (migration 002) + scoring (migration 003)
export type AuditLeadRow = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  primary_platform: string;
  inventory_count: string;
  biggest_problem: string;
  listing_url: string | null;
  notes: string | null;
  // 'new' | 'reviewed' | 'contacted' — unconstrained in DB, CHECK constraint needed
  status: string;
  source: string;
  // Added by migration 003:
  severity_score: number | null;
  recovery_est_low: number | null;
  recovery_est_high: number | null;
  suggested_action: string | null;
  reviewed_at: string | null;
};

export type AuditLeadInsert = {
  id?: string;
  created_at?: string;
  name: string;
  email: string;
  primary_platform: string;
  inventory_count: string;
  biggest_problem: string;
  listing_url?: string | null;
  notes?: string | null;
  status?: string;
  source?: string;
  severity_score?: number | null;
  recovery_est_low?: number | null;
  recovery_est_high?: number | null;
  suggested_action?: string | null;
  reviewed_at?: string | null;
};

export type AuditLeadUpdate = Partial<AuditLeadInsert>;

// ─── Full Database type (for typed Supabase client) ──────────────────────────
// Structured to satisfy @supabase/supabase-js GenericSchema constraint.

export type Database = {
  public: {
    Tables: {
      inventory_items: {
        Row: InventoryItemRow;
        Insert: InventoryItemInsert;
        Update: Partial<InventoryItemInsert>;
        Relationships: [];
      };
      price_history: {
        Row: PriceHistoryRow;
        Insert: PriceHistoryInsert;
        Update: Partial<PriceHistoryInsert>;
        Relationships: [];
      };
      recovery_actions: {
        Row: RecoveryActionRow;
        Insert: RecoveryActionInsert;
        Update: Partial<RecoveryActionInsert>;
        Relationships: [];
      };
      scoring_snapshots: {
        Row: ScoringSnapshotRow;
        Insert: ScoringSnapshotInsert;
        Update: Partial<ScoringSnapshotInsert>;
        Relationships: [];
      };
      user_settings: {
        Row: UserSettingsRow;
        Insert: UserSettingsInsert;
        Update: Partial<UserSettingsInsert>;
        Relationships: [];
      };
      audit_leads: {
        Row: AuditLeadRow;
        Insert: AuditLeadInsert;
        Update: Partial<AuditLeadInsert>;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      sync_days_listed: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      get_trapped_cash: {
        Args: { p_user_id: string };
        Returns: number;
      };
    };
    Enums: {
      platform_type: PlatformType;
      item_status: DbItemStatus;
      shipping_type: DbShippingType;
      recovery_action_type: RecoveryActionType;
      action_status: ActionStatus;
      visibility_risk: VisibilityRiskLevel;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
