import { describe, it, expect } from "vitest";
import {
  calcRecoveryFunnel,
  calcActionSuccessRates,
  getTopPerformingAction,
  calcAvgDaysToSale,
  calcRecoveryEffectiveness,
  buildRecoveryTimeline,
  calcRecoveryRate,
} from "@/lib/inventory/recovery-tracking";
import type { RecoveryActionLog } from "@/lib/types";

// ─── Fixture ──────────────────────────────────────────────────────────────────

let _id = 0;
function makeLog(overrides: Partial<RecoveryActionLog> = {}): RecoveryActionLog {
  return {
    id: `log-${++_id}`,
    item_id: "item-1",
    user_id: "user-1",
    action_type: "strategic_markdown",
    action_status: "completed",
    outcome: "sold",
    days_to_outcome: 7,
    recovery_amount: 80,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// ─── calcRecoveryFunnel ───────────────────────────────────────────────────────

describe("calcRecoveryFunnel", () => {
  it("handles empty logs", () => {
    const f = calcRecoveryFunnel([]);
    expect(f.total_actions).toBe(0);
    expect(f.overall_sell_through_rate).toBe(0);
    expect(f.total_recovered_value).toBe(0);
  });

  it("counts statuses correctly", () => {
    const logs = [
      makeLog({ action_status: "pending", outcome: undefined }),
      makeLog({ action_status: "completed", outcome: "sold" }),
      makeLog({ action_status: "skipped", outcome: undefined }),
      makeLog({ action_status: "snoozed", outcome: undefined }),
    ];
    const f = calcRecoveryFunnel(logs);
    expect(f.total_actions).toBe(4);
    expect(f.pending).toBe(1);
    expect(f.completed).toBe(1);
    expect(f.skipped).toBe(1);
    expect(f.snoozed).toBe(1);
  });

  it("counts outcomes correctly", () => {
    const logs = [
      makeLog({ outcome: "sold" }),
      makeLog({ outcome: "sold" }),
      makeLog({ outcome: "no_change" }),
      makeLog({ outcome: "still_active" }),
    ];
    const f = calcRecoveryFunnel(logs);
    expect(f.sold_count).toBe(2);
    expect(f.no_change_count).toBe(1);
    expect(f.still_active_count).toBe(1);
  });

  it("overall_sell_through_rate = sold / completed-with-outcome", () => {
    const logs = [
      makeLog({ outcome: "sold" }),
      makeLog({ outcome: "sold" }),
      makeLog({ outcome: "no_change" }),
      makeLog({ outcome: "still_active" }),
    ];
    const f = calcRecoveryFunnel(logs);
    expect(f.overall_sell_through_rate).toBe(50);
  });

  it("sums recovery_amount for sold outcomes only", () => {
    const logs = [
      makeLog({ outcome: "sold", recovery_amount: 100 }),
      makeLog({ outcome: "no_change", recovery_amount: 50 }),
    ];
    const f = calcRecoveryFunnel(logs);
    expect(f.total_recovered_value).toBe(100);
  });

  it("does not count pending toward outcome rates", () => {
    const logs = [
      makeLog({ action_status: "pending", outcome: undefined }),
      makeLog({ outcome: "sold" }),
    ];
    const f = calcRecoveryFunnel(logs);
    // Only 1 completed-with-outcome, so rate = 100%
    expect(f.overall_sell_through_rate).toBe(100);
  });
});

// ─── calcActionSuccessRates ───────────────────────────────────────────────────

describe("calcActionSuccessRates", () => {
  it("groups by action_type", () => {
    const logs = [
      makeLog({ action_type: "strategic_markdown", outcome: "sold" }),
      makeLog({ action_type: "strategic_markdown", outcome: "no_change" }),
      makeLog({ action_type: "relist_now", outcome: "sold" }),
    ];
    const rates = calcActionSuccessRates(logs);
    expect(rates.find((r) => r.action === "strategic_markdown")?.total).toBe(2);
    expect(rates.find((r) => r.action === "relist_now")?.total).toBe(1);
  });

  it("sell_through_rate = sold / (completed with outcome)", () => {
    const logs = [
      makeLog({ action_type: "relist_now", outcome: "sold" }),
      makeLog({ action_type: "relist_now", outcome: "sold" }),
      makeLog({ action_type: "relist_now", outcome: "no_change" }),
    ];
    const rates = calcActionSuccessRates(logs);
    const r = rates.find((r) => r.action === "relist_now")!;
    expect(r.sell_through_rate).toBe(67);
  });

  it("avg_days_to_outcome is average of logs with days_to_outcome set", () => {
    const logs = [
      makeLog({ action_type: "liquidate", days_to_outcome: 10, outcome: "sold" }),
      makeLog({ action_type: "liquidate", days_to_outcome: 20, outcome: "sold" }),
    ];
    const rates = calcActionSuccessRates(logs);
    const r = rates.find((r) => r.action === "liquidate")!;
    expect(r.avg_days_to_outcome).toBe(15);
  });

  it("sorted by sell_through_rate desc", () => {
    const logs = [
      makeLog({ action_type: "add_photos", outcome: "no_change" }),
      makeLog({ action_type: "relist_now", outcome: "sold" }),
      makeLog({ action_type: "relist_now", outcome: "sold" }),
    ];
    const rates = calcActionSuccessRates(logs);
    for (let i = 1; i < rates.length; i++) {
      expect(rates[i].sell_through_rate).toBeLessThanOrEqual(rates[i - 1].sell_through_rate);
    }
  });

  it("returns empty array for empty input", () => {
    expect(calcActionSuccessRates([])).toEqual([]);
  });
});

// ─── getTopPerformingAction ───────────────────────────────────────────────────

describe("getTopPerformingAction", () => {
  it("returns action with highest rate and >= minCompletions", () => {
    const rates = [
      { action: "relist_now" as const, total: 3, sold: 3, sell_through_rate: 100, still_active: 0, ended: 0, no_change: 0, pending: 0, avg_days_to_outcome: 5 },
      { action: "liquidate" as const, total: 1, sold: 1, sell_through_rate: 100, still_active: 0, ended: 0, no_change: 0, pending: 0, avg_days_to_outcome: 3 },
    ];
    // relist_now has 3 sold (>= 2 minCompletions threshold)
    expect(getTopPerformingAction(rates, 2)).toBe("relist_now");
  });

  it("returns null when no action meets minCompletions", () => {
    const rates = [
      { action: "relist_now" as const, total: 1, sold: 1, sell_through_rate: 100, still_active: 0, ended: 0, no_change: 0, pending: 0, avg_days_to_outcome: 5 },
    ];
    expect(getTopPerformingAction(rates, 2)).toBeNull();
  });

  it("returns null for empty rates", () => {
    expect(getTopPerformingAction([], 2)).toBeNull();
  });
});

// ─── calcAvgDaysToSale ────────────────────────────────────────────────────────

describe("calcAvgDaysToSale", () => {
  it("averages days_to_outcome for sold outcomes", () => {
    const logs = [
      makeLog({ outcome: "sold", days_to_outcome: 10 }),
      makeLog({ outcome: "sold", days_to_outcome: 20 }),
    ];
    expect(calcAvgDaysToSale(logs)).toBe(15);
  });

  it("ignores non-sold outcomes", () => {
    const logs = [
      makeLog({ outcome: "sold", days_to_outcome: 10 }),
      makeLog({ outcome: "no_change", days_to_outcome: 5 }),
    ];
    expect(calcAvgDaysToSale(logs)).toBe(10);
  });

  it("returns 0 when no sold logs", () => {
    expect(calcAvgDaysToSale([makeLog({ outcome: "no_change" })])).toBe(0);
  });

  it("returns 0 for empty input", () => {
    expect(calcAvgDaysToSale([])).toBe(0);
  });
});

// ─── calcRecoveryEffectiveness ────────────────────────────────────────────────

describe("calcRecoveryEffectiveness", () => {
  it("returns all required fields", () => {
    const report = calcRecoveryEffectiveness([makeLog()]);
    expect(report).toHaveProperty("funnel");
    expect(report).toHaveProperty("by_action");
    expect(report).toHaveProperty("top_action");
    expect(report).toHaveProperty("avg_days_to_sale");
    expect(report).toHaveProperty("total_cash_recovered");
  });

  it("total_cash_recovered matches funnel.total_recovered_value", () => {
    const logs = [makeLog({ recovery_amount: 75 }), makeLog({ recovery_amount: 25 })];
    const report = calcRecoveryEffectiveness(logs);
    expect(report.total_cash_recovered).toBe(report.funnel.total_recovered_value);
    expect(report.total_cash_recovered).toBe(100);
  });

  it("handles empty logs without throwing", () => {
    const report = calcRecoveryEffectiveness([]);
    expect(report.funnel.total_actions).toBe(0);
    expect(report.top_action).toBeNull();
  });
});

// ─── buildRecoveryTimeline ────────────────────────────────────────────────────

describe("buildRecoveryTimeline", () => {
  it("sorts events chronologically", () => {
    const logs = [
      makeLog({ created_at: "2024-03-10T00:00:00Z" }),
      makeLog({ created_at: "2024-01-05T00:00:00Z" }),
      makeLog({ created_at: "2024-06-20T00:00:00Z" }),
    ];
    const timeline = buildRecoveryTimeline(logs);
    for (let i = 1; i < timeline.length; i++) {
      expect(new Date(timeline[i].date).getTime()).toBeGreaterThanOrEqual(
        new Date(timeline[i - 1].date).getTime()
      );
    }
  });

  it("maps action_type and outcome correctly", () => {
    const log = makeLog({ action_type: "relist_now", outcome: "sold", days_to_outcome: 14 });
    const timeline = buildRecoveryTimeline([log]);
    expect(timeline[0].action_type).toBe("relist_now");
    expect(timeline[0].outcome).toBe("sold");
    expect(timeline[0].days_to_outcome).toBe(14);
  });

  it("returns empty array for empty input", () => {
    expect(buildRecoveryTimeline([])).toEqual([]);
  });
});

// ─── calcRecoveryRate ─────────────────────────────────────────────────────────

describe("calcRecoveryRate", () => {
  it("returns 0–100", () => {
    const rate = calcRecoveryRate([makeLog(), makeLog({ outcome: "no_change" })]);
    expect(rate).toBeGreaterThanOrEqual(0);
    expect(rate).toBeLessThanOrEqual(100);
  });

  it("100% when all completed logs sold", () => {
    expect(calcRecoveryRate([makeLog(), makeLog()])).toBe(100);
  });

  it("0% when all completed logs did not sell", () => {
    expect(calcRecoveryRate([makeLog({ outcome: "no_change" })])).toBe(0);
  });

  it("0 for empty input", () => {
    expect(calcRecoveryRate([])).toBe(0);
  });

  it("ignores pending logs", () => {
    const logs = [
      makeLog({ action_status: "pending", outcome: undefined }),
      makeLog({ outcome: "sold" }),
    ];
    expect(calcRecoveryRate(logs)).toBe(100);
  });
});
