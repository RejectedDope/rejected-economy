import { describe, it, expect } from "vitest";
import { calcDeadScore, calcHealthScore, calcVisibilityRisk, calcPrimaryAction, calcDashboardStats } from "@/lib/scoring";
import type { InventoryItem } from "@/lib/types";
import { scoreAuditLead } from "@/lib/audit-scoring";
import {
  healthyNewListing,
  priceRejectedListing,
  missingSpecificsListing,
  maximumDeadListing,
  abandonedListing,
  underpricedListing,
  weakTitleListing,
  highShippingLowValueListing,
  EXPECTED_OUTPUTS,
} from "@/tests/fixtures/inventory-items";
import { scoringTestCases } from "@/tests/fixtures/audit-submissions";

// ─── Score Boundary Tests ─────────────────────────────────────────────────────

describe("calcDeadScore boundaries", () => {
  it("never goes below 0", () => {
    const score = calcDeadScore({ ...healthyNewListing, days_listed: 0, views: 0, watchers: 0 });
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it("never exceeds 100", () => {
    const score = calcDeadScore({
      ...maximumDeadListing,
      days_listed: 9999,
      views: 10000,
      watchers: 0,
      impressions: 50000,
      price: 10,
      shipping_cost: 10,
      image_count: 0,
      title_keyword_strength: 0,
    });
    expect(score).toBeLessThanOrEqual(100);
  });

  it("score is always an integer", () => {
    const fixtures = [healthyNewListing, priceRejectedListing, maximumDeadListing, abandonedListing];
    fixtures.forEach((f) => {
      const score = calcDeadScore(f);
      expect(score).toBe(Math.round(score));
    });
  });
});

describe("calcHealthScore boundaries", () => {
  it("never goes below 0", () => {
    const score = calcHealthScore(maximumDeadListing);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it("never exceeds 100", () => {
    const score = calcHealthScore(underpricedListing);
    expect(score).toBeLessThanOrEqual(100);
  });
});

// ─── Fixture Outcome Tests ────────────────────────────────────────────────────

describe("healthy new listing (fix-001)", () => {
  const exp = EXPECTED_OUTPUTS["fix-001"];
  it(`health score ≥ ${exp.minHealth}`, () => {
    expect(calcHealthScore(healthyNewListing)).toBeGreaterThanOrEqual(exp.minHealth);
  });
  it(`dead score ≤ ${exp.maxDead}`, () => {
    expect(calcDeadScore(healthyNewListing)).toBeLessThanOrEqual(exp.maxDead!);
  });
  it(`risk = ${exp.risk}`, () => {
    expect(calcVisibilityRisk(healthyNewListing)).toBe(exp.risk);
  });
  it(`action = ${exp.action}`, () => {
    expect(calcPrimaryAction(healthyNewListing)).toBe(exp.action);
  });
});

describe("price rejected listing (fix-002)", () => {
  const exp = EXPECTED_OUTPUTS["fix-002"];
  it(`health score ≥ ${exp.minHealth}`, () => {
    expect(calcHealthScore(priceRejectedListing)).toBeGreaterThanOrEqual(exp.minHealth!);
  });
  it(`dead score ≥ ${exp.minDead}`, () => {
    expect(calcDeadScore(priceRejectedListing)).toBeGreaterThanOrEqual(exp.minDead!);
  });
  it(`risk = ${exp.risk}`, () => {
    expect(calcVisibilityRisk(priceRejectedListing)).toBe(exp.risk);
  });
  it(`action = ${exp.action}`, () => {
    expect(calcPrimaryAction(priceRejectedListing)).toBe(exp.action);
  });
});

describe("missing specifics listing (fix-003)", () => {
  const exp = EXPECTED_OUTPUTS["fix-003"];
  it(`dead score ≥ ${exp.minDead}`, () => {
    expect(calcDeadScore(missingSpecificsListing)).toBeGreaterThanOrEqual(exp.minDead!);
  });
  it(`risk = ${exp.risk}`, () => {
    expect(calcVisibilityRisk(missingSpecificsListing)).toBe(exp.risk);
  });
  it(`action = ${exp.action}`, () => {
    expect(calcPrimaryAction(missingSpecificsListing)).toBe(exp.action);
  });
});

describe("maximum dead listing (fix-004)", () => {
  const exp = EXPECTED_OUTPUTS["fix-004"];
  it(`dead score ≥ ${exp.minDead}`, () => {
    expect(calcDeadScore(maximumDeadListing)).toBeGreaterThanOrEqual(exp.minDead!);
  });
  it(`risk = ${exp.risk}`, () => {
    expect(calcVisibilityRisk(maximumDeadListing)).toBe(exp.risk);
  });
  it(`action = ${exp.action}`, () => {
    expect(calcPrimaryAction(maximumDeadListing)).toBe(exp.action);
  });
});

describe("liquidation candidate (fix-005)", () => {
  const exp = EXPECTED_OUTPUTS["fix-005"];
  it(`dead score ≥ ${exp.minDead}`, () => {
    expect(calcDeadScore(abandonedListing)).toBeGreaterThanOrEqual(exp.minDead!);
  });
  it(`risk = ${exp.risk}`, () => {
    expect(calcVisibilityRisk(abandonedListing)).toBe(exp.risk);
  });
  it(`action = ${exp.action}`, () => {
    expect(calcPrimaryAction(abandonedListing)).toBe(exp.action);
  });
});

describe("underpriced strong demand (fix-006)", () => {
  const exp = EXPECTED_OUTPUTS["fix-006"];
  it(`health score ≥ ${exp.minHealth}`, () => {
    expect(calcHealthScore(underpricedListing)).toBeGreaterThanOrEqual(exp.minHealth!);
  });
  it(`dead score ≤ ${exp.maxDead}`, () => {
    expect(calcDeadScore(underpricedListing)).toBeLessThanOrEqual(exp.maxDead!);
  });
  it(`risk = ${exp.risk}`, () => {
    expect(calcVisibilityRisk(underpricedListing)).toBe(exp.risk);
  });
  it(`action = ${exp.action}`, () => {
    expect(calcPrimaryAction(underpricedListing)).toBe(exp.action);
  });
});

describe("weak title listing (fix-007)", () => {
  const exp = EXPECTED_OUTPUTS["fix-007"];
  it(`dead score ≥ ${exp.minDead}`, () => {
    expect(calcDeadScore(weakTitleListing)).toBeGreaterThanOrEqual(exp.minDead!);
  });
  it(`action = ${exp.action}`, () => {
    expect(calcPrimaryAction(weakTitleListing)).toBe(exp.action);
  });
});

describe("high shipping low value (fix-008)", () => {
  const exp = EXPECTED_OUTPUTS["fix-008"];
  it(`dead score ≥ ${exp.minDead}`, () => {
    expect(calcDeadScore(highShippingLowValueListing)).toBeGreaterThanOrEqual(exp.minDead!);
  });
  it(`risk = ${exp.risk}`, () => {
    expect(calcVisibilityRisk(highShippingLowValueListing)).toBe(exp.risk);
  });
});

// ─── Scoring Monotonicity ─────────────────────────────────────────────────────

describe("score monotonicity", () => {
  it("more days listed = higher dead score (all else equal)", () => {
    const base = { ...healthyNewListing, views: 0, watchers: 0 };
    const old = calcDeadScore({ ...base, days_listed: 30 });
    const older = calcDeadScore({ ...base, days_listed: 90 });
    const veryOld = calcDeadScore({ ...base, days_listed: 200 });
    expect(older).toBeGreaterThan(old);
    expect(veryOld).toBeGreaterThan(older);
  });

  it("more images = better health score", () => {
    const base = healthyNewListing;
    const onePhoto = calcHealthScore({ ...base, image_count: 1 });
    const tenPhotos = calcHealthScore({ ...base, image_count: 10 });
    expect(tenPhotos).toBeGreaterThanOrEqual(onePhoto);
  });

  it("missing specifics increases dead score vs complete specifics", () => {
    const base = { ...healthyNewListing, days_listed: 45 };
    const withSpecifics = calcDeadScore({ ...base, item_specifics_complete: true });
    const withoutSpecifics = calcDeadScore({ ...base, item_specifics_complete: false });
    expect(withoutSpecifics).toBeGreaterThan(withSpecifics);
  });
});

// ─── Recovery Estimate Sanity ─────────────────────────────────────────────────

describe("audit scoring — scoreAuditLead", () => {
  it("severity score is 0–100", () => {
    scoringTestCases.forEach(({ input, expected }) => {
      const { severity_score } = scoreAuditLead({ ...input });
      expect(severity_score).toBeGreaterThanOrEqual(0);
      expect(severity_score).toBeLessThanOrEqual(100);
      expect(severity_score).toBe(expected.severity_score);
    });
  });

  it("recovery_est_low < recovery_est_high for all cases", () => {
    scoringTestCases.forEach(({ input }) => {
      const { recovery_est_low, recovery_est_high } = scoreAuditLead({ ...input });
      expect(recovery_est_low).toBeLessThan(recovery_est_high);
      expect(recovery_est_low).toBeGreaterThan(0);
    });
  });

  it("recovery estimates match fixtures", () => {
    scoringTestCases.forEach(({ input, expected }) => {
      const { recovery_est_low, recovery_est_high } = scoreAuditLead({ ...input });
      expect(recovery_est_low).toBe(expected.recoveryRange[0]);
      expect(recovery_est_high).toBe(expected.recoveryRange[1]);
    });
  });

  it("suggested action matches fixtures", () => {
    scoringTestCases.forEach(({ input, expected }) => {
      const { suggested_action } = scoreAuditLead({ ...input });
      expect(suggested_action).toBe(expected.action);
    });
  });

  it("unknown inputs fall back gracefully", () => {
    const { severity_score, recovery_est_low, recovery_est_high, suggested_action } = scoreAuditLead({
      biggest_problem: "completely unknown problem",
      inventory_count: "unknown count",
      primary_platform: "some platform",
    });
    expect(severity_score).toBeGreaterThanOrEqual(0);
    expect(severity_score).toBeLessThanOrEqual(100);
    expect(recovery_est_low).toBeGreaterThan(0);
    expect(recovery_est_high).toBeGreaterThan(recovery_est_low);
    expect(suggested_action).toBeTruthy();
  });
});

// ─── Contradictions Guard ─────────────────────────────────────────────────────

describe("no contradictory recommendations", () => {
  it("newly listed healthy item does not get liquidate action", () => {
    expect(calcPrimaryAction(healthyNewListing)).not.toBe("liquidate");
  });

  it("item listed 1 year+ does not get hold action", () => {
    expect(calcPrimaryAction(abandonedListing)).not.toBe("hold");
  });

  it("item with 12% watcher rate does not get strategic_markdown", () => {
    // High watcher rate = demand exists, price is working — should hold
    expect(calcPrimaryAction(underpricedListing)).toBe("hold");
  });
});

// ─── calcDashboardStats ────────────────────────────────────────────────────────

function makeItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: `item-${Math.random().toString(36).slice(2)}`,
    user_id: "user",
    title: "Test Item",
    platform: "eBay",
    category: "Sneakers",
    price: 100,
    days_listed: 30,
    image_count: 6,
    item_specifics_complete: true,
    title_keyword_strength: 70,
    has_promoted_listing: false,
    shipping_type: "free",
    views: 20,
    watchers: 2,
    impressions: 100,
    status: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("calcDashboardStats", () => {
  it("returns zero stats for empty inventory", () => {
    const stats = calcDashboardStats([]);
    expect(stats.total_items).toBe(0);
    expect(stats.trapped_cash).toBe(0);
    expect(stats.stale_count).toBe(0);
    expect(stats.stale_cash).toBe(0);
    expect(stats.dead_inventory_pct).toBe(0);
  });

  it("counts only active items", () => {
    const items = [
      makeItem({ status: "active", price: 100 }),
      makeItem({ status: "sold", price: 200 }),
      makeItem({ status: "relisted", price: 150 }),
    ];
    const stats = calcDashboardStats(items);
    expect(stats.total_items).toBe(1);
    expect(stats.trapped_cash).toBe(100);
  });

  it("stale_count counts items with days_listed >= 60", () => {
    const items = [
      makeItem({ days_listed: 30, price: 50 }),
      makeItem({ days_listed: 60, price: 80 }),
      makeItem({ days_listed: 90, price: 120 }),
    ];
    const stats = calcDashboardStats(items);
    expect(stats.stale_count).toBe(2);
  });

  it("stale_cash sums prices of stale items", () => {
    const items = [
      makeItem({ days_listed: 30, price: 50 }),
      makeItem({ days_listed: 65, price: 80 }),
      makeItem({ days_listed: 100, price: 120 }),
    ];
    const stats = calcDashboardStats(items);
    expect(stats.stale_cash).toBe(200);
  });

  it("trapped_cash is sum of all active item prices", () => {
    const items = [
      makeItem({ price: 50 }),
      makeItem({ price: 75 }),
      makeItem({ price: 25 }),
    ];
    const stats = calcDashboardStats(items);
    expect(stats.trapped_cash).toBe(150);
  });

  it("critical_count counts items with Critical visibility_risk", () => {
    // dead_score >= 75 → Critical; stack all bad signals
    const items = [
      makeItem({
        days_listed: 365,
        item_specifics_complete: false,
        image_count: 1,
        title_keyword_strength: 10,
        views: 0,
        watchers: 0,
        shipping_type: "calculated",
        shipping_cost: 20,
        price: 10,
      }),
      makeItem({ days_listed: 5 }),
    ];
    const stats = calcDashboardStats(items);
    expect(stats.critical_count).toBeGreaterThanOrEqual(1);
  });

  it("aging_breakdown buckets are present", () => {
    const stats = calcDashboardStats([makeItem()]);
    const labels = stats.aging_breakdown.map((b) => b.label);
    expect(labels).toContain("0–30d");
    expect(labels).toContain("31–60d");
    expect(labels).toContain("61–90d");
    expect(labels).toContain("91–180d");
    expect(labels).toContain("180d+");
  });

  it("platform_breakdown groups by platform", () => {
    const items = [
      makeItem({ platform: "eBay", price: 100 }),
      makeItem({ platform: "eBay", price: 50 }),
      makeItem({ platform: "Poshmark", price: 80 }),
    ];
    const stats = calcDashboardStats(items);
    const ebay = stats.platform_breakdown.find((p) => p.platform === "eBay");
    expect(ebay?.count).toBe(2);
    expect(ebay?.value).toBe(150);
    expect(stats.platform_breakdown.find((p) => p.platform === "Poshmark")?.count).toBe(1);
  });
});
