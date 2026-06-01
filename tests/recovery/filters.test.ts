import { describe, it, expect } from "vitest";
import {
  filterRecoveryPlan,
  filterPriorityQueue,
  getAvailablePlatforms,
  type RecoveryFilterState,
} from "@/lib/recovery/filters";
import type { RecoveryActionDetail } from "@/lib/types";
import type { PrioritizedItem } from "@/lib/inventory/prioritization";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseFilters: RecoveryFilterState = {
  urgency: "all",
  platform: "",
  sort: "cash",
};

// Plan entry: urgency "immediate", items on eBay
const planImmediate = {
  action: "relist_now",
  label: "Relist Now",
  urgency: "immediate",
  reasoning: "Past freshness cliff",
  estimated_cash_recovery: 80,
  items: [
    {
      id: "item-1",
      user_id: "u1",
      title: "eBay Sneaker",
      platform: "eBay",
      category: "Sneakers",
      price: 100,
      days_listed: 200,
      item_specifics_complete: true,
      image_count: 8,
      title_keyword_strength: 75,
      has_promoted_listing: false,
      shipping_type: "free",
      views: 50,
      watchers: 2,
      impressions: 300,
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      dead_inventory_score: 85,
      listing_health_score: 30,
      visibility_risk: "Critical",
      primary_recovery_action: "relist_now",
      estimated_recovery: 80,
    },
  ],
} as RecoveryActionDetail;

// Plan entry: urgency "this_week", items on Poshmark
const planThisWeek = {
  action: "strategic_markdown",
  label: "Strategic Markdown",
  urgency: "this_week",
  reasoning: "Price rejection signals",
  estimated_cash_recovery: 150,
  items: [
    {
      id: "item-2",
      user_id: "u1",
      title: "Poshmark Bag",
      platform: "Poshmark",
      category: "Handbags",
      price: 85,
      days_listed: 45,
      item_specifics_complete: true,
      image_count: 6,
      title_keyword_strength: 72,
      has_promoted_listing: false,
      shipping_type: "flat",
      views: 143,
      watchers: 0,
      impressions: 890,
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      dead_inventory_score: 55,
      listing_health_score: 50,
      visibility_risk: "High",
      primary_recovery_action: "strategic_markdown",
      estimated_recovery: 150,
    },
  ],
} as RecoveryActionDetail;

const allPlan: RecoveryActionDetail[] = [planImmediate, planThisWeek];

// PrioritizedItem with urgency_score=80 (immediate-tier), eBay, high recovery
const prioEbay: PrioritizedItem = {
  item: {
    id: "item-1",
    user_id: "u1",
    title: "eBay Sneaker",
    platform: "eBay",
    category: "Sneakers",
    price: 100,
    days_listed: 200,
    item_specifics_complete: true,
    image_count: 8,
    title_keyword_strength: 75,
    has_promoted_listing: false,
    shipping_type: "free",
    views: 50,
    watchers: 2,
    impressions: 300,
    status: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    dead_inventory_score: 85,
    listing_health_score: 30,
    visibility_risk: "Critical",
    primary_recovery_action: "relist_now",
    estimated_recovery: 50,
  },
  urgency_score: 80,
  estimated_recovery: 50,
  action: "relist_now",
  reasoning: "Deep stale listing, past freshness cliff",
  is_quick_win: false,
  effort_level: "low",
  lifecycle_stage: "critical",
  recovery_roi: 70,
};

// PrioritizedItem with urgency_score=30 (this_week-tier), Poshmark, higher recovery
const prioPoshmark: PrioritizedItem = {
  item: {
    id: "item-2",
    user_id: "u1",
    title: "Poshmark Bag",
    platform: "Poshmark",
    category: "Handbags",
    price: 85,
    days_listed: 45,
    item_specifics_complete: true,
    image_count: 6,
    title_keyword_strength: 72,
    has_promoted_listing: false,
    shipping_type: "flat",
    views: 143,
    watchers: 0,
    impressions: 890,
    status: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    dead_inventory_score: 55,
    listing_health_score: 50,
    visibility_risk: "High",
    primary_recovery_action: "strategic_markdown",
    estimated_recovery: 120,
  },
  urgency_score: 30,
  estimated_recovery: 120,
  action: "strategic_markdown",
  reasoning: "Price rejection — high views, zero watchers",
  is_quick_win: true,
  effort_level: "low",
  lifecycle_stage: "slowing",
  recovery_roi: 85,
};

const allPrio: PrioritizedItem[] = [prioEbay, prioPoshmark];

// ─── filterRecoveryPlan ───────────────────────────────────────────────────────

describe("filterRecoveryPlan", () => {
  it("urgency 'all' returns all entries", () => {
    const result = filterRecoveryPlan(allPlan, { ...baseFilters, urgency: "all" });
    expect(result).toHaveLength(2);
  });

  it("urgency 'immediate' filters out this_week entries", () => {
    const result = filterRecoveryPlan(allPlan, { ...baseFilters, urgency: "immediate" });
    expect(result).toHaveLength(1);
    expect(result[0].urgency).toBe("immediate");
  });

  it("platform filter removes entries with no matching items", () => {
    const result = filterRecoveryPlan(allPlan, { ...baseFilters, platform: "eBay" });
    // planImmediate has eBay items; planThisWeek only has Poshmark items
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe("relist_now");
  });

  it("sort 'cash' puts highest estimated_cash_recovery first", () => {
    // planThisWeek has estimated_cash_recovery=150, planImmediate has 80
    const result = filterRecoveryPlan(allPlan, { ...baseFilters, sort: "cash" });
    expect(result[0].estimated_cash_recovery).toBeGreaterThanOrEqual(
      result[1].estimated_cash_recovery,
    );
  });
});

// ─── filterPriorityQueue ──────────────────────────────────────────────────────

describe("filterPriorityQueue", () => {
  it("urgency 'all' returns all items", () => {
    const result = filterPriorityQueue(allPrio, { ...baseFilters, urgency: "all" });
    expect(result).toHaveLength(2);
  });

  it("platform filter keeps only matching platform items", () => {
    const result = filterPriorityQueue(allPrio, { ...baseFilters, platform: "Poshmark" });
    expect(result).toHaveLength(1);
    expect(result[0].item.platform).toBe("Poshmark");
  });

  it("sort 'cash' puts highest estimated_recovery first", () => {
    // prioPoshmark.estimated_recovery=120 > prioEbay.estimated_recovery=50
    const result = filterPriorityQueue(allPrio, { ...baseFilters, sort: "cash" });
    expect(result[0].estimated_recovery).toBeGreaterThanOrEqual(result[1].estimated_recovery);
  });

  it("sort 'age' puts oldest (highest days_listed) first", () => {
    // prioEbay has days_listed=200 > prioPoshmark days_listed=45
    const result = filterPriorityQueue(allPrio, { ...baseFilters, sort: "age" });
    expect(result[0].item.days_listed).toBeGreaterThanOrEqual(result[1].item.days_listed);
  });

  it("sort 'score' puts highest dead_inventory_score first", () => {
    // prioEbay has dead_inventory_score=85 > prioPoshmark=55
    const result = filterPriorityQueue(allPrio, { ...baseFilters, sort: "score" });
    expect(result[0].item.dead_inventory_score).toBeGreaterThanOrEqual(
      result[1].item.dead_inventory_score,
    );
  });

  it("combined urgency + platform filter returns only matching items", () => {
    // urgency_score=80 => "immediate" tier, platform="eBay"
    // Only prioEbay should match (urgency_score ≥ some immediate threshold, platform eBay)
    const result = filterPriorityQueue(allPrio, {
      urgency: "immediate",
      platform: "eBay",
      sort: "cash",
    });
    expect(result).toHaveLength(1);
    expect(result[0].item.platform).toBe("eBay");
  });
});

// ─── getAvailablePlatforms ────────────────────────────────────────────────────

describe("getAvailablePlatforms", () => {
  it("returns sorted unique platforms present in the priority queue", () => {
    const platforms = getAvailablePlatforms(allPrio);
    expect(platforms).toEqual(["eBay", "Poshmark"].sort());
    // Must be unique — no duplicates even if same platform appears twice
    const withDupe: PrioritizedItem[] = [prioEbay, prioEbay, prioPoshmark];
    const deduped = getAvailablePlatforms(withDupe);
    expect(deduped).toHaveLength(2);
    expect(new Set(deduped).size).toBe(deduped.length);
  });

  it("empty array returns empty list", () => {
    expect(getAvailablePlatforms([])).toEqual([]);
  });
});
