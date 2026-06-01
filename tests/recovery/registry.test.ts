import { describe, it, expect } from "vitest";
import {
  RECOVERY_REGISTRY,
  getActionMeta,
  getActionLabel,
  getActionShortLabel,
  getActionUrgency,
  getActionSteps,
  getRecoveryMultiplier,
  sortActionsByUrgency,
} from "@/lib/recovery/registry";
import type { RecoveryAction } from "@/lib/types";

const ALL_ACTIONS: RecoveryAction[] = [
  "relist_now",
  "sell_similar",
  "strategic_markdown",
  "title_rewrite",
  "bundle",
  "move_platform",
  "optimize_specifics",
  "add_photos",
  "liquidate",
  "hold",
];

// ─── Registry completeness ────────────────────────────────────────────────────

describe("RECOVERY_REGISTRY completeness", () => {
  it("has an entry for every RecoveryAction", () => {
    for (const action of ALL_ACTIONS) {
      expect(RECOVERY_REGISTRY[action]).toBeDefined();
    }
  });

  it("every entry has required fields", () => {
    for (const action of ALL_ACTIONS) {
      const meta = RECOVERY_REGISTRY[action];
      expect(meta.id).toBe(action);
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.shortLabel.length).toBeGreaterThan(0);
      expect(["immediate", "this_week", "this_month"]).toContain(meta.urgency);
      expect(meta.estimatedRecoveryMultiplier).toBeGreaterThan(0);
      expect(meta.estimatedRecoveryMultiplier).toBeLessThanOrEqual(1);
      expect(meta.rationale.length).toBeGreaterThan(20);
      expect(meta.steps.length).toBeGreaterThan(0);
    }
  });

  it("recovery multipliers are in expected range", () => {
    for (const action of ALL_ACTIONS) {
      const multiplier = RECOVERY_REGISTRY[action].estimatedRecoveryMultiplier;
      expect(multiplier).toBeGreaterThanOrEqual(0.1);
      expect(multiplier).toBeLessThanOrEqual(1.0);
    }
  });
});

// ─── getActionMeta ────────────────────────────────────────────────────────────

describe("getActionMeta", () => {
  it("returns full meta for a valid action", () => {
    const meta = getActionMeta("relist_now");
    expect(meta.id).toBe("relist_now");
    expect(meta.label).toBe("Relist Now");
    expect(meta.urgency).toBe("immediate");
  });

  it("returns meta for every known action", () => {
    for (const action of ALL_ACTIONS) {
      expect(() => getActionMeta(action)).not.toThrow();
    }
  });
});

// ─── getActionLabel ───────────────────────────────────────────────────────────

describe("getActionLabel", () => {
  it("returns human-readable label", () => {
    expect(getActionLabel("strategic_markdown")).toBe("Strategic Markdown");
    expect(getActionLabel("optimize_specifics")).toBe("Fix Item Specifics");
    expect(getActionLabel("title_rewrite")).toBe("Rewrite Title");
    expect(getActionLabel("hold")).toBe("Hold");
  });
});

// ─── getActionShortLabel ──────────────────────────────────────────────────────

describe("getActionShortLabel", () => {
  it("returns a compact label shorter than the full label for most actions", () => {
    const actions: RecoveryAction[] = ["strategic_markdown", "optimize_specifics", "relist_now"];
    for (const action of actions) {
      const short = getActionShortLabel(action);
      expect(short.length).toBeGreaterThan(0);
      expect(short.length).toBeLessThanOrEqual(getActionLabel(action).length);
    }
  });
});

// ─── getActionUrgency ─────────────────────────────────────────────────────────

describe("getActionUrgency", () => {
  it("relist_now is immediate", () => {
    expect(getActionUrgency("relist_now")).toBe("immediate");
  });

  it("hold is this_month", () => {
    expect(getActionUrgency("hold")).toBe("this_month");
  });

  it("strategic_markdown is this_week", () => {
    expect(getActionUrgency("strategic_markdown")).toBe("this_week");
  });

  it("liquidate is immediate", () => {
    expect(getActionUrgency("liquidate")).toBe("immediate");
  });

  it("title_rewrite is immediate", () => {
    expect(getActionUrgency("title_rewrite")).toBe("immediate");
  });
});

// ─── getActionSteps ───────────────────────────────────────────────────────────

describe("getActionSteps", () => {
  it("returns generic steps when no platform specified", () => {
    const steps = getActionSteps("relist_now");
    expect(steps.length).toBeGreaterThan(0);
    expect(typeof steps[0]).toBe("string");
  });

  it("returns platform-specific steps when available", () => {
    const ebaySteps = getActionSteps("relist_now", "eBay");
    const genericSteps = getActionSteps("relist_now");
    // eBay has platform-specific steps for relist_now
    expect(ebaySteps).not.toEqual(genericSteps);
    expect(ebaySteps.length).toBeGreaterThan(0);
  });

  it("falls back to generic steps for platforms without specific guidance", () => {
    const genericSteps = getActionSteps("relist_now");
    const stepsForUnknownPlatform = getActionSteps("relist_now", "Grailed");
    expect(stepsForUnknownPlatform).toEqual(genericSteps);
  });

  it("returns steps for all actions", () => {
    for (const action of ALL_ACTIONS) {
      const steps = getActionSteps(action);
      expect(steps.length).toBeGreaterThan(0);
    }
  });
});

// ─── getRecoveryMultiplier ────────────────────────────────────────────────────

describe("getRecoveryMultiplier", () => {
  it("hold returns 1.0 (full price)", () => {
    expect(getRecoveryMultiplier("hold")).toBe(1.0);
  });

  it("liquidate returns 0.25 (cents on the dollar)", () => {
    expect(getRecoveryMultiplier("liquidate")).toBe(0.25);
  });

  it("all multipliers are between 0.1 and 1.0", () => {
    for (const action of ALL_ACTIONS) {
      const m = getRecoveryMultiplier(action);
      expect(m).toBeGreaterThanOrEqual(0.1);
      expect(m).toBeLessThanOrEqual(1.0);
    }
  });

  it("higher recovery options have higher multipliers than lower ones", () => {
    expect(getRecoveryMultiplier("add_photos")).toBeGreaterThan(getRecoveryMultiplier("liquidate"));
    expect(getRecoveryMultiplier("hold")).toBeGreaterThan(getRecoveryMultiplier("bundle"));
  });
});

// ─── sortActionsByUrgency ─────────────────────────────────────────────────────

describe("sortActionsByUrgency", () => {
  it("sorts immediate before this_week before this_month", () => {
    const sorted = sortActionsByUrgency(["hold", "relist_now", "strategic_markdown"]);
    expect(sorted[0]).toBe("relist_now");      // immediate
    expect(sorted[1]).toBe("strategic_markdown"); // this_week
    expect(sorted[2]).toBe("hold");               // this_month
  });

  it("handles empty array", () => {
    expect(sortActionsByUrgency([])).toEqual([]);
  });

  it("handles all same urgency", () => {
    const actions: RecoveryAction[] = ["relist_now", "title_rewrite", "optimize_specifics"];
    const sorted = sortActionsByUrgency(actions);
    expect(sorted).toHaveLength(3);
  });

  it("does not mutate the input array", () => {
    const input: RecoveryAction[] = ["hold", "liquidate"];
    const sorted = sortActionsByUrgency(input);
    expect(input[0]).toBe("hold");
    expect(sorted[0]).toBe("liquidate");
  });
});
