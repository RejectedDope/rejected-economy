// ============================================================
// RESALEIQ — Inventory Item Test Fixtures
// Realistic scenarios for scoring engine validation.
// Import in tests or use in dev seeding.
// ============================================================

import type { InventoryItem } from "@/lib/types";

// ─── Scenario 1: Perfectly Healthy Listing ────────────────────────────────────
// New listing, great quality, strong engagement.
// Expected: dead_score ~0–5, health_score ~90+, risk Low, action: hold
export const healthyNewListing: InventoryItem = {
  id: "fix-001",
  user_id: "test-user",
  title: "Nike Air Max 90 Rattan Sail Wheat Mens Size 11 DS OG Box 325213-202",
  platform: "eBay",
  category: "Sneakers",
  price: 185,
  original_price: 185,
  days_listed: 8,
  item_specifics_complete: true,
  image_count: 12,
  title_keyword_strength: 88,
  has_promoted_listing: false,
  shipping_type: "free",
  views: 42,
  watchers: 7,
  impressions: 310,
  status: "active",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ─── Scenario 2: Price Rejection Signal ───────────────────────────────────────
// 90 days in, high views, zero watchers. Textbook overpriced listing.
// Expected: dead_score 50–65, risk High, action: strategic_markdown
export const priceRejectedListing: InventoryItem = {
  id: "fix-002",
  user_id: "test-user",
  title: "Vintage Levi's 501 Jeans 34x32 Blue Denim",
  platform: "Poshmark",
  category: "Jeans",
  price: 85,
  original_price: 85,
  days_listed: 94,
  item_specifics_complete: true,
  image_count: 6,
  title_keyword_strength: 72,
  has_promoted_listing: false,
  shipping_type: "flat",
  shipping_cost: 7.95,
  views: 143,
  watchers: 0,
  impressions: 890,
  status: "active",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ─── Scenario 3: Buried by Missing Specifics ──────────────────────────────────
// Good title, plenty of photos, but no item specifics filled in.
// Invisible in filtered searches. Expected: dead_score 30–45, risk Medium,
// action: optimize_specifics
export const missingSpecificsListing: InventoryItem = {
  id: "fix-003",
  user_id: "test-user",
  title: "Coach Leather Crossbody Bag Brown Tan Pebbled Gold Hardware Shoulder",
  platform: "eBay",
  category: "Handbags",
  price: 68,
  original_price: 68,
  days_listed: 45,
  item_specifics_complete: false,  // problem: Cassini filter penalty
  image_count: 8,
  title_keyword_strength: 81,
  has_promoted_listing: false,
  shipping_type: "calculated",
  views: 19,
  watchers: 0,
  impressions: 62,
  status: "active",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ─── Scenario 4: Death Pile — Maximum Risk ────────────────────────────────────
// 240 days listed, 1 photo, weak title, no specifics, no watchers,
// shipping cost exceeds 25% of price. Every factor stacked against it.
// Expected: dead_score 85+, risk Critical, action: relist_now
export const maximumDeadListing: InventoryItem = {
  id: "fix-004",
  user_id: "test-user",
  title: "Vintage shirt mens",          // weak: too vague, 15 chars
  platform: "eBay",
  category: "Shirts",
  price: 22,
  original_price: 22,
  days_listed: 242,
  item_specifics_complete: false,
  image_count: 1,                       // worst photo coverage
  title_keyword_strength: 20,           // very weak
  has_promoted_listing: false,
  shipping_type: "flat",
  shipping_cost: 8.50,                  // 38% of price — kills conversion
  views: 31,
  watchers: 0,
  impressions: 98,
  status: "active",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ─── Scenario 5: Liquidation Candidate (365+ days) ───────────────────────────
// Over a year old. The market has permanently priced this out.
// Expected: dead_score 90+, risk Critical, action: liquidate
export const abandonedListing: InventoryItem = {
  id: "fix-005",
  user_id: "test-user",
  title: "Tiffany Sterling Silver Ring Size 7",
  platform: "eBay",
  category: "Jewelry",
  price: 120,
  original_price: 120,
  days_listed: 412,
  item_specifics_complete: true,
  image_count: 5,
  title_keyword_strength: 65,
  has_promoted_listing: false,
  shipping_type: "free",
  views: 218,
  watchers: 0,
  impressions: 1200,
  status: "active",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ─── Scenario 6: Underpriced — Strong Demand Signal ──────────────────────────
// 12% watcher rate — buyers are interested but the price should be higher.
// Expected: pricing analysis → underpriced, action: hold (price IS working)
export const underpricedListing: InventoryItem = {
  id: "fix-006",
  user_id: "test-user",
  title: "Pokemon 1st Edition Base Set Charizard Holo PSA 9 BGS Card",
  platform: "eBay",
  category: "Trading Cards",
  price: 800,
  original_price: 800,
  days_listed: 12,
  item_specifics_complete: true,
  image_count: 15,
  title_keyword_strength: 95,
  has_promoted_listing: true,
  shipping_type: "free",
  views: 280,
  watchers: 34,           // 12.1% watcher rate — strong demand signal
  impressions: 1800,
  status: "active",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ─── Scenario 7: Weak Title Only ─────────────────────────────────────────────
// Everything else OK, but the title is killing impressions.
// Expected: dead_score 15–25, risk Low/Medium, action: title_rewrite
export const weakTitleListing: InventoryItem = {
  id: "fix-007",
  user_id: "test-user",
  title: "Blue dress size M",            // only 16 chars, no brand/style keywords
  platform: "Mercari",
  category: "Dresses",
  price: 38,
  original_price: 42,
  days_listed: 28,
  item_specifics_complete: true,
  image_count: 7,
  title_keyword_strength: 28,           // poor: missing brand, size, color detail
  has_promoted_listing: false,
  shipping_type: "free",
  views: 4,
  watchers: 0,
  impressions: 11,
  status: "active",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ─── Scenario 8: Low-Value With High Shipping ────────────────────────────────
// $12 item, $5.50 shipping — a 45% shipping ratio. Conversion killer.
// Expected: dead_score 25–40, action: bundle or liquidate
export const highShippingLowValueListing: InventoryItem = {
  id: "fix-008",
  user_id: "test-user",
  title: "Vintage Avon Perfume Bottle Collectible Glass 1970s Unused",
  platform: "eBay",
  category: "Collectibles",
  price: 12,
  days_listed: 67,
  item_specifics_complete: true,
  image_count: 4,
  title_keyword_strength: 70,
  has_promoted_listing: false,
  shipping_type: "flat",
  shipping_cost: 5.50,               // 45% of price
  views: 28,
  watchers: 1,
  impressions: 140,
  status: "active",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const ALL_FIXTURES: InventoryItem[] = [
  healthyNewListing,
  priceRejectedListing,
  missingSpecificsListing,
  maximumDeadListing,
  abandonedListing,
  underpricedListing,
  weakTitleListing,
  highShippingLowValueListing,
];

// ─── Expected scoring outputs for validation ──────────────────────────────────
// These are the ground-truth expectations for each fixture.
// If scoring engine changes break these, the change needs justification.

export const EXPECTED_OUTPUTS = {
  "fix-001": { minHealth: 85, maxDead: 10, risk: "Low",     action: "hold" },
  "fix-002": { minHealth: 50, minDead: 48, risk: "High",    action: "strategic_markdown" },
  "fix-003": { minHealth: 30, minDead: 25, risk: "Medium",  action: "optimize_specifics" },
  "fix-004": { minHealth: 0,  minDead: 80, risk: "Critical",action: "relist_now" },
  "fix-005": { minHealth: 0,  minDead: 70, risk: "Critical",action: "liquidate" },
  "fix-006": { minHealth: 80, maxDead: 15, risk: "Low",     action: "hold" },
  "fix-007": { minHealth: 30, minDead: 10, risk: "Low",     action: "title_rewrite" },
  "fix-008": { minHealth: 40, minDead: 20, risk: "Medium",  action: "strategic_markdown" },
} as const;
