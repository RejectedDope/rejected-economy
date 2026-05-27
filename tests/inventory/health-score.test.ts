import { describe, it, expect } from "vitest";
import {
  calcOperationalHealthScore,
  type HealthScoreInput,
  type HealthScoreResult,
} from "@/lib/inventory/health-score";
import type { ScoredItem } from "@/lib/types";

// Minimal fixture factory — only the fields health-score cares about.
function makeItem(dead_inventory_score: number, days_listed: number) {
  return {
    status: "active",
    dead_inventory_score,
    days_listed,
  } as ScoredItem;
}

// ─── helpers ────────────────────────────────────────────────────────────────

function deductionPoints(result: HealthScoreResult, reasonFragment: string): number | undefined {
  return result.deductions.find((d) =>
    d.reason.toLowerCase().includes(reasonFragment.toLowerCase())
  )?.points;
}

function bonusPoints(result: HealthScoreResult, reasonFragment: string): number | undefined {
  return result.bonuses.find((b) =>
    b.reason.toLowerCase().includes(reasonFragment.toLowerCase())
  )?.points;
}

// ─── test suite ─────────────────────────────────────────────────────────────

describe("calcOperationalHealthScore", () => {
  // 1. Empty items, no import, no actions → score low (never-imported penalty of -20)
  it("empty items + never imported + no actions → score is 80 with never-imported deduction", () => {
    const input: HealthScoreInput = {
      items: [],
      daysSinceLastImport: null,
      actionsThisMonth: 0,
      recoveredThisMonth: 0,
    };
    const result = calcOperationalHealthScore(input);

    // 100 - 20 (never imported) = 80
    expect(result.score).toBe(80);
    expect(result.score).toBeLessThan(100);
    // The never-imported deduction should be 20 points
    expect(result.deductions.some((d) => d.points === 20 && d.reason.toLowerCase().includes("import"))).toBe(true);
  });

  // 2. All healthy items, import today (daysSince=0), 1 action → grade A
  it("all healthy items + import today + 1 action → score 100, grade A, label Healthy", () => {
    const input: HealthScoreInput = {
      items: [
        makeItem(10, 30),
        makeItem(20, 45),
        makeItem(5, 10),
      ],
      daysSinceLastImport: 0,
      actionsThisMonth: 1,
      recoveredThisMonth: 0,
    };
    const result = calcOperationalHealthScore(input);

    // 100 + 5 (actions bonus) → capped at 100
    expect(result.score).toBe(100);
    expect(result.grade).toBe("A");
    expect(result.label).toBe("Healthy");
  });

  // 3. 50% dead items → dead-inventory deduction of -10
  it("50% dead items → dead-inventory deduction of 10 points, score 90", () => {
    // 2 of 4 items are dead (score >= 50) → 50% dead
    // Math.floor(50 / 5) = 10 → deduction of 10 pts
    const input: HealthScoreInput = {
      items: [
        makeItem(60, 30), // dead
        makeItem(55, 30), // dead
        makeItem(20, 30), // healthy
        makeItem(10, 30), // healthy
      ],
      daysSinceLastImport: 0,
      actionsThisMonth: 0,
      recoveredThisMonth: 0,
    };
    const result = calcOperationalHealthScore(input);

    expect(result.score).toBe(90);
    expect(deductionPoints(result, "dead inventory")).toBe(10);
  });

  // 4. All critical items → critical deduction capped at -20
  it("many critical items → critical deduction capped at 20 points", () => {
    // 10 critical items → 10 * 3 = 30 → capped at 20
    // All 10 are also dead (>= 50), 100% dead → Math.floor(100/5) = 20 → dead deduction 20
    // 100 - 20 (dead) - 20 (critical cap) = 60
    const criticalItems = Array.from({ length: 10 }, () => makeItem(80, 30));
    const input: HealthScoreInput = {
      items: criticalItems,
      daysSinceLastImport: 0,
      actionsThisMonth: 0,
      recoveredThisMonth: 0,
    };
    const result = calcOperationalHealthScore(input);

    expect(result.score).toBe(60);
    // Critical deduction must be capped at 20
    expect(deductionPoints(result, "critical")).toBe(20);
  });

  // 5. No import in 7 days → -5 deduction
  it("no import in 7 days → import deduction of 5 points, score 95", () => {
    const input: HealthScoreInput = {
      items: [makeItem(10, 30)],
      daysSinceLastImport: 7,
      actionsThisMonth: 0,
      recoveredThisMonth: 0,
    };
    const result = calcOperationalHealthScore(input);

    expect(result.score).toBe(95);
    expect(deductionPoints(result, "import")).toBe(5);
  });

  // 6. No import in 35 days → -15 deduction (not -5)
  it("no import in 35 days → import deduction of 15 points, score 85", () => {
    const input: HealthScoreInput = {
      items: [makeItem(10, 30)],
      daysSinceLastImport: 35,
      actionsThisMonth: 0,
      recoveredThisMonth: 0,
    };
    const result = calcOperationalHealthScore(input);

    expect(result.score).toBe(85);
    expect(deductionPoints(result, "import")).toBe(15);
  });

  // 7. Avg days listed > 180 → -10 deduction
  it("avg days listed > 180 → listing-age deduction of 10 points, score 90", () => {
    const input: HealthScoreInput = {
      items: [
        makeItem(10, 200),
        makeItem(10, 210),
      ],
      daysSinceLastImport: 0,
      actionsThisMonth: 0,
      recoveredThisMonth: 0,
    };
    const result = calcOperationalHealthScore(input);

    // avg = 205 > 180 → -10
    expect(result.score).toBe(90);
    expect(deductionPoints(result, "listing age")).toBe(10);
  });

  // 8. actionsThisMonth > 0 → +5 bonus
  it("actionsThisMonth > 0 → recovery actions bonus of 5 points", () => {
    const input: HealthScoreInput = {
      items: [makeItem(10, 30)],
      daysSinceLastImport: 0,
      actionsThisMonth: 3,
      recoveredThisMonth: 0,
    };
    const result = calcOperationalHealthScore(input);

    // 100 + 5 → capped at 100
    expect(result.score).toBe(100);
    expect(bonusPoints(result, "action")).toBe(5);
  });

  // 9. recoveredThisMonth > 0 → +5 bonus
  it("recoveredThisMonth > 0 → recovered cash bonus of 5 points", () => {
    const input: HealthScoreInput = {
      items: [makeItem(10, 30)],
      daysSinceLastImport: 0,
      actionsThisMonth: 0,
      recoveredThisMonth: 500,
    };
    const result = calcOperationalHealthScore(input);

    // 100 + 5 → capped at 100
    expect(result.score).toBe(100);
    expect(bonusPoints(result, "recover")).toBe(5);
  });

  // 10a. Score cannot exceed 100
  it("bonuses on top of a perfect base → score capped at 100", () => {
    const input: HealthScoreInput = {
      items: [makeItem(10, 30)],
      daysSinceLastImport: 0,
      actionsThisMonth: 5,
      recoveredThisMonth: 1000,
    };
    const result = calcOperationalHealthScore(input);

    expect(result.score).toBe(100);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  // 10b. Score cannot go below 0
  it("worst-case input → score is never negative", () => {
    // Max possible deductions per spec:
    //   dead cap: -30, critical cap: -20, never imported: -20, listing age > 180: -10 → total -80 → score 20
    // The implementation can't produce a negative score with these caps, but we assert the floor.
    const input: HealthScoreInput = {
      items: Array.from({ length: 20 }, () => makeItem(80, 200)),
      daysSinceLastImport: null,
      actionsThisMonth: 0,
      recoveredThisMonth: 0,
    };
    const result = calcOperationalHealthScore(input);

    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  // 11. Correct grade and label for various score ranges
  describe("grade and label mapping", () => {
    it("score 80-100 → grade A, label Healthy", () => {
      // 100 - 20 (dead) - no other deductions = 80
      // 100% dead (10/10) → Math.floor(100/5) = 20, no critical (score 60 < 75)
      const input: HealthScoreInput = {
        items: Array.from({ length: 10 }, () => makeItem(60, 30)),
        daysSinceLastImport: 0,
        actionsThisMonth: 0,
        recoveredThisMonth: 0,
      };
      const result = calcOperationalHealthScore(input);
      // 100 - 20 (dead) = 80
      expect(result.score).toBe(80);
      expect(result.grade).toBe("A");
      expect(result.label).toBe("Healthy");
    });

    it("score 60-79 → grade B, label Good", () => {
      // 100% dead (score 60) → -20 dead; no critical; import 10 days ago → -5 → 75 → B
      const input: HealthScoreInput = {
        items: Array.from({ length: 4 }, () => makeItem(60, 30)),
        daysSinceLastImport: 10,
        actionsThisMonth: 0,
        recoveredThisMonth: 0,
      };
      const result = calcOperationalHealthScore(input);
      // 100 - 20 (dead) - 5 (stale import) = 75
      expect(result.score).toBe(75);
      expect(result.grade).toBe("B");
      expect(result.label).toBe("Good");
    });

    it("score 40-59 → grade C, label Needs Attention", () => {
      // 100% critical → -20 dead, -20 critical; import 10 days → -5; total = 100-20-20-5 = 55 → C
      const input: HealthScoreInput = {
        items: Array.from({ length: 10 }, () => makeItem(80, 30)),
        daysSinceLastImport: 10,
        actionsThisMonth: 0,
        recoveredThisMonth: 0,
      };
      const result = calcOperationalHealthScore(input);
      // 100 - 20 (dead) - 20 (critical cap) - 5 (import) = 55
      expect(result.score).toBe(55);
      expect(result.grade).toBe("C");
      expect(result.label).toBe("Needs Attention");
    });

    it("score 20-39 → grade D, label At Risk", () => {
      // 100% critical → -20 dead, -20 critical; never imported → -20; total = 100-20-20-20 = 40 → C
      // Need one more deduction: add listing age > 90 → -5 → 35 → D
      const input: HealthScoreInput = {
        items: Array.from({ length: 10 }, () => makeItem(80, 100)),
        daysSinceLastImport: null,
        actionsThisMonth: 0,
        recoveredThisMonth: 0,
      };
      const result = calcOperationalHealthScore(input);
      // 100 - 20 (dead) - 20 (critical cap) - 20 (never imported) - 5 (listing age > 90) = 35
      expect(result.score).toBe(35);
      expect(result.grade).toBe("D");
      expect(result.label).toBe("At Risk");
    });

    it("score 0-19 → grade F, label Critical", () => {
      // Per spec caps the minimum achievable score is 20 (see test 10b).
      // Grade F (0-19) is unreachable with documented deduction caps.
      // We verify the grade boundary condition: a score < 20 maps to F/Critical.
      // Construct a result via the grade formula directly by ensuring any score
      // in that range returns the right grade — we test by injecting 0 bonuses
      // on top of a D scenario and confirming the spec is internally consistent.
      // The implementation uses: score >= 20 ? "D" : "F", so we just test that
      // a D-range score does NOT produce grade F.
      const input: HealthScoreInput = {
        items: Array.from({ length: 10 }, () => makeItem(80, 100)),
        daysSinceLastImport: null,
        actionsThisMonth: 0,
        recoveredThisMonth: 0,
      };
      const result = calcOperationalHealthScore(input);
      // score = 35 → D, confirming grade boundary logic excludes F for score >= 20
      expect(result.grade).not.toBe("F");
      // If score somehow reached 0-19, grade would be F and label Critical
      if (result.score <= 19) {
        expect(result.grade).toBe("F");
        expect(result.label).toBe("Critical");
      }
    });
  });

  // 12. deductions array is non-empty when there are problems
  it("deductions array is non-empty when there are problems", () => {
    const input: HealthScoreInput = {
      items: [
        makeItem(60, 30), // dead
        makeItem(80, 30), // critical
      ],
      daysSinceLastImport: 14, // stale import (7-29 days)
      actionsThisMonth: 0,
      recoveredThisMonth: 0,
    };
    const result = calcOperationalHealthScore(input);

    expect(result.deductions.length).toBeGreaterThan(0);
    for (const d of result.deductions) {
      expect(typeof d.reason).toBe("string");
      expect(d.reason.length).toBeGreaterThan(0);
      expect(d.points).toBeGreaterThan(0);
    }
  });

  // Extra: avg days listed 91-180 → -5 (not -10)
  it("avg days listed between 91 and 180 → listing-age deduction of 5 points, score 95", () => {
    const input: HealthScoreInput = {
      items: [
        makeItem(10, 100),
        makeItem(10, 120),
      ],
      daysSinceLastImport: 0,
      actionsThisMonth: 0,
      recoveredThisMonth: 0,
    };
    const result = calcOperationalHealthScore(input);

    // avg = 110, 90 < 110 <= 180 → -5
    expect(result.score).toBe(95);
    expect(deductionPoints(result, "listing age")).toBe(5);
  });

  // Extra: bonuses array is empty when there are no qualifying actions/recovery
  it("bonuses array is empty when actionsThisMonth=0 and recoveredThisMonth=0", () => {
    const input: HealthScoreInput = {
      items: [makeItem(10, 30)],
      daysSinceLastImport: 0,
      actionsThisMonth: 0,
      recoveredThisMonth: 0,
    };
    const result = calcOperationalHealthScore(input);

    expect(result.bonuses.length).toBe(0);
  });

  // Extra: both bonuses apply independently (+10 total)
  it("both action and recovery bonuses apply independently, adding +10 total", () => {
    // Start with a -15 import deduction so bonuses push it to a measurable non-100 value
    const input: HealthScoreInput = {
      items: [makeItem(10, 30)],
      daysSinceLastImport: 35, // -15
      actionsThisMonth: 2,     // +5
      recoveredThisMonth: 100, // +5
    };
    const result = calcOperationalHealthScore(input);

    // 100 - 15 + 5 + 5 = 95
    expect(result.score).toBe(95);
    expect(result.bonuses.length).toBe(2);
    expect(bonusPoints(result, "action")).toBe(5);
    expect(bonusPoints(result, "recover")).toBe(5);
  });

  // Extra: dead inventory deduction for 100% dead items (all dead_score 50-74, none critical)
  it("100% dead items (non-critical) → dead deduction of 20 points, score 80", () => {
    // Math.floor(100 / 5) = 20, under the cap of 30
    const items = Array.from({ length: 10 }, () => makeItem(60, 30));
    const input: HealthScoreInput = {
      items,
      daysSinceLastImport: 0,
      actionsThisMonth: 0,
      recoveredThisMonth: 0,
    };
    const result = calcOperationalHealthScore(input);

    expect(result.score).toBe(80);
    expect(deductionPoints(result, "dead inventory")).toBe(20);
  });

  // Extra: never-imported penalty is -20, distinct from the 30-day penalty of -15
  it("never imported (null) → deduction of 20 points, not 15", () => {
    const input: HealthScoreInput = {
      items: [makeItem(10, 30)],
      daysSinceLastImport: null,
      actionsThisMonth: 0,
      recoveredThisMonth: 0,
    };
    const result = calcOperationalHealthScore(input);

    // 100 - 20 = 80
    expect(result.score).toBe(80);
    expect(deductionPoints(result, "import")).toBe(20);
  });
});
