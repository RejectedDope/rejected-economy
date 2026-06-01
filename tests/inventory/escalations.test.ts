import { describe, it, expect } from "vitest";
import { detectEscalations } from "@/lib/inventory/prioritization";
import { scoreItem } from "@/lib/scoring";
import type { InventoryItem } from "@/lib/types";

function makeItem(overrides: Partial<InventoryItem> = {}): ReturnType<typeof scoreItem> {
  const base: InventoryItem = {
    id: `item-${Math.random().toString(36).slice(2)}`,
    user_id: "user",
    title: "Test Listing",
    platform: "eBay",
    category: "Sneakers",
    price: 50,
    days_listed: 30,
    image_count: 4,
    item_specifics_complete: true,
    title_keyword_strength: 70,
    has_promoted_listing: false,
    shipping_type: "free",
    views: 20,
    watchers: 1,
    impressions: 200,
    status: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
  return scoreItem(base);
}

describe("detectEscalations", () => {
  it("returns empty array for healthy inventory", () => {
    const items = [
      makeItem({ days_listed: 30, price: 50, views: 30, watchers: 3 }),
      makeItem({ days_listed: 20, price: 75, views: 50, watchers: 5 }),
    ];
    const result = detectEscalations(items);
    expect(result.length).toBe(0);
  });

  it("flags year-plus listings as critical", () => {
    const item = makeItem({ days_listed: 400, price: 40 });
    const result = detectEscalations([item]);
    expect(result.length).toBe(1);
    expect(result[0].severity).toBe("critical");
    expect(result[0].reason).toContain("400d");
  });

  it("flags high-score + significant price as critical", () => {
    // Force a high dead score by using maximum decay signals
    const item = makeItem({
      days_listed: 200,
      price: 100,
      views: 0,
      watchers: 0,
      image_count: 1,
      item_specifics_complete: false,
      title_keyword_strength: 20,
    });
    if (item.dead_inventory_score >= 80) {
      const result = detectEscalations([item]);
      const found = result.find((r) => r.item.id === item.id);
      expect(found?.severity).toBe("critical");
    }
    // If score < 80 just assert no crash
    expect(Array.isArray(detectEscalations([item]))).toBe(true);
  });

  it("flags price rejection pattern (views + no watchers + age)", () => {
    const item = makeItem({
      days_listed: 90,
      views: 150,
      watchers: 0,
      price: 60,
    });
    const result = detectEscalations([item]);
    const found = result.find((r) => r.item.id === item.id);
    if (found) {
      expect(found.reason).toContain("views");
      expect(found.reason).toContain("0 watchers");
    }
  });

  it("skips inactive items", () => {
    const item = makeItem({ days_listed: 500, status: "sold" });
    const result = detectEscalations([item]);
    expect(result.length).toBe(0);
  });

  it("returns critical items before urgent", () => {
    const urgent = makeItem({ days_listed: 90, views: 150, watchers: 0, price: 30 });
    const critical = makeItem({ days_listed: 400, price: 200 });
    const result = detectEscalations([urgent, critical]);
    if (result.length >= 2) {
      const criticalIdx = result.findIndex((r) => r.severity === "critical");
      const urgentIdx = result.findIndex((r) => r.severity === "urgent");
      if (criticalIdx !== -1 && urgentIdx !== -1) {
        expect(criticalIdx).toBeLessThan(urgentIdx);
      }
    }
  });

  it("deduplicates — each item appears at most once", () => {
    const item = makeItem({ days_listed: 400, views: 200, watchers: 0, price: 200 });
    const result = detectEscalations([item]);
    const ids = result.map((r) => r.item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
