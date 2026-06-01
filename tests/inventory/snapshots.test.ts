import { describe, it, expect } from "vitest";
import {
  buildScoreTrend,
  calcScoreVelocity,
  detectScoreEscalation,
  calcSnapshotSummary,
  extractPriceHistory,
  getLatestScoreBreakdown,
  calcDecayAcceleration,
} from "@/lib/inventory/snapshots";
import type { ScoringSnapshot } from "@/lib/types";

// ─── Fixture ──────────────────────────────────────────────────────────────────

let _id = 0;
function makeSnapshot(
  overrides: Partial<ScoringSnapshot> & { scored_at?: string } = {}
): ScoringSnapshot {
  const { scored_at = new Date().toISOString(), ...rest } = overrides;
  return {
    id: `snap-${++_id}`,
    item_id: "item-1",
    user_id: "user-1",
    dead_inventory_score: 40,
    listing_health_score: 60,
    visibility_risk: "Medium",
    score_days_component: 20,
    score_specifics_component: 5,
    score_photos_component: 5,
    score_title_component: 10,
    price_at_snapshot: 100,
    days_at_snapshot: 45,
    scored_at,
    ...rest,
  };
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

// ─── buildScoreTrend ──────────────────────────────────────────────────────────

describe("buildScoreTrend", () => {
  it("returns empty array for empty input", () => {
    expect(buildScoreTrend([])).toEqual([]);
  });

  it("sorted chronologically", () => {
    const snapshots = [
      makeSnapshot({ scored_at: daysAgo(5) }),
      makeSnapshot({ scored_at: daysAgo(20) }),
      makeSnapshot({ scored_at: daysAgo(1) }),
    ];
    const trend = buildScoreTrend(snapshots);
    for (let i = 1; i < trend.length; i++) {
      expect(new Date(trend[i].date).getTime()).toBeGreaterThanOrEqual(
        new Date(trend[i - 1].date).getTime()
      );
    }
  });

  it("maps all required fields", () => {
    const s = makeSnapshot({ dead_inventory_score: 55, listing_health_score: 45 });
    const trend = buildScoreTrend([s]);
    expect(trend[0].dead_score).toBe(55);
    expect(trend[0].health_score).toBe(45);
    expect(trend[0].price).toBe(100);
    expect(typeof trend[0].days_listed).toBe("number");
  });
});

// ─── calcScoreVelocity ────────────────────────────────────────────────────────

describe("calcScoreVelocity", () => {
  it("returns stable for single snapshot", () => {
    const v = calcScoreVelocity([makeSnapshot()]);
    expect(v.direction).toBe("stable");
    expect(v.delta).toBe(0);
  });

  it("worsening when score increases significantly", () => {
    const snapshots = [
      makeSnapshot({ dead_inventory_score: 20, scored_at: daysAgo(30) }),
      makeSnapshot({ dead_inventory_score: 70, scored_at: daysAgo(0) }),
    ];
    const v = calcScoreVelocity(snapshots);
    expect(v.direction).toBe("worsening");
    expect(v.delta).toBeGreaterThan(0);
  });

  it("improving when score decreases significantly", () => {
    const snapshots = [
      makeSnapshot({ dead_inventory_score: 80, scored_at: daysAgo(30) }),
      makeSnapshot({ dead_inventory_score: 20, scored_at: daysAgo(0) }),
    ];
    const v = calcScoreVelocity(snapshots);
    expect(v.direction).toBe("improving");
    expect(v.delta).toBeLessThan(0);
  });

  it("stable when score barely changes", () => {
    const snapshots = [
      makeSnapshot({ dead_inventory_score: 40, scored_at: daysAgo(30) }),
      makeSnapshot({ dead_inventory_score: 42, scored_at: daysAgo(0) }),
    ];
    const v = calcScoreVelocity(snapshots);
    expect(v.direction).toBe("stable");
  });

  it("days_span is positive number", () => {
    const snapshots = [
      makeSnapshot({ scored_at: daysAgo(10) }),
      makeSnapshot({ scored_at: daysAgo(0) }),
    ];
    const v = calcScoreVelocity(snapshots);
    expect(v.days_span).toBeGreaterThan(0);
  });
});

// ─── detectScoreEscalation ────────────────────────────────────────────────────

describe("detectScoreEscalation", () => {
  it("false for single snapshot", () => {
    expect(detectScoreEscalation([makeSnapshot()])).toBe(false);
  });

  it("true when score jumps > 10 pts in last 14 days", () => {
    const snapshots = [
      makeSnapshot({ dead_inventory_score: 30, scored_at: daysAgo(13) }),
      makeSnapshot({ dead_inventory_score: 55, scored_at: daysAgo(1) }),
    ];
    expect(detectScoreEscalation(snapshots)).toBe(true);
  });

  it("false when score jumps > 10 pts but > 14 days ago", () => {
    const snapshots = [
      makeSnapshot({ dead_inventory_score: 20, scored_at: daysAgo(60) }),
      makeSnapshot({ dead_inventory_score: 40, scored_at: daysAgo(30) }),
      makeSnapshot({ dead_inventory_score: 42, scored_at: daysAgo(1) }),
    ];
    // Within last 14 days: 40 → 42, delta = 2 (not escalating)
    expect(detectScoreEscalation(snapshots)).toBe(false);
  });

  it("false for empty input", () => {
    expect(detectScoreEscalation([])).toBe(false);
  });
});

// ─── calcSnapshotSummary ──────────────────────────────────────────────────────

describe("calcSnapshotSummary", () => {
  it("returns null for empty input", () => {
    expect(calcSnapshotSummary([])).toBeNull();
  });

  it("returns all required fields", () => {
    const snapshots = [
      makeSnapshot({ dead_inventory_score: 30, scored_at: daysAgo(30) }),
      makeSnapshot({ dead_inventory_score: 50, scored_at: daysAgo(0) }),
    ];
    const summary = calcSnapshotSummary(snapshots)!;
    expect(summary).toHaveProperty("snapshot_count");
    expect(summary).toHaveProperty("dead_score_current");
    expect(summary).toHaveProperty("dead_score_start");
    expect(summary).toHaveProperty("dead_score_min");
    expect(summary).toHaveProperty("dead_score_max");
    expect(summary).toHaveProperty("velocity");
    expect(summary).toHaveProperty("is_escalating");
    expect(summary).toHaveProperty("trend");
  });

  it("snapshot_count equals input length", () => {
    const snapshots = [makeSnapshot(), makeSnapshot(), makeSnapshot()];
    const summary = calcSnapshotSummary(snapshots)!;
    expect(summary.snapshot_count).toBe(3);
  });

  it("dead_score_current is from most recent snapshot", () => {
    const snapshots = [
      makeSnapshot({ dead_inventory_score: 20, scored_at: daysAgo(30) }),
      makeSnapshot({ dead_inventory_score: 65, scored_at: daysAgo(1) }),
    ];
    const summary = calcSnapshotSummary(snapshots)!;
    expect(summary.dead_score_current).toBe(65);
    expect(summary.dead_score_start).toBe(20);
  });

  it("dead_score_min and max are correct", () => {
    const snapshots = [
      makeSnapshot({ dead_inventory_score: 10, scored_at: daysAgo(60) }),
      makeSnapshot({ dead_inventory_score: 80, scored_at: daysAgo(30) }),
      makeSnapshot({ dead_inventory_score: 45, scored_at: daysAgo(1) }),
    ];
    const summary = calcSnapshotSummary(snapshots)!;
    expect(summary.dead_score_min).toBe(10);
    expect(summary.dead_score_max).toBe(80);
  });
});

// ─── extractPriceHistory ──────────────────────────────────────────────────────

describe("extractPriceHistory", () => {
  it("returns empty array for empty input", () => {
    expect(extractPriceHistory([])).toEqual([]);
  });

  it("only includes points where price changes", () => {
    const snapshots = [
      makeSnapshot({ price_at_snapshot: 100, scored_at: daysAgo(30) }),
      makeSnapshot({ price_at_snapshot: 100, scored_at: daysAgo(20) }),
      makeSnapshot({ price_at_snapshot: 80, scored_at: daysAgo(10) }),
      makeSnapshot({ price_at_snapshot: 80, scored_at: daysAgo(1) }),
    ];
    const history = extractPriceHistory(snapshots);
    expect(history).toHaveLength(2);
    expect(history[0].price).toBe(100);
    expect(history[1].price).toBe(80);
  });

  it("always includes first point", () => {
    const snapshots = [makeSnapshot({ price_at_snapshot: 75, scored_at: daysAgo(5) })];
    const history = extractPriceHistory(snapshots);
    expect(history).toHaveLength(1);
    expect(history[0].price).toBe(75);
  });

  it("includes dead_score at each price point", () => {
    const s = makeSnapshot({ dead_inventory_score: 60, price_at_snapshot: 90 });
    const history = extractPriceHistory([s]);
    expect(history[0].dead_score).toBe(60);
  });
});

// ─── getLatestScoreBreakdown ──────────────────────────────────────────────────

describe("getLatestScoreBreakdown", () => {
  it("returns null for empty input", () => {
    expect(getLatestScoreBreakdown([])).toBeNull();
  });

  it("returns breakdown from most recent snapshot", () => {
    const snapshots = [
      makeSnapshot({
        scored_at: daysAgo(30),
        score_days_component: 10,
        score_specifics_component: 5,
        score_photos_component: 3,
        score_title_component: 2,
        dead_inventory_score: 20,
      }),
      makeSnapshot({
        scored_at: daysAgo(1),
        score_days_component: 35,
        score_specifics_component: 15,
        score_photos_component: 10,
        score_title_component: 5,
        dead_inventory_score: 65,
      }),
    ];
    const breakdown = getLatestScoreBreakdown(snapshots)!;
    expect(breakdown.days_component).toBe(35);
    expect(breakdown.total).toBe(65);
  });

  it("all required fields present", () => {
    const breakdown = getLatestScoreBreakdown([makeSnapshot()])!;
    expect(breakdown).toHaveProperty("days_component");
    expect(breakdown).toHaveProperty("specifics_component");
    expect(breakdown).toHaveProperty("photos_component");
    expect(breakdown).toHaveProperty("title_component");
    expect(breakdown).toHaveProperty("total");
  });
});

// ─── calcDecayAcceleration ────────────────────────────────────────────────────

describe("calcDecayAcceleration", () => {
  it("returns not accelerating for empty input", () => {
    const result = calcDecayAcceleration([]);
    expect(result.is_accelerating).toBe(false);
    expect(result.recent_rate).toBe(0);
    expect(result.baseline_rate).toBe(0);
  });

  it("returns not accelerating for single snapshot", () => {
    const result = calcDecayAcceleration([makeSnapshot()]);
    expect(result.is_accelerating).toBe(false);
  });

  it("detects acceleration when recent rate is ≥1.5× baseline", () => {
    // baseline (30d): score goes 10 → 20 (10pts / ~28d ≈ 0.36 pts/day)
    // recent (7d): score goes 20 → 30 in 6 days ≈ 1.67 pts/day — much faster
    const snapshots = [
      makeSnapshot({ dead_inventory_score: 10, scored_at: daysAgo(28) }),
      makeSnapshot({ dead_inventory_score: 20, scored_at: daysAgo(7) }),
      makeSnapshot({ dead_inventory_score: 30, scored_at: daysAgo(1) }),
    ];
    const result = calcDecayAcceleration(snapshots);
    expect(result.is_accelerating).toBe(true);
    expect(result.acceleration_factor).toBeGreaterThanOrEqual(1.5);
  });

  it("not accelerating when recent rate is low even if ratio high", () => {
    // recent_rate must be > 0.5 to trigger — small absolute rate doesn't count
    const snapshots = [
      makeSnapshot({ dead_inventory_score: 10, scored_at: daysAgo(28) }),
      makeSnapshot({ dead_inventory_score: 11, scored_at: daysAgo(7) }),
      makeSnapshot({ dead_inventory_score: 11.5, scored_at: daysAgo(1) }),
    ];
    const result = calcDecayAcceleration(snapshots);
    expect(result.is_accelerating).toBe(false);
  });

  it("not accelerating when rate is steady", () => {
    // Uniform rate — factor ≈ 1
    const snapshots = [
      makeSnapshot({ dead_inventory_score: 10, scored_at: daysAgo(14) }),
      makeSnapshot({ dead_inventory_score: 17, scored_at: daysAgo(7) }),
      makeSnapshot({ dead_inventory_score: 24, scored_at: daysAgo(0) }),
    ];
    const result = calcDecayAcceleration(snapshots);
    expect(result.acceleration_factor).toBeLessThan(1.5);
    expect(result.is_accelerating).toBe(false);
  });

  it("returns all required fields", () => {
    const result = calcDecayAcceleration([makeSnapshot()]);
    expect(result).toHaveProperty("is_accelerating");
    expect(result).toHaveProperty("recent_rate");
    expect(result).toHaveProperty("baseline_rate");
    expect(result).toHaveProperty("acceleration_factor");
  });

  it("rates are rounded to 2 decimal places", () => {
    const snapshots = [
      makeSnapshot({ dead_inventory_score: 10, scored_at: daysAgo(30) }),
      makeSnapshot({ dead_inventory_score: 40, scored_at: daysAgo(0) }),
    ];
    const result = calcDecayAcceleration(snapshots);
    // Should be rounded (not excessive decimal places)
    expect(String(result.recent_rate).split(".")[1]?.length ?? 0).toBeLessThanOrEqual(2);
    expect(String(result.baseline_rate).split(".")[1]?.length ?? 0).toBeLessThanOrEqual(2);
  });
});
