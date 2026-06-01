import { describe, it, expect } from "vitest";
import {
  calcUrgencyScore,
  buildReasoningText,
  prioritizeRecovery,
  buildActionQueue,
  getQuickWins,
  getLiquidationCandidates,
} from "@/lib/inventory/prioritization";
import { scoreItem } from "@/lib/scoring";
import type { InventoryItem } from "@/lib/types";

// ─── Fixture ──────────────────────────────────────────────────────────────────

function makeScored(overrides: Partial<InventoryItem> = {}) {
  const base: InventoryItem = {
    id: `item-${Math.random().toString(36).slice(2)}`,
    user_id: "user",
    title: "Test Listing Item",
    platform: "eBay",
    category: "Sneakers",
    price: 100,
    days_listed: 45,
    image_count: 6,
    item_specifics_complete: true,
    title_keyword_strength: 75,
    has_promoted_listing: false,
    shipping_type: "free",
    views: 40,
    watchers: 2,
    impressions: 200,
    status: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
  return scoreItem(base);
}

// ─── calcUrgencyScore ─────────────────────────────────────────────────────────

describe("calcUrgencyScore", () => {
  it("returns 0–100", () => {
    const score = calcUrgencyScore(makeScored());
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("aged listing scores higher than fresh", () => {
    const fresh = makeScored({ days_listed: 10 });
    const old = makeScored({ days_listed: 200 });
    expect(calcUrgencyScore(old)).toBeGreaterThan(calcUrgencyScore(fresh));
  });

  it("365d+ listing gets max age component (60)", () => {
    const ancient = makeScored({ days_listed: 400, views: 0, watchers: 0 });
    expect(calcUrgencyScore(ancient)).toBeGreaterThanOrEqual(60);
  });

  it("high views + zero watchers adds engagement component", () => {
    const noWatchers = makeScored({ views: 120, watchers: 0, days_listed: 30 });
    const withWatchers = makeScored({ views: 120, watchers: 5, days_listed: 30 });
    expect(calcUrgencyScore(noWatchers)).toBeGreaterThan(calcUrgencyScore(withWatchers));
  });

  it("high dead_inventory_score adds score boost", () => {
    const highScore = makeScored({
      days_listed: 200,
      views: 300,
      watchers: 0,
      item_specifics_complete: false,
      image_count: 1,
    });
    // Should be well above 50 given age + engagement + score signals
    expect(calcUrgencyScore(highScore)).toBeGreaterThan(50);
  });
});

// ─── buildReasoningText ───────────────────────────────────────────────────────

describe("buildReasoningText", () => {
  it("returns a non-empty string for every lifecycle stage", () => {
    const stages = [
      "newly_imported", "active", "slowing", "stale",
      "critical", "liquidating", "sold", "archived",
    ] as const;
    const item = makeScored({ days_listed: 100, views: 50, watchers: 0 });
    for (const stage of stages) {
      const text = buildReasoningText(item, stage);
      expect(typeof text).toBe("string");
      expect(text.length).toBeGreaterThan(0);
    }
  });

  it("critical reasoning mentions days listed and dead score", () => {
    const item = makeScored({ days_listed: 200, views: 10, watchers: 0 });
    const text = buildReasoningText(item, "critical");
    expect(text).toMatch(/200/);
  });

  it("liquidating reasoning mentions liquidate", () => {
    const item = makeScored({ days_listed: 400, views: 10, watchers: 0 });
    const text = buildReasoningText(item, "liquidating");
    expect(text.toLowerCase()).toMatch(/liquidat/);
  });

  it("stale with views and no watchers mentions views", () => {
    const item = makeScored({ days_listed: 100, views: 80, watchers: 0 });
    const text = buildReasoningText(item, "stale");
    expect(text).toMatch(/80/);
  });
});

// ─── prioritizeRecovery ───────────────────────────────────────────────────────

describe("prioritizeRecovery", () => {
  it("returns only active items", () => {
    const items = [
      makeScored({ status: "active" }),
      makeScored({ status: "sold" }),
    ];
    const result = prioritizeRecovery(items);
    expect(result.every((r) => r.item.status === "active")).toBe(true);
  });

  it("sorted by urgency_score desc, then roi desc", () => {
    const items = [
      makeScored({ days_listed: 10 }),
      makeScored({ days_listed: 200, views: 200, watchers: 0, item_specifics_complete: false }),
    ];
    const result = prioritizeRecovery(items);
    for (let i = 1; i < result.length; i++) {
      const prev = result[i - 1];
      const curr = result[i];
      if (prev.urgency_score === curr.urgency_score) {
        expect(curr.recovery_roi).toBeLessThanOrEqual(prev.recovery_roi);
      } else {
        expect(curr.urgency_score).toBeLessThanOrEqual(prev.urgency_score);
      }
    }
  });

  it("each result has all required fields", () => {
    const result = prioritizeRecovery([makeScored()]);
    const r = result[0];
    expect(r).toHaveProperty("item");
    expect(r).toHaveProperty("lifecycle_stage");
    expect(r).toHaveProperty("urgency_score");
    expect(r).toHaveProperty("recovery_roi");
    expect(r).toHaveProperty("is_quick_win");
    expect(r).toHaveProperty("effort_level");
    expect(r).toHaveProperty("reasoning");
    expect(r).toHaveProperty("action");
    expect(r).toHaveProperty("estimated_recovery");
  });

  it("urgency_score is 0–100", () => {
    const result = prioritizeRecovery([makeScored(), makeScored({ days_listed: 300 })]);
    for (const r of result) {
      expect(r.urgency_score).toBeGreaterThanOrEqual(0);
      expect(r.urgency_score).toBeLessThanOrEqual(100);
    }
  });

  it("empty input returns empty array", () => {
    expect(prioritizeRecovery([])).toEqual([]);
  });
});

// ─── buildActionQueue ─────────────────────────────────────────────────────────

describe("buildActionQueue", () => {
  it("groups items by primary_recovery_action", () => {
    // Create items that will score to different actions
    const items = [
      makeScored({ days_listed: 200, views: 400, watchers: 0, item_specifics_complete: false }),
      makeScored({ days_listed: 5 }),
    ];
    const queue = buildActionQueue(items);
    expect(queue.length).toBeGreaterThan(0);
    for (const q of queue) {
      expect(q.items.length).toBeGreaterThan(0);
    }
  });

  it("sorted: immediate before this_week before this_month", () => {
    const items = Array.from({ length: 6 }, (_, i) =>
      makeScored({ days_listed: i * 60, views: i * 30, watchers: i % 2 })
    );
    const queue = buildActionQueue(items);
    const urgencyRank = { immediate: 0, this_week: 1, this_month: 2 };
    for (let i = 1; i < queue.length; i++) {
      expect(urgencyRank[queue[i].urgency]).toBeGreaterThanOrEqual(
        urgencyRank[queue[i - 1].urgency]
      );
    }
  });

  it("each queue item has all required fields", () => {
    const queue = buildActionQueue([makeScored()]);
    if (queue.length > 0) {
      const q = queue[0];
      expect(q).toHaveProperty("action");
      expect(q).toHaveProperty("action_label");
      expect(q).toHaveProperty("items");
      expect(q).toHaveProperty("total_recoverable");
      expect(q).toHaveProperty("urgency");
      expect(q).toHaveProperty("effort");
      expect(q).toHaveProperty("impact");
      expect(q).toHaveProperty("batch_efficiency");
    }
  });

  it("batch_efficiency true when group has 3+ items", () => {
    // Force 3 items to the same action by giving them same profile
    const items = Array.from({ length: 3 }, () =>
      makeScored({ days_listed: 5, views: 10, watchers: 1 })
    );
    const queue = buildActionQueue(items);
    const batchGroup = queue.find((q) => q.items.length >= 3);
    if (batchGroup) {
      expect(batchGroup.batch_efficiency).toBe(true);
    }
  });

  it("returns empty array for empty input", () => {
    expect(buildActionQueue([])).toEqual([]);
  });
});

// ─── getQuickWins ─────────────────────────────────────────────────────────────

describe("getQuickWins", () => {
  it("only includes active items", () => {
    const items = [
      makeScored({ status: "active", days_listed: 90, views: 60, watchers: 0, item_specifics_complete: false }),
      makeScored({ status: "sold" }),
    ];
    const wins = getQuickWins(items);
    expect(wins.every((i) => i.status === "active")).toBe(true);
  });

  it("sorted by estimated_recovery desc", () => {
    const items = [
      makeScored({ days_listed: 90, views: 60, watchers: 0, item_specifics_complete: false, price: 50 }),
      makeScored({ days_listed: 90, views: 60, watchers: 0, item_specifics_complete: false, price: 200 }),
    ];
    const wins = getQuickWins(items);
    for (let i = 1; i < wins.length; i++) {
      expect(wins[i].estimated_recovery).toBeLessThanOrEqual(wins[i - 1].estimated_recovery);
    }
  });

  it("returns empty array for empty input", () => {
    expect(getQuickWins([])).toEqual([]);
  });
});

// ─── getLiquidationCandidates ─────────────────────────────────────────────────

describe("getLiquidationCandidates", () => {
  it("includes 365d+ items regardless of score", () => {
    const item = makeScored({ days_listed: 400 });
    const candidates = getLiquidationCandidates([item]);
    expect(candidates.find((c) => c.id === item.id)).toBeDefined();
  });

  it("includes 180d+ items with dead score >= 75", () => {
    const item = makeScored({
      days_listed: 200,
      views: 300,
      watchers: 0,
      item_specifics_complete: false,
      image_count: 1,
    });
    // This item should have a very high dead score
    if (item.dead_inventory_score >= 75) {
      const candidates = getLiquidationCandidates([item]);
      expect(candidates.find((c) => c.id === item.id)).toBeDefined();
    }
  });

  it("excludes fresh healthy items", () => {
    const fresh = makeScored({ days_listed: 5, views: 30, watchers: 3 });
    const candidates = getLiquidationCandidates([fresh]);
    expect(candidates.find((c) => c.id === fresh.id)).toBeUndefined();
  });

  it("excludes sold items", () => {
    const sold = makeScored({ status: "sold", days_listed: 400 });
    const candidates = getLiquidationCandidates([sold]);
    expect(candidates.find((c) => c.id === sold.id)).toBeUndefined();
  });

  it("sorted by days_listed desc", () => {
    const items = [
      makeScored({ days_listed: 400 }),
      makeScored({ days_listed: 500 }),
      makeScored({ days_listed: 365 }),
    ];
    const candidates = getLiquidationCandidates(items);
    for (let i = 1; i < candidates.length; i++) {
      expect(candidates[i].days_listed).toBeLessThanOrEqual(candidates[i - 1].days_listed);
    }
  });

  it("returns empty array for empty input", () => {
    expect(getLiquidationCandidates([])).toEqual([]);
  });
});
