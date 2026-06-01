// ============================================================
// RESALEIQ — Type Definitions
// by Rejected Economy
// Single source of truth for all TypeScript interfaces.
// Must stay in sync with supabase/migrations/001_initial_schema.sql
// ============================================================

// ─── Primitive Enums ─────────────────────────────────────────────────────────

export type Platform =
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

export type ItemStatus = "active" | "sold" | "ended" | "draft" | "relisted";

export type ShippingType = "free" | "calculated" | "flat" | "local_pickup";

// ─── Inventory Lifecycle ──────────────────────────────────────────────────────
// Operational health stage of a listing.
// Derived from age + scoring signals, NOT from ItemStatus.

export type LifecycleStage =
  | "newly_imported"   // < 14 days — peak organic visibility
  | "active"           // 14–60 days — performing within normal range
  | "slowing"          // 60–90 days — engagement declining, approaching cliff
  | "stale"            // 90–180 days — past the freshness cliff
  | "critical"         // 180+ days — deep decay, immediate action needed
  | "liquidating"      // marked for clearance pricing
  | "sold"             // completed sale
  | "archived";        // ended/removed

// Recovery event tracking types
export type RecoveryEventType =
  | "markdown_performed"
  | "relisted"
  | "sell_similar_used"
  | "promoted"
  | "crosslisted"
  | "bundled"
  | "liquidated"
  | "title_rewritten"
  | "photos_updated"
  | "specifics_completed"
  | "sold"
  | "ended";

// ─── Scoring & Risk Types ─────────────────────────────────────────────────────

// Dead Inventory Score risk tiers
// Low 0–29 | Medium 30–49 | High 50–74 | Critical 75–100
export type VisibilityRisk = "Low" | "Medium" | "High" | "Critical";

// Pricing risk — is the price the barrier to sale?
// Derived from listing age + listing quality (good listing, still not selling = price issue)
export type PricingRisk = "Low" | "Medium" | "High" | "Critical";

// How saturated the market is for this category/item
export type SaturationLevel = "Low" | "Medium" | "High";

// How fast this type of item typically moves on this platform
export type SellThroughVelocity = "Fast" | "Normal" | "Slow" | "Stalled";

// ─── Recovery Action Types ───────────────────────────────────────────────────

export type RecoveryAction =
  | "relist_now"         // End + create fresh listing (resets impressions clock)
  | "sell_similar"       // eBay: Sell Similar — fresh listing copy, original stays active
  | "strategic_markdown" // Price drop to trigger watchers + Recently Lowered filter
  | "title_rewrite"      // Rewrite title for better keyword coverage (free, no relist)
  | "bundle"             // Group with similar low-value items, single listing
  | "move_platform"      // Cross-list or migrate to better-fit marketplace
  | "optimize_specifics" // Fill all item specifics fields (eBay Cassini critical)
  | "add_photos"         // Add 4–12 photos minimum to improve CTR
  | "liquidate"          // Price to move at 20–30 cents on the dollar
  | "hold";              // Within normal sell-through window, monitor only

export type ActionUrgency = "immediate" | "this_week" | "this_month";

// Pricing Intelligence — how the listed price compares to market signals
export type PricingPosition =
  | "overpriced"             // Views without watchers — buyers rejecting the price
  | "competitive"            // Engagement signals consistent with market price
  | "underpriced"            // Strong watcher rate — could likely price higher
  | "liquidation_candidate"; // 365d+ with no traction — market has spoken

export interface PricingAnalysis {
  position: PricingPosition;
  label: string;
  confidence: "high" | "medium" | "low";
  signals: string[];
  suggested_markdown_pct?: number; // e.g. 0.15 = reduce by 15%
}

// ─── Core Inventory Item ─────────────────────────────────────────────────────

export interface InventoryItem {
  // Identity
  id: string;
  user_id: string;

  // Listing data
  title: string;
  platform: Platform;
  category: string;
  subcategory?: string;

  // Pricing
  price: number;              // current asking price
  original_price?: number;    // first listed price (to track markdown depth)
  cost_basis?: number;        // what you paid — used for net recovery calc

  // Age
  days_listed: number;        // denormalized for query speed; sync from date_listed
  date_listed?: string;       // ISO timestamp of original listing

  // Listing quality signals (scored inputs)
  item_specifics_complete: boolean;
  image_count: number;
  title_keyword_strength: number;   // 0–100; higher = more keyword coverage
  has_promoted_listing: boolean;
  shipping_type: ShippingType;
  shipping_cost?: number;

  // Engagement metrics (optional — from platform CSV exports)
  views: number;
  watchers: number;
  impressions: number;

  // Status
  status: ItemStatus;
  platform_listing_id?: string;  // eBay item number, Poshmark listing ID, etc.
  external_url?: string;

  // Cached scoring (populated by scoring engine, stored for fast reads)
  dead_inventory_score?: number;
  listing_health_score?: number;
  visibility_risk?: VisibilityRisk;
  primary_recovery_action?: RecoveryAction;
  estimated_recovery?: number;
  last_scored_at?: string;

  // User-added
  notes?: string;
  tags?: string[];
  image_url?: string;

  created_at: string;
  updated_at: string;
}

// ─── Scored Item ─────────────────────────────────────────────────────────────
// Output of the scoring engine. Required fields (not optional like cache above).

export interface ScoredItem extends InventoryItem {
  dead_inventory_score: number;
  listing_health_score: number;
  visibility_risk: VisibilityRisk;
  primary_recovery_action: RecoveryAction;
  estimated_recovery: number;
}

// ─── Recovery Analysis ───────────────────────────────────────────────────────
// Full output of the recovery engine for a single item.
// Combines scoring + marketplace heuristics + platform guidance.

export interface RecoveryAnalysis {
  item_id: string;
  analyzed_at: string;

  // Core scores (from scoring engine)
  dead_risk_score: number;
  listing_health_score: number;
  visibility_risk: VisibilityRisk;

  // Extended market analysis (from recovery engine)
  pricing_risk: PricingRisk;
  competition_saturation: SaturationLevel;
  sell_through_velocity: SellThroughVelocity;

  // Probabilities (0–100)
  sell_through_probability: number;  // chance of selling in next 30d with no changes
  recovery_probability: number;      // chance of selling in next 30d after primary action

  // Recommended actions
  primary_action: RecoveryAction;
  secondary_actions: RecoveryAction[];

  // Step-by-step platform guidance
  platform_guidance: PlatformGuidance;

  // Warning signals (what's wrong, why)
  warning_signals: WarningSignal[];

  // Estimated outcomes
  estimated_recovery: number;
  estimated_days_to_sale: number;    // after taking primary action
}

// ─── Platform Guidance ───────────────────────────────────────────────────────

export interface PlatformGuidanceStep {
  instruction: string;
  note?: string;       // "why this step matters"
  critical: boolean;   // if true, shown highlighted
}

export interface PlatformGuidance {
  platform: Platform;
  action: RecoveryAction;
  title: string;
  overview: string;
  steps: PlatformGuidanceStep[];
  platform_tips: string[];        // platform-specific operational notes
  estimated_time_to_outcome: string;
  timing_tip?: string;            // e.g. "Best results posting Tuesday–Thursday 7–9pm"
}

// ─── Warning Signals ─────────────────────────────────────────────────────────

export type SignalSeverity = "info" | "warning" | "danger" | "critical";

export interface WarningSignal {
  code: string;           // machine-readable: 'STALE_LISTING', 'MISSING_SPECIFICS', etc.
  severity: SignalSeverity;
  title: string;
  body: string;           // explanation with reseller-native language
  metric?: string;        // quantified impact: "reduces impressions ~40%"
}

// ─── Price History ───────────────────────────────────────────────────────────

export interface PriceHistoryEntry {
  id: string;
  item_id: string;
  user_id: string;
  old_price?: number;
  new_price: number;
  change_pct?: number;      // negative = markdown
  change_type: "markdown" | "relist" | "correction" | "sale" | "increase";
  triggered_by?: "user" | "recovery_action" | "csv_import";
  notes?: string;
  created_at: string;
}

// ─── Recovery Action Log ─────────────────────────────────────────────────────

export type RecoveryActionStatus = "pending" | "completed" | "skipped" | "snoozed";

export interface RecoveryActionLog {
  id: string;
  item_id: string;
  user_id: string;
  action_type: RecoveryAction;
  action_status: RecoveryActionStatus;

  // State snapshot when action was recommended
  dead_score_snapshot?: number;
  price_snapshot?: number;
  days_listed_snapshot?: number;
  visibility_risk_snapshot?: VisibilityRisk;

  // Outcome (filled in after result is known)
  outcome?: "sold" | "still_active" | "ended" | "no_change";
  days_to_outcome?: number;
  recovery_amount?: number;

  notes?: string;
  snoozed_until?: string;
  completed_at?: string;
  created_at: string;
}

// ─── Scoring Snapshot ────────────────────────────────────────────────────────

export interface ScoringSnapshot {
  id: string;
  item_id: string;
  user_id: string;
  dead_inventory_score: number;
  listing_health_score: number;
  visibility_risk: VisibilityRisk;
  primary_action?: RecoveryAction;
  estimated_recovery?: number;
  // Component breakdown for transparency
  score_days_component: number;
  score_specifics_component: number;
  score_photos_component: number;
  score_title_component: number;
  // Extended analysis
  sell_through_probability?: number;
  recovery_probability?: number;
  pricing_risk?: string;
  price_at_snapshot: number;
  days_at_snapshot: number;
  scored_at: string;
}

// ─── User Settings ───────────────────────────────────────────────────────────

export interface UserSettings {
  id: string;
  user_id: string;
  primary_platform: Platform;
  active_platforms: Platform[];
  // Fee assumptions
  ebay_fee_pct: number;
  poshmark_fee_pct: number;
  mercari_fee_pct: number;
  depop_fee_pct: number;
  // Shipping assumptions
  avg_shipping_cost: number;
  free_shipping_threshold: number;
  // Aging thresholds (days)
  stale_warning_days: number;
  stale_critical_days: number;
  dead_threshold_days: number;
  // Notifications
  notify_critical_items: boolean;
  notify_weekly_report: boolean;
  notify_new_death_pile: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Dashboard Stats ─────────────────────────────────────────────────────────

export interface DashboardStats {
  total_items: number;
  trapped_cash: number;
  dead_inventory_pct: number;
  critical_count: number;
  high_risk_count: number;
  avg_days_listed: number;
  stale_count: number;
  stale_cash: number;
  aging_breakdown: AgingBucket[];
  platform_breakdown: PlatformBucket[];
}

export interface AgingBucket {
  label: string;
  days_min: number;
  days_max: number;
  count: number;
  value: number;
}

export interface PlatformBucket {
  platform: Platform;
  count: number;
  value: number;
  dead_count: number;
}

// ─── Recovery Action Plan ────────────────────────────────────────────────────
// Grouped view used by the Recovery Action Center page

export interface RecoveryActionDetail {
  action: RecoveryAction;
  label: string;
  urgency: ActionUrgency;
  reasoning: string;
  estimated_cash_recovery: number;
  items: ScoredItem[];
}

// ─── Marketplace Heuristics ──────────────────────────────────────────────────
// Per-platform behavioral rules used by the recovery engine

export interface MarketplaceHeuristics {
  platform: Platform;
  algorithm_type: string;
  freshness_cliff_days: number;       // visibility drops sharply after this
  stale_threshold_days: number;       // impressions start decaying
  sell_similar_resets_freshness: boolean;
  item_specifics_critical: boolean;   // false on platforms that don't use them
  sharing_required: boolean;          // Poshmark-specific
  price_edit_resets_position: boolean;// Mercari-specific
  promoted_listings_available: boolean;
  free_shipping_boost: boolean;       // does free shipping improve placement?
  best_offer_available: boolean;
  price_drop_notification_threshold?: number;  // min drop to notify likers
  peak_posting_hours?: string;
  strengths: string[];                // categories that sell well here
  weaknesses: string[];               // categories that underperform here
}

// ─── CSV Import ──────────────────────────────────────────────────────────────

export interface CSVRow {
  [key: string]: string;
}

export interface CSVImportResult {
  imported: number;
  skipped: number;
  errors: string[];
  items: InventoryItem[];
}
