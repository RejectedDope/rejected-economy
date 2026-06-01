import { describe, it, expect } from "vitest";
import { evaluateAutomationRules, type RuleEvalResult } from "@/lib/automation/engine";
import type { ScoredItem } from "@/lib/types";

// ─── Local AutomationRule type ────────────────────────────────────────────────
// Mirrors the shape from @/app/actions/automation without importing the server
// action directly.
type AutomationRule = {
  id: string;
  rule_type: "stale_alert" | "auto_markdown" | "auto_relist" | "auto_crosslist";
  enabled: boolean;
  conditions: Record<string, unknown>;
  actions: Record<string, unknown>;
  run_count: number;
  last_run_at: string | null;
  created_at: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRule(
  overrides: Partial<AutomationRule> & { rule_type: AutomationRule["rule_type"] }
): AutomationRule {
  return {
    id: "rule-1",
    enabled: true,
    conditions: { min_days_listed: 30 },
    actions: {},
    run_count: 0,
    last_run_at: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeItem(
  overrides: Partial<ScoredItem> & { status: ScoredItem["status"]; days_listed: number }
): ScoredItem {
  const defaults: Partial<ScoredItem> = {
    id: "item-1",
    user_id: "user-1",
    title: "Test Item",
    platform: "eBay",
    category: "Clothing",
    price: 50,
    item_specifics_complete: true,
    image_count: 4,
    title_keyword_strength: 70,
    has_promoted_listing: false,
    shipping_type: "calculated",
    views: 10,
    watchers: 1,
    impressions: 100,
    dead_inventory_score: 30,
    listing_health_score: 70,
    visibility_risk: "Low",
    primary_recovery_action: "hold",
    estimated_recovery: 50,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
  return { ...defaults, ...overrides } as unknown as ScoredItem;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("evaluateAutomationRules — disabled rules", () => {
  it("disabled rules are excluded even when items match", () => {
    const rule = makeRule({ rule_type: "stale_alert", enabled: false });
    const item = makeItem({ status: "active", days_listed: 60 });

    const results = evaluateAutomationRules([rule], [item]);

    expect(results).toHaveLength(0);
  });
});

describe("evaluateAutomationRules — stale_alert", () => {
  it("fires on items at or above min_days_listed threshold", () => {
    const rule = makeRule({
      rule_type: "stale_alert",
      conditions: { min_days_listed: 30 },
    });
    const atThreshold = makeItem({ status: "active", days_listed: 30 });
    const aboveThreshold = makeItem({ id: "item-2", status: "active", days_listed: 45 });

    const results = evaluateAutomationRules([rule], [atThreshold, aboveThreshold]);

    expect(results).toHaveLength(1);
    expect(results[0].ruleType).toBe("stale_alert");
    expect(results[0].triggeredItems).toHaveLength(2);
  });

  it("does NOT fire on items below the threshold", () => {
    const rule = makeRule({
      rule_type: "stale_alert",
      conditions: { min_days_listed: 30 },
    });
    const item = makeItem({ status: "active", days_listed: 29 });

    const results = evaluateAutomationRules([rule], [item]);

    expect(results).toHaveLength(0);
  });

  it("suggestedAction is 'strategic_markdown' for stale_alert", () => {
    const rule = makeRule({
      rule_type: "stale_alert",
      conditions: { min_days_listed: 7 },
    });
    const item = makeItem({ status: "active", days_listed: 10 });

    const results = evaluateAutomationRules([rule], [item]);

    expect(results).toHaveLength(1);
    expect(results[0].suggestedAction).toBe("strategic_markdown");
  });
});

describe("evaluateAutomationRules — auto_markdown", () => {
  it("fires when item has no original_price (no baseline to compare)", () => {
    const rule = makeRule({
      rule_type: "auto_markdown",
      conditions: { min_days_listed: 14 },
    });
    const item = makeItem({
      status: "active",
      days_listed: 20,
      price: 50,
      original_price: undefined,
    });

    const results = evaluateAutomationRules([rule], [item]);

    expect(results).toHaveLength(1);
    expect(results[0].ruleType).toBe("auto_markdown");
  });

  it("fires when price >= 97% of original_price (no effective markdown)", () => {
    const rule = makeRule({
      rule_type: "auto_markdown",
      conditions: { min_days_listed: 14 },
    });
    // price = 97 = exactly 97% of original_price 100 — no real markdown
    const item = makeItem({
      status: "active",
      days_listed: 20,
      price: 97,
      original_price: 100,
    });

    const results = evaluateAutomationRules([rule], [item]);

    expect(results).toHaveLength(1);
    expect(results[0].triggeredItems).toHaveLength(1);
  });

  it("does NOT fire when item is already marked down below 97% of original", () => {
    const rule = makeRule({
      rule_type: "auto_markdown",
      conditions: { min_days_listed: 14 },
    });
    // price = 80 < 97% of 100 — already meaningfully marked down
    const item = makeItem({
      status: "active",
      days_listed: 20,
      price: 80,
      original_price: 100,
    });

    const results = evaluateAutomationRules([rule], [item]);

    expect(results).toHaveLength(0);
  });
});

describe("evaluateAutomationRules — auto_relist", () => {
  it("fires when dead_inventory_score >= 60 AND days_listed >= threshold", () => {
    const rule = makeRule({
      rule_type: "auto_relist",
      conditions: { min_days_listed: 30 },
    });
    const item = makeItem({
      status: "active",
      days_listed: 35,
      dead_inventory_score: 60,
    });

    const results = evaluateAutomationRules([rule], [item]);

    expect(results).toHaveLength(1);
    expect(results[0].ruleType).toBe("auto_relist");
  });

  it("does NOT fire when dead_inventory_score is below 60", () => {
    const rule = makeRule({
      rule_type: "auto_relist",
      conditions: { min_days_listed: 30 },
    });
    const item = makeItem({
      status: "active",
      days_listed: 35,
      dead_inventory_score: 59,
    });

    const results = evaluateAutomationRules([rule], [item]);

    expect(results).toHaveLength(0);
  });

  it("suggestedAction is 'relist_now' for auto_relist", () => {
    const rule = makeRule({
      rule_type: "auto_relist",
      conditions: { min_days_listed: 10 },
    });
    const item = makeItem({
      status: "active",
      days_listed: 15,
      dead_inventory_score: 75,
    });

    const results = evaluateAutomationRules([rule], [item]);

    expect(results).toHaveLength(1);
    expect(results[0].suggestedAction).toBe("relist_now");
  });
});

describe("evaluateAutomationRules — auto_crosslist", () => {
  it("fires when dead_inventory_score >= 50 AND days_listed >= threshold", () => {
    const rule = makeRule({
      rule_type: "auto_crosslist",
      conditions: { min_days_listed: 20 },
    });
    const item = makeItem({
      status: "active",
      days_listed: 25,
      dead_inventory_score: 50,
    });

    const results = evaluateAutomationRules([rule], [item]);

    expect(results).toHaveLength(1);
    expect(results[0].ruleType).toBe("auto_crosslist");
  });

  it("does NOT fire when dead_inventory_score is below 50", () => {
    const rule = makeRule({
      rule_type: "auto_crosslist",
      conditions: { min_days_listed: 20 },
    });
    const item = makeItem({
      status: "active",
      days_listed: 25,
      dead_inventory_score: 49,
    });

    const results = evaluateAutomationRules([rule], [item]);

    expect(results).toHaveLength(0);
  });
});

describe("evaluateAutomationRules — status filtering", () => {
  it("never triggers on sold items regardless of age or score", () => {
    const rules = [
      makeRule({ id: "r1", rule_type: "stale_alert", conditions: { min_days_listed: 1 } }),
      makeRule({ id: "r2", rule_type: "auto_relist", conditions: { min_days_listed: 1 } }),
    ];
    const soldItem = makeItem({
      status: "sold",
      days_listed: 365,
      dead_inventory_score: 99,
    });

    const results = evaluateAutomationRules(rules, [soldItem]);

    expect(results).toHaveLength(0);
  });
});

describe("evaluateAutomationRules — edge cases", () => {
  it("returns empty array when items array is empty", () => {
    const rule = makeRule({
      rule_type: "stale_alert",
      conditions: { min_days_listed: 30 },
    });

    const results = evaluateAutomationRules([rule], []);

    expect(results).toHaveLength(0);
  });

  it("returns empty array when rules array is empty", () => {
    const item = makeItem({ status: "active", days_listed: 60 });

    const results = evaluateAutomationRules([], [item]);

    expect(results).toHaveLength(0);
  });

  it("only includes rules that triggered at least one item (no zero-count results)", () => {
    const matchingRule = makeRule({
      id: "rule-match",
      rule_type: "stale_alert",
      conditions: { min_days_listed: 10 },
    });
    const nonMatchingRule = makeRule({
      id: "rule-no-match",
      rule_type: "stale_alert",
      conditions: { min_days_listed: 999 },
    });
    const item = makeItem({ status: "active", days_listed: 15 });

    const results = evaluateAutomationRules([matchingRule, nonMatchingRule], [item]);

    expect(results).toHaveLength(1);
    expect(results[0].ruleId).toBe("rule-match");
  });
});

describe("evaluateAutomationRules — multiple rules on same item", () => {
  it("multiple distinct rules can independently trigger on the same item", () => {
    const staleRule = makeRule({
      id: "stale",
      rule_type: "stale_alert",
      conditions: { min_days_listed: 30 },
    });
    const crosslistRule = makeRule({
      id: "crosslist",
      rule_type: "auto_crosslist",
      conditions: { min_days_listed: 30 },
    });
    // Item qualifies for both: active, days >= 30, dead_score >= 50
    const item = makeItem({
      status: "active",
      days_listed: 45,
      dead_inventory_score: 55,
    });

    const results = evaluateAutomationRules([staleRule, crosslistRule], [item]);

    expect(results).toHaveLength(2);
    const types = results.map((r: RuleEvalResult) => r.ruleType);
    expect(types).toContain("stale_alert");
    expect(types).toContain("auto_crosslist");
  });
});

describe("evaluateAutomationRules — alertMessage", () => {
  it("alertMessage contains the count of triggered items", () => {
    const rule = makeRule({
      rule_type: "stale_alert",
      conditions: { min_days_listed: 10 },
    });
    const items = [
      makeItem({ id: "a", status: "active", days_listed: 15 }),
      makeItem({ id: "b", status: "active", days_listed: 20 }),
      makeItem({ id: "c", status: "active", days_listed: 5 }), // below threshold — not triggered
    ];

    const results = evaluateAutomationRules([rule], items);

    expect(results).toHaveLength(1);
    // The message must mention "2" (the number of triggered items)
    expect(results[0].alertMessage).toContain("2");
  });
});
