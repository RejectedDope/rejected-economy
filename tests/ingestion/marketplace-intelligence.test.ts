import { describe, it, expect } from "vitest";
import {
  calcVelocityRisk,
  calcVisibilityDecay,
  calcPricingFriction,
  calcSaturationSignal,
  calcPromotionPotential,
  calcConversionRisk,
  calcStaleProbability,
  analyzeMarketplaceSignals,
} from "@/lib/marketplace-intelligence";
import { scoreItem } from "@/lib/scoring";
import type { InventoryItem } from "@/lib/types";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<InventoryItem> = {}): ReturnType<typeof scoreItem> {
  const base: InventoryItem = {
    id: "test-001",
    user_id: "test",
    title: "Nike Air Max 90 Size 11 DS",
    platform: "eBay",
    category: "Sneakers",
    price: 185,
    days_listed: 45,
    image_count: 6,
    item_specifics_complete: true,
    title_keyword_strength: 72,
    has_promoted_listing: false,
    shipping_type: "free",
    views: 50,
    watchers: 3,
    impressions: 50,
    status: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
  return scoreItem(base);
}

// ─── Velocity Risk ────────────────────────────────────────────────────────────

describe("calcVelocityRisk", () => {
  it("dead: near-zero views on aged listing", () => {
    const item = makeItem({ days_listed: 90, views: 5, watchers: 0 });
    const r = calcVelocityRisk(item);
    expect(r.level).toBe("dead");
  });

  it("stalled: low view velocity over 21+ days", () => {
    const item = makeItem({ days_listed: 40, views: 12, watchers: 0 });
    const r = calcVelocityRisk(item);
    expect(r.level).toBe("stalled");
  });

  it("decelerating: views without watcher conversion", () => {
    const item = makeItem({ days_listed: 45, views: 80, watchers: 0 });
    const r = calcVelocityRisk(item);
    expect(r.level).toBe("decelerating");
  });

  it("accelerating: strong watcher-to-view ratio", () => {
    const item = makeItem({ days_listed: 20, views: 40, watchers: 6 });
    const r = calcVelocityRisk(item);
    expect(r.level).toBe("accelerating");
  });

  it("steady: normal traffic and engagement", () => {
    const item = makeItem({ days_listed: 45, views: 50, watchers: 3 });
    const r = calcVelocityRisk(item);
    expect(r.level).toBe("steady");
  });

  it("new listing (<7d) classified as steady", () => {
    const item = makeItem({ days_listed: 3, views: 10, watchers: 0 });
    const r = calcVelocityRisk(item);
    expect(r.level).toBe("steady");
  });

  it("returns views_per_day and watcher_conversion_rate", () => {
    const item = makeItem({ days_listed: 50, views: 100, watchers: 5 });
    const r = calcVelocityRisk(item);
    expect(r.views_per_day).toBe(2);
    expect(r.watcher_conversion_rate).toBe(0.05);
  });

  it("diagnosis is a non-empty string", () => {
    const item = makeItem();
    const r = calcVelocityRisk(item);
    expect(typeof r.diagnosis).toBe("string");
    expect(r.diagnosis.length).toBeGreaterThan(10);
  });
});

// ─── Visibility Decay ─────────────────────────────────────────────────────────

describe("calcVisibilityDecay", () => {
  it("fresh: <=14 days", () => {
    const item = makeItem({ days_listed: 10 });
    const r = calcVisibilityDecay(item);
    expect(r.stage).toBe("fresh");
    expect(r.suppression_probability).toBeLessThan(15);
    expect(r.days_until_critical).toBeGreaterThan(0);
  });

  it("fading: 15–45 days", () => {
    const item = makeItem({ days_listed: 30 });
    const r = calcVisibilityDecay(item);
    expect(r.stage).toBe("fading");
  });

  it("suppressed: 46–90 days", () => {
    const item = makeItem({ days_listed: 70 });
    const r = calcVisibilityDecay(item);
    expect(r.stage).toBe("suppressed");
    expect(r.days_until_critical).toBeGreaterThanOrEqual(0);
  });

  it("suppression probability is higher with no watchers", () => {
    const withWatchers = makeItem({ days_listed: 70, watchers: 3 });
    const noWatchers = makeItem({ days_listed: 70, watchers: 0 });
    expect(calcVisibilityDecay(noWatchers).suppression_probability).toBeGreaterThan(
      calcVisibilityDecay(withWatchers).suppression_probability
    );
  });

  it("buried: 91–365 days, days_until_critical is null", () => {
    const item = makeItem({ days_listed: 180 });
    const r = calcVisibilityDecay(item);
    expect(r.stage).toBe("buried");
    expect(r.days_until_critical).toBeNull();
  });

  it("zombie: 365+ days", () => {
    const item = makeItem({ days_listed: 400 });
    const r = calcVisibilityDecay(item);
    expect(r.stage).toBe("zombie");
    expect(r.suppression_probability).toBeGreaterThanOrEqual(90);
  });

  it("suppression_probability is always 0–100", () => {
    [5, 14, 30, 60, 90, 180, 400].forEach((days) => {
      const r = calcVisibilityDecay(makeItem({ days_listed: days }));
      expect(r.suppression_probability).toBeGreaterThanOrEqual(0);
      expect(r.suppression_probability).toBeLessThanOrEqual(100);
    });
  });
});

// ─── Pricing Friction ─────────────────────────────────────────────────────────

describe("calcPricingFriction", () => {
  it("detects price rejection: high views, zero watchers", () => {
    const item = makeItem({ views: 120, watchers: 0, days_listed: 45 });
    const r = calcPricingFriction(item);
    expect(r.price_rejection_signals).toBe(true);
    // 35pts → moderate; level depends on total stacked score
    expect(["moderate", "high", "blocking"]).toContain(r.level);
    expect(r.score).toBeGreaterThan(30);
  });

  it("detects shipping friction on low-price item", () => {
    const item = makeItem({ price: 20, shipping_type: "flat", shipping_cost: 7 });
    const r = calcPricingFriction(item);
    expect(r.shipping_friction).toBe(true);
  });

  it("detects trust gap: single photo", () => {
    const item = makeItem({ image_count: 1 });
    const r = calcPricingFriction(item);
    expect(r.trust_gap).toBe(true);
    expect(r.score).toBeGreaterThan(15);
  });

  it("blocking: stacked friction signals", () => {
    const item = makeItem({
      views: 150,
      watchers: 0,
      image_count: 1,
      item_specifics_complete: false,
      days_listed: 100,
      shipping_type: "flat",
      shipping_cost: 12,
      price: 20,
    });
    const r = calcPricingFriction(item);
    expect(r.level).toBe("blocking");
    expect(r.score).toBe(100);
  });

  it("none: clean listing with good engagement", () => {
    const item = makeItem({
      views: 40,
      watchers: 5,
      image_count: 8,
      item_specifics_complete: true,
      days_listed: 20,
      shipping_type: "free",
    });
    const r = calcPricingFriction(item);
    expect(r.level).toBe("none");
    expect(r.score).toBe(0);
  });

  it("recommendations does not exceed 3", () => {
    const item = makeItem({
      views: 150, watchers: 0, image_count: 1,
      item_specifics_complete: false, days_listed: 100,
    });
    const r = calcPricingFriction(item);
    expect(r.recommendations.length).toBeLessThanOrEqual(3);
  });
});

// ─── Saturation ───────────────────────────────────────────────────────────────

describe("calcSaturationSignal", () => {
  it("strong platform fit for eBay sneakers", () => {
    const item = makeItem({ platform: "eBay", category: "Sneakers", price: 185 });
    const r = calcSaturationSignal(item);
    expect(r.platform_fit).toBe("strong");
    expect(r.price_tier_competition).toBe("low");
  });

  it("high price competition for sub-$25 items", () => {
    const item = makeItem({ price: 18 });
    const r = calcSaturationSignal(item);
    expect(r.price_tier_competition).toBe("high");
  });

  it("weak platform fit for eBay not found in map falls back to moderate", () => {
    const item = makeItem({ platform: "eBay", category: "Furniture" });
    const r = calcSaturationSignal(item);
    expect(r.platform_fit).toBe("moderate");
  });

  it("score is 0–100", () => {
    const item = makeItem();
    const r = calcSaturationSignal(item);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it("diagnosis is a non-empty string", () => {
    const item = makeItem();
    const r = calcSaturationSignal(item);
    expect(r.diagnosis.length).toBeGreaterThan(10);
  });
});

// ─── Promotion Potential ──────────────────────────────────────────────────────

describe("calcPromotionPotential", () => {
  it("not_recommended for platforms without promoted listings", () => {
    const item = makeItem({ platform: "Mercari" });
    const r = calcPromotionPotential(item);
    expect(r.roi_class).toBe("not_recommended");
    expect(r.platform_supports).toBe(false);
  });

  it("not_recommended for listing under 30 days", () => {
    const item = makeItem({ platform: "eBay", days_listed: 20 });
    const r = calcPromotionPotential(item);
    expect(r.roi_class).toBe("not_recommended");
  });

  it("not_recommended for price < $20", () => {
    const item = makeItem({ platform: "eBay", price: 12, days_listed: 60 });
    const r = calcPromotionPotential(item);
    expect(r.roi_class).toBe("not_recommended");
  });

  it("high ROI for aged, quality eBay listing with engagement", () => {
    const item = makeItem({
      platform: "eBay",
      days_listed: 90,
      views: 40,
      image_count: 8,
      item_specifics_complete: true,
      price: 150,
    });
    const r = calcPromotionPotential(item);
    expect(r.roi_class).toBe("high");
    expect(r.estimated_visibility_lift).toBeGreaterThan(0);
    expect(r.recommended_rate).toBeDefined();
  });

  it("low ROI when quality gaps exist", () => {
    const item = makeItem({
      platform: "eBay",
      days_listed: 90,
      image_count: 2,
      item_specifics_complete: false,
      price: 80,
    });
    const r = calcPromotionPotential(item);
    expect(r.roi_class).toBe("low");
  });
});

// ─── Conversion Risk ──────────────────────────────────────────────────────────

describe("calcConversionRisk", () => {
  it("high score with stacked barriers", () => {
    const item = makeItem({
      image_count: 1,
      item_specifics_complete: false,
      views: 120,
      watchers: 0,
      title_keyword_strength: 30,
    });
    const r = calcConversionRisk(item);
    expect(r.score).toBeGreaterThan(60);
    expect(r.barriers.length).toBeGreaterThan(2);
  });

  it("primary_barrier is 'none' for clean listing", () => {
    const item = makeItem({
      image_count: 8,
      item_specifics_complete: true,
      views: 20,
      watchers: 2,
      title_keyword_strength: 80,
    });
    const r = calcConversionRisk(item);
    expect(r.primary_barrier).toBe("none");
  });

  it("barriers sorted high → medium → low severity", () => {
    const item = makeItem({
      image_count: 1,
      item_specifics_complete: false,
      title_keyword_strength: 55,
    });
    const r = calcConversionRisk(item);
    const severityOrder = { high: 0, medium: 1, low: 2 };
    for (let i = 1; i < r.barriers.length; i++) {
      expect(severityOrder[r.barriers[i].severity]).toBeGreaterThanOrEqual(
        severityOrder[r.barriers[i - 1].severity]
      );
    }
  });

  it("score is 0–100", () => {
    const item = makeItem();
    expect(calcConversionRisk(item).score).toBeGreaterThanOrEqual(0);
    expect(calcConversionRisk(item).score).toBeLessThanOrEqual(100);
  });
});

// ─── Stale Probability ────────────────────────────────────────────────────────

describe("calcStaleProbability", () => {
  it("returns 0–100", () => {
    [10, 30, 90, 180, 400].forEach((days) => {
      const p = calcStaleProbability(makeItem({ days_listed: days }));
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(100);
    });
  });

  it("increases with age", () => {
    const p30 = calcStaleProbability(makeItem({ days_listed: 30, views: 0, watchers: 0 }));
    const p180 = calcStaleProbability(makeItem({ days_listed: 180, views: 0, watchers: 0 }));
    const p365 = calcStaleProbability(makeItem({ days_listed: 365, views: 0, watchers: 0 }));
    expect(p30).toBeLessThan(p180);
    expect(p180).toBeLessThan(p365);
  });

  it("high views with zero watchers amplifies stale probability", () => {
    const withWatchers = calcStaleProbability(makeItem({ days_listed: 60, views: 80, watchers: 5 }));
    const noWatchers = calcStaleProbability(makeItem({ days_listed: 60, views: 80, watchers: 0 }));
    expect(noWatchers).toBeGreaterThan(withWatchers);
  });
});

// ─── Recovery Priority ────────────────────────────────────────────────────────

describe("buildRecoveryPriority", () => {
  it("zombie listing returns single critical liquidate action", () => {
    const item = makeItem({ days_listed: 400, price: 50 });
    const signals = analyzeMarketplaceSignals(item);
    expect(signals.recoveryPriority).toHaveLength(1);
    expect(signals.recoveryPriority[0].priority).toBe("critical");
  });

  it("zombie low-price listing returns bundle action", () => {
    const item = makeItem({ days_listed: 400, price: 15 });
    const signals = analyzeMarketplaceSignals(item);
    expect(signals.recoveryPriority[0].action).toBe("bundle");
  });

  it("price rejection produces markdown priority", () => {
    const item = makeItem({
      views: 150, watchers: 0, days_listed: 60,
      item_specifics_complete: true, image_count: 8,
      title_keyword_strength: 75,
    });
    const signals = analyzeMarketplaceSignals(item);
    const markdownAction = signals.recoveryPriority.find((p) => p.action === "strategic_markdown");
    expect(markdownAction).toBeDefined();
  });

  it("priority list is sorted critical → high → medium → low", () => {
    const item = makeItem({
      days_listed: 90,
      views: 100,
      watchers: 0,
      image_count: 1,
      item_specifics_complete: false,
      title_keyword_strength: 30,
    });
    const signals = analyzeMarketplaceSignals(item);
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    for (let i = 1; i < signals.recoveryPriority.length; i++) {
      expect(order[signals.recoveryPriority[i].priority]).toBeGreaterThanOrEqual(
        order[signals.recoveryPriority[i - 1].priority]
      );
    }
  });

  it("strong listing with no problems has no critical actions", () => {
    const item = makeItem({
      days_listed: 14,
      views: 30,
      watchers: 4,
      image_count: 10,
      item_specifics_complete: true,
      title_keyword_strength: 85,
    });
    const signals = analyzeMarketplaceSignals(item);
    const criticalActions = signals.recoveryPriority.filter((p) => p.priority === "critical");
    expect(criticalActions).toHaveLength(0);
  });
});

// ─── Full analyzeMarketplaceSignals ───────────────────────────────────────────

describe("analyzeMarketplaceSignals", () => {
  it("returns all required signal keys", () => {
    const item = makeItem();
    const signals = analyzeMarketplaceSignals(item);
    expect(signals).toHaveProperty("velocityRisk");
    expect(signals).toHaveProperty("staleProbability");
    expect(signals).toHaveProperty("saturationScore");
    expect(signals).toHaveProperty("pricingFriction");
    expect(signals).toHaveProperty("visibilityDecay");
    expect(signals).toHaveProperty("promotionPotential");
    expect(signals).toHaveProperty("conversionRisk");
    expect(signals).toHaveProperty("recoveryPriority");
    expect(signals).toHaveProperty("generatedAt");
  });

  it("generatedAt is a valid ISO timestamp", () => {
    const signals = analyzeMarketplaceSignals(makeItem());
    expect(() => new Date(signals.generatedAt)).not.toThrow();
    expect(new Date(signals.generatedAt).getTime()).toBeGreaterThan(0);
  });

  it("staleProbability is always 0–100", () => {
    const signals = analyzeMarketplaceSignals(makeItem());
    expect(signals.staleProbability).toBeGreaterThanOrEqual(0);
    expect(signals.staleProbability).toBeLessThanOrEqual(100);
  });

  it("recoveryPriority is an array", () => {
    const signals = analyzeMarketplaceSignals(makeItem());
    expect(Array.isArray(signals.recoveryPriority)).toBe(true);
  });

  it("handles item with zero views and no engagement", () => {
    const item = makeItem({ views: 0, watchers: 0, days_listed: 1 });
    expect(() => analyzeMarketplaceSignals(item)).not.toThrow();
  });

  it("handles high-engagement item without errors", () => {
    const item = makeItem({ views: 500, watchers: 50, days_listed: 7 });
    expect(() => analyzeMarketplaceSignals(item)).not.toThrow();
  });
});
