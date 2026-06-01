import { describe, it, expect } from "vitest";
import {
  calcLifecycleStage,
  getLifecycleInfo,
  detectEscalation,
  calcAgingAcceleration,
  groupItemsByLifecycle,
} from "@/lib/inventory/lifecycle";
import type { InventoryItem } from "@/lib/types";

// ─── Fixture ──────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: "test",
    user_id: "user",
    title: "Test Item",
    platform: "eBay",
    category: "Sneakers",
    price: 100,
    days_listed: 30,
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
}

// ─── calcLifecycleStage ───────────────────────────────────────────────────────

describe("calcLifecycleStage", () => {
  it("sold item → sold", () => {
    expect(calcLifecycleStage(makeItem({ status: "sold" }))).toBe("sold");
  });

  it("ended item → archived", () => {
    expect(calcLifecycleStage(makeItem({ status: "ended" }))).toBe("archived");
  });

  it("liquidate action + 180d → liquidating", () => {
    const item = makeItem({
      primary_recovery_action: "liquidate",
      days_listed: 200,
    });
    expect(calcLifecycleStage(item)).toBe("liquidating");
  });

  it("liquidate action + <120d → not liquidating (critical instead)", () => {
    const item = makeItem({
      primary_recovery_action: "liquidate",
      days_listed: 90,
      dead_inventory_score: 78,
    });
    expect(calcLifecycleStage(item)).toBe("critical");
  });

  it("180d+ → critical", () => {
    expect(calcLifecycleStage(makeItem({ days_listed: 180 }))).toBe("critical");
  });

  it("dead_inventory_score >= 75 → critical", () => {
    expect(calcLifecycleStage(makeItem({ days_listed: 50, dead_inventory_score: 80 }))).toBe("critical");
  });

  it("90–179d → stale", () => {
    expect(calcLifecycleStage(makeItem({ days_listed: 90 }))).toBe("stale");
    expect(calcLifecycleStage(makeItem({ days_listed: 150 }))).toBe("stale");
  });

  it("score >= 50 → stale", () => {
    expect(calcLifecycleStage(makeItem({ days_listed: 30, dead_inventory_score: 55 }))).toBe("stale");
  });

  it("60–89d → slowing", () => {
    expect(calcLifecycleStage(makeItem({ days_listed: 60 }))).toBe("slowing");
    expect(calcLifecycleStage(makeItem({ days_listed: 89 }))).toBe("slowing");
  });

  it("score >= 30 → slowing", () => {
    expect(calcLifecycleStage(makeItem({ days_listed: 20, dead_inventory_score: 35 }))).toBe("slowing");
  });

  it("14–59d → active", () => {
    expect(calcLifecycleStage(makeItem({ days_listed: 14 }))).toBe("active");
    expect(calcLifecycleStage(makeItem({ days_listed: 45 }))).toBe("active");
  });

  it("< 14d → newly_imported", () => {
    expect(calcLifecycleStage(makeItem({ days_listed: 5 }))).toBe("newly_imported");
    expect(calcLifecycleStage(makeItem({ days_listed: 0 }))).toBe("newly_imported");
  });
});

// ─── getLifecycleInfo ─────────────────────────────────────────────────────────

describe("getLifecycleInfo", () => {
  it("returns info for all stages without throwing", () => {
    const stages = [
      "newly_imported", "active", "slowing", "stale",
      "critical", "liquidating", "sold", "archived",
    ] as const;
    for (const stage of stages) {
      const info = getLifecycleInfo(stage);
      expect(info.stage).toBe(stage);
      expect(info.label.length).toBeGreaterThan(0);
      expect(info.description.length).toBeGreaterThan(0);
      expect(["none", "watch", "act", "immediate", "terminal"]).toContain(info.urgency);
      expect(info.color.startsWith("text-")).toBe(true);
      expect(info.badge_bg.length).toBeGreaterThan(0);
    }
  });

  it("critical stage has highest urgency", () => {
    expect(getLifecycleInfo("critical").urgency).toBe("immediate");
  });

  it("newly_imported has no urgency", () => {
    expect(getLifecycleInfo("newly_imported").urgency).toBe("none");
  });
});

// ─── detectEscalation ────────────────────────────────────────────────────────

describe("detectEscalation", () => {
  it("active → stale is an escalation", () => {
    expect(detectEscalation("active", "stale")).toBe(true);
  });

  it("stale → critical is an escalation", () => {
    expect(detectEscalation("stale", "critical")).toBe(true);
  });

  it("newly_imported → active is NOT an escalation", () => {
    expect(detectEscalation("newly_imported", "active")).toBe(false);
  });

  it("critical → stale is NOT an escalation (improvement)", () => {
    expect(detectEscalation("critical", "stale")).toBe(false);
  });

  it("same stage → not an escalation", () => {
    expect(detectEscalation("stale", "stale")).toBe(false);
  });

  it("sold is not an escalation from any stage", () => {
    expect(detectEscalation("critical", "sold")).toBe(false);
    expect(detectEscalation("slowing", "sold")).toBe(false);
  });
});

// ─── calcAgingAcceleration ───────────────────────────────────────────────────

describe("calcAgingAcceleration", () => {
  it("returns 0–100", () => {
    const acc = calcAgingAcceleration(makeItem());
    expect(acc).toBeGreaterThanOrEqual(0);
    expect(acc).toBeLessThanOrEqual(100);
  });

  it("high acceleration for zombie-like listing", () => {
    const item = makeItem({
      days_listed: 200,
      views: 20,         // low velocity
      watchers: 0,
      image_count: 1,
      item_specifics_complete: false,
    });
    expect(calcAgingAcceleration(item)).toBeGreaterThan(50);
  });

  it("low acceleration for fresh healthy listing", () => {
    const item = makeItem({
      days_listed: 7,
      views: 50,
      watchers: 5,
      image_count: 8,
      item_specifics_complete: true,
      has_promoted_listing: false,
    });
    expect(calcAgingAcceleration(item)).toBeLessThan(20);
  });

  it("promotion slows acceleration on aged listing", () => {
    const base = makeItem({ days_listed: 90, views: 5, watchers: 0 });
    const promoted = makeItem({ days_listed: 90, views: 5, watchers: 0, has_promoted_listing: true });
    expect(calcAgingAcceleration(promoted)).toBeLessThan(calcAgingAcceleration(base));
  });
});

// ─── groupItemsByLifecycle ────────────────────────────────────────────────────

describe("groupItemsByLifecycle", () => {
  it("groups items by derived stage", () => {
    const items = [
      makeItem({ days_listed: 5 }),    // newly_imported
      makeItem({ days_listed: 30 }),   // active
      makeItem({ days_listed: 200 }),  // critical
    ];
    const groups = groupItemsByLifecycle(items);
    expect(groups.get("newly_imported")).toHaveLength(1);
    expect(groups.get("active")).toHaveLength(1);
    expect(groups.get("critical")).toHaveLength(1);
  });

  it("returns empty map for empty input", () => {
    const groups = groupItemsByLifecycle([]);
    expect(groups.size).toBe(0);
  });
});
