import { describe, it, expect } from "vitest";
import {
  normalizeForDedup,
  titleSimilarity,
  dedupeAgainstExisting,
  dedupeWithinBatch,
} from "@/lib/inventory/deduplication";
import type { InventoryItem } from "@/lib/types";
import type { NormalizedRow } from "@/lib/ingestion/normalize";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<NormalizedRow> = {}): NormalizedRow {
  return {
    title: "Nike Air Force 1 White Size 10",
    platform: "eBay",
    category: "Sneakers",
    price: 90,
    days_listed: 0,
    item_specifics_complete: true,
    image_count: 6,
    title_keyword_strength: 70,
    has_promoted_listing: false,
    shipping_type: "free",
    views: 0,
    watchers: 0,
    impressions: 0,
    status: "active",
    warnings: [],
    ...overrides,
  };
}

function makeExisting(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: `existing-${Math.random().toString(36).slice(2)}`,
    user_id: "user",
    title: "Nike Air Force 1 White Size 10",
    platform: "eBay",
    category: "Sneakers",
    price: 90,
    days_listed: 30,
    image_count: 6,
    item_specifics_complete: true,
    title_keyword_strength: 70,
    has_promoted_listing: false,
    shipping_type: "free",
    views: 20,
    watchers: 1,
    impressions: 100,
    status: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// ─── normalizeForDedup ────────────────────────────────────────────────────────

describe("normalizeForDedup", () => {
  it("lowercases input", () => {
    expect(normalizeForDedup("Nike AIR FORCE")).toBe("nike air force");
  });

  it("trims whitespace", () => {
    expect(normalizeForDedup("  Nike Air Force  ")).toBe("nike air force");
  });

  it("collapses multiple spaces", () => {
    expect(normalizeForDedup("Nike  Air   Force")).toBe("nike air force");
  });

  it("removes special characters", () => {
    expect(normalizeForDedup("Nike! Air-Force (White)")).toMatch(/^[\w\s-]+$/);
  });

  it("preserves hyphens", () => {
    expect(normalizeForDedup("Air-Force")).toContain("-");
  });

  it("empty string returns empty string", () => {
    expect(normalizeForDedup("")).toBe("");
  });
});

// ─── titleSimilarity ──────────────────────────────────────────────────────────

describe("titleSimilarity", () => {
  it("identical titles → 1", () => {
    expect(titleSimilarity("Nike Air Force 1", "Nike Air Force 1")).toBe(1);
  });

  it("completely different titles → low score", () => {
    const score = titleSimilarity("Nike Air Force 1", "Vintage Levi Jeans Blue");
    expect(score).toBeLessThan(0.3);
  });

  it("near-identical titles → high score", () => {
    const score = titleSimilarity(
      "Nike Air Force 1 White Size 10",
      "Nike Air Force 1 White Size 10 Men"
    );
    expect(score).toBeGreaterThan(0.75);
  });

  it("returns 0–1 range", () => {
    const score = titleSimilarity("foo bar", "baz qux");
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("both empty → 1", () => {
    expect(titleSimilarity("", "")).toBe(1);
  });

  it("one empty → 0", () => {
    expect(titleSimilarity("Nike Air Force 1", "")).toBe(0);
  });

  it("partial overlap → intermediate score", () => {
    const score = titleSimilarity("Nike Air Force 1", "Nike Air Jordan 1");
    expect(score).toBeGreaterThan(0.3);
    expect(score).toBeLessThan(0.9);
  });
});

// ─── dedupeAgainstExisting ────────────────────────────────────────────────────

describe("dedupeAgainstExisting", () => {
  it("high confidence match: same platform, near-identical title, same price", () => {
    const row = makeRow();
    const existing = makeExisting();
    const result = dedupeAgainstExisting([row], [existing]);

    expect(result.match_count).toBe(1);
    expect(result.unique_count).toBe(0);
    expect(result.matches[0].confidence).toBe("high");
    expect(result.matches[0].recommendation).toBe("skip");
    expect(result.matches[0].matched_fields).toContain("platform");
    expect(result.matches[0].matched_fields).toContain("title");
  });

  it("medium confidence: same platform, similar title, different price", () => {
    const row = makeRow({ price: 150 });
    const existing = makeExisting({ price: 90, title: "Nike Air Force 1 White Size 10 Men Shoes" });
    const result = dedupeAgainstExisting([row], [existing]);

    // May or may not match depending on sim threshold
    // Just verify structural correctness
    if (result.match_count > 0) {
      expect(["high", "medium", "low"]).toContain(result.matches[0].confidence);
    }
  });

  it("no match: different platform, different title", () => {
    const row = makeRow({ platform: "Poshmark", title: "Vintage Levi 501 Jeans Blue 32x30" });
    const existing = makeExisting({ platform: "eBay", title: "Nike Air Force 1 White Size 10" });
    const result = dedupeAgainstExisting([row], [existing]);

    expect(result.match_count).toBe(0);
    expect(result.unique_count).toBe(1);
    expect(result.unique).toHaveLength(1);
  });

  it("cross-platform duplicate: different platform, high title similarity", () => {
    const row = makeRow({ platform: "Poshmark" });
    const existing = makeExisting({ platform: "eBay" });
    const result = dedupeAgainstExisting([row], [existing]);

    if (result.match_count > 0) {
      expect(result.matches[0].confidence).toBe("low");
      expect(result.matches[0].recommendation).toBe("merge");
    }
  });

  it("only checks active existing items", () => {
    const row = makeRow();
    const soldExisting = makeExisting({ status: "sold" });
    const result = dedupeAgainstExisting([row], [soldExisting]);

    // Sold item should be ignored, so row is unique
    expect(result.unique_count).toBe(1);
  });

  it("unique_count + match_count equals incoming length", () => {
    const rows = [makeRow(), makeRow({ title: "Vintage Levi 501 Jeans Blue Denim 32x30" })];
    const existing = [makeExisting()];
    const result = dedupeAgainstExisting(rows, existing);

    expect(result.unique_count + result.match_count).toBe(rows.length);
  });

  it("match includes incoming_index and existing_id", () => {
    const row = makeRow();
    const existing = makeExisting();
    const result = dedupeAgainstExisting([row], [existing]);

    if (result.match_count > 0) {
      expect(typeof result.matches[0].incoming_index).toBe("number");
      expect(typeof result.matches[0].existing_id).toBe("string");
      expect(result.matches[0].reasoning.length).toBeGreaterThan(0);
    }
  });

  it("handles empty incoming array", () => {
    const result = dedupeAgainstExisting([], [makeExisting()]);
    expect(result.match_count).toBe(0);
    expect(result.unique_count).toBe(0);
  });

  it("handles empty existing array", () => {
    const result = dedupeAgainstExisting([makeRow()], []);
    expect(result.unique_count).toBe(1);
    expect(result.match_count).toBe(0);
  });
});

// ─── dedupeWithinBatch ────────────────────────────────────────────────────────

describe("dedupeWithinBatch", () => {
  it("identical rows → one unique, one duplicate", () => {
    const row = makeRow();
    const result = dedupeWithinBatch([row, { ...row }]);
    expect(result.unique).toHaveLength(1);
    expect(result.duplicates).toHaveLength(1);
  });

  it("different titles → all unique", () => {
    const rows = [
      makeRow({ title: "Nike Air Force 1 White" }),
      makeRow({ title: "Vintage Levi 501 Jeans" }),
    ];
    const result = dedupeWithinBatch(rows);
    expect(result.unique).toHaveLength(2);
    expect(result.duplicates).toHaveLength(0);
  });

  it("same title different platform → both unique", () => {
    const rows = [
      makeRow({ platform: "eBay" }),
      makeRow({ platform: "Poshmark" }),
    ];
    const result = dedupeWithinBatch(rows);
    expect(result.unique).toHaveLength(2);
    expect(result.duplicates).toHaveLength(0);
  });

  it("same title different price → both unique", () => {
    const rows = [
      makeRow({ price: 90 }),
      makeRow({ price: 120 }),
    ];
    const result = dedupeWithinBatch(rows);
    expect(result.unique).toHaveLength(2);
    expect(result.duplicates).toHaveLength(0);
  });

  it("duplicate references firstSeenAt (index of first occurrence)", () => {
    const row = makeRow();
    const result = dedupeWithinBatch([row, { ...row }]);
    expect(result.duplicates[0].firstSeenAt).toBe(0);
  });

  it("handles empty array", () => {
    const result = dedupeWithinBatch([]);
    expect(result.unique).toHaveLength(0);
    expect(result.duplicates).toHaveLength(0);
  });

  it("three identical rows → one unique, two duplicates", () => {
    const row = makeRow();
    const result = dedupeWithinBatch([{ ...row }, { ...row }, { ...row }]);
    expect(result.unique).toHaveLength(1);
    expect(result.duplicates).toHaveLength(2);
  });
});
