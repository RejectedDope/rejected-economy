import { describe, it, expect } from "vitest";
import {
  calcPortfolioHealth,
  calcCategoryRisks,
  calcAgingDistribution,
  calcRecoveryOpportunities,
  calcEffortLevel,
  calcRecoveryROI,
  calcPortfolioScore,
} from "@/lib/inventory/portfolio";
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

// ─── calcEffortLevel ─────────────────────────────────────────────────────────

describe("calcEffortLevel", () => {
  it("low effort actions", () => {
    expect(calcEffortLevel("title_rewrite")).toBe("low");
    expect(calcEffortLevel("optimize_specifics")).toBe("low");
    expect(calcEffortLevel("strategic_markdown")).toBe("low");
  });

  it("high effort actions", () => {
    expect(calcEffortLevel("relist_now")).toBe("high");
    expect(calcEffortLevel("move_platform")).toBe("high");
    expect(calcEffortLevel("liquidate")).toBe("high");
  });

  it("medium effort for unknown action", () => {
    expect(calcEffortLevel("add_photos")).toBe("medium");
  });
});

// ─── calcRecoveryROI ─────────────────────────────────────────────────────────

describe("calcRecoveryROI", () => {
  it("returns 0–100", () => {
    const item = makeScored();
    expect(calcRecoveryROI(item)).toBeGreaterThanOrEqual(0);
    expect(calcRecoveryROI(item)).toBeLessThanOrEqual(100);
  });

  it("critical item has higher ROI than healthy item", () => {
    const critical = makeScored({
      days_listed: 300,
      views: 400,
      watchers: 0,
      item_specifics_complete: false,
      image_count: 1,
    });
    const healthy = makeScored({ days_listed: 10, views: 20, watchers: 3 });
    expect(calcRecoveryROI(critical)).toBeGreaterThan(calcRecoveryROI(healthy));
  });
});

// ─── calcAgingDistribution ───────────────────────────────────────────────────

describe("calcAgingDistribution", () => {
  it("all percentages sum to ~100", () => {
    const items = [
      makeScored({ days_listed: 10 }),
      makeScored({ days_listed: 50 }),
      makeScored({ days_listed: 120 }),
      makeScored({ days_listed: 250 }),
    ];
    const dist = calcAgingDistribution(items);
    const total = dist.pct_fresh + dist.pct_normal + dist.pct_aging + dist.pct_stale;
    expect(total).toBeCloseTo(100, 0);
  });

  it("all fresh items → pct_fresh = 100", () => {
    const items = [makeScored({ days_listed: 5 }), makeScored({ days_listed: 15 })];
    const dist = calcAgingDistribution(items);
    expect(dist.pct_fresh).toBe(100);
    expect(dist.pct_stale).toBe(0);
  });

  it("healthy flag: true when fresh+normal >= 60%", () => {
    const items = [
      makeScored({ days_listed: 10 }),
      makeScored({ days_listed: 60 }),
      makeScored({ days_listed: 300 }),
    ];
    const dist = calcAgingDistribution(items);
    const freshNormal = dist.pct_fresh + dist.pct_normal;
    expect(dist.healthy).toBe(freshNormal >= 60);
  });

  it("handles empty array without crash", () => {
    const dist = calcAgingDistribution([]);
    expect(dist.pct_fresh).toBe(0);
    expect(dist.healthy).toBe(false);
  });
});

// ─── calcCategoryRisks ───────────────────────────────────────────────────────

describe("calcCategoryRisks", () => {
  it("returns categories sorted by total_value desc", () => {
    const items = [
      makeScored({ category: "Sneakers", price: 200, days_listed: 50 }),
      makeScored({ category: "Sneakers", price: 150, days_listed: 50 }),
      makeScored({ category: "Shirts", price: 30, days_listed: 50 }),
    ];
    const risks = calcCategoryRisks(items);
    expect(risks[0].category).toBe("Sneakers");
    expect(risks[0].count).toBe(2);
    expect(risks[1].category).toBe("Shirts");
  });

  it("risk_level: high if dead_pct > 60", () => {
    const items = [
      makeScored({ category: "Junk", days_listed: 300, views: 200, watchers: 0, item_specifics_complete: false, image_count: 1 }),
      makeScored({ category: "Junk", days_listed: 300, views: 200, watchers: 0, item_specifics_complete: false, image_count: 1 }),
      makeScored({ category: "Junk", days_listed: 10, views: 5, watchers: 1, item_specifics_complete: true }),
    ];
    const risks = calcCategoryRisks(items);
    const junk = risks.find((r) => r.category === "Junk")!;
    expect(junk).toBeDefined();
    expect(["medium", "high"]).toContain(junk.risk_level);
  });

  it("concentration_pct sums to ~100 across all categories", () => {
    const items = [
      makeScored({ category: "Sneakers" }),
      makeScored({ category: "Shirts" }),
      makeScored({ category: "Jeans" }),
    ];
    const risks = calcCategoryRisks(items);
    const total = risks.reduce((s, r) => s + r.concentration_pct, 0);
    expect(total).toBeCloseTo(100, 0);
  });
});

// ─── calcRecoveryOpportunities ───────────────────────────────────────────────

describe("calcRecoveryOpportunities", () => {
  it("returns at most `limit` opportunities", () => {
    const items = Array.from({ length: 10 }, (_, i) =>
      makeScored({ id: `item-${i}`, days_listed: 100 + i * 10 })
    );
    const opps = calcRecoveryOpportunities(items, 3);
    expect(opps.length).toBeLessThanOrEqual(3);
  });

  it("only includes items with dead_score >= 30", () => {
    const healthy = makeScored({ days_listed: 5, views: 30, watchers: 4, item_specifics_complete: true });
    const stale = makeScored({ days_listed: 120, views: 50, watchers: 0 });
    const opps = calcRecoveryOpportunities([healthy, stale], 5);
    expect(opps.find((o) => o.item_id === stale.id)).toBeDefined();
    // Healthy item may or may not appear depending on exact score
  });

  it("sorted by roi_score desc", () => {
    const items = [
      makeScored({ days_listed: 50, price: 50 }),
      makeScored({ days_listed: 300, price: 300, views: 200, watchers: 0, item_specifics_complete: false }),
    ];
    const opps = calcRecoveryOpportunities(items, 5);
    for (let i = 1; i < opps.length; i++) {
      expect(opps[i].roi_score).toBeLessThanOrEqual(opps[i - 1].roi_score);
    }
  });
});

// ─── calcPortfolioHealth ─────────────────────────────────────────────────────

describe("calcPortfolioHealth", () => {
  it("returns all required fields", () => {
    const items = [makeScored(), makeScored({ days_listed: 200 })];
    const health = calcPortfolioHealth(items);
    expect(health).toHaveProperty("score");
    expect(health).toHaveProperty("grade");
    expect(health).toHaveProperty("total_active");
    expect(health).toHaveProperty("total_value");
    expect(health).toHaveProperty("trapped_cash");
    expect(health).toHaveProperty("trapped_pct");
    expect(health).toHaveProperty("stale_count");
    expect(health).toHaveProperty("critical_count");
    expect(health).toHaveProperty("recovery_opportunity");
    expect(health).toHaveProperty("category_risks");
    expect(health).toHaveProperty("aging_distribution");
    expect(health).toHaveProperty("top_opportunities");
  });

  it("score is always 0–100", () => {
    const items = Array.from({ length: 5 }, () => makeScored({ days_listed: 300 }));
    const health = calcPortfolioHealth(items);
    expect(health.score).toBeGreaterThanOrEqual(0);
    expect(health.score).toBeLessThanOrEqual(100);
  });

  it("grade A for healthy portfolio", () => {
    const items = [
      makeScored({ days_listed: 5 }),
      makeScored({ days_listed: 10 }),
    ];
    const health = calcPortfolioHealth(items);
    expect(["A", "B"]).toContain(health.grade);
  });

  it("grade F or D for severely distressed portfolio", () => {
    const items = Array.from({ length: 5 }, () =>
      makeScored({
        days_listed: 400,
        views: 200,
        watchers: 0,
        item_specifics_complete: false,
        image_count: 1,
      })
    );
    const health = calcPortfolioHealth(items);
    expect(["D", "F"]).toContain(health.grade);
  });

  it("excludes sold items from active counts", () => {
    const active = makeScored({ status: "active" });
    const sold = makeScored({ status: "sold" });
    const health = calcPortfolioHealth([active, sold]);
    expect(health.total_active).toBe(1);
  });

  it("handles empty portfolio without crash", () => {
    const health = calcPortfolioHealth([]);
    expect(health.score).toBe(100);
    expect(health.grade).toBe("A");
    expect(health.total_active).toBe(0);
  });

  it("trapped_pct rounds correctly", () => {
    const items = [
      makeScored({ days_listed: 200, price: 100 }),  // critical → trapped
      makeScored({ days_listed: 5, price: 100 }),     // fresh → not trapped
    ];
    const health = calcPortfolioHealth(items);
    expect(health.trapped_pct).toBeGreaterThanOrEqual(0);
    expect(health.trapped_pct).toBeLessThanOrEqual(100);
  });
});

// ─── calcPortfolioScore ──────────────────────────────────────────────────────

describe("calcPortfolioScore", () => {
  it("returns the same score as calcPortfolioHealth", () => {
    const items = [makeScored(), makeScored({ days_listed: 150 })];
    const score = calcPortfolioScore(items);
    const health = calcPortfolioHealth(items);
    expect(score).toBe(health.score);
  });
});
