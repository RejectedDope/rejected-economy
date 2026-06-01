import { describe, it, expect } from "vitest";
import {
  checkRowTrust,
  checkBatchTrust,
  summarizeViolations,
  type TrustViolation,
} from "@/lib/ingestion/trust-layer";
import type { NormalizedRow } from "@/lib/ingestion/normalize";

// ─── Fixture ──────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<NormalizedRow> = {}): NormalizedRow {
  return {
    title: "Jordan 1 Retro High OG",
    platform: "eBay",
    category: "Sneakers",
    price: 150,
    days_listed: 30,
    item_specifics_complete: true,
    image_count: 6,
    title_keyword_strength: 70,
    has_promoted_listing: false,
    shipping_type: "free",
    views: 50,
    watchers: 2,
    impressions: 200,
    status: "active",
    warnings: [],
    ...overrides,
  };
}

// ─── checkRowTrust ────────────────────────────────────────────────────────────

describe("checkRowTrust — valid row", () => {
  it("passes a clean row", () => {
    const result = checkRowTrust(makeRow());
    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });
});

describe("checkRowTrust — hard rejections", () => {
  it("rejects price above $50k", () => {
    const result = checkRowTrust(makeRow({ price: 75_000 }));
    expect(result.ok).toBe(false);
    const v = result.violations.find((x) => x.rule === "price_unreasonable");
    expect(v).toBeDefined();
    expect(v?.severity).toBe("reject");
  });

  it("rejects price of exactly $50,001", () => {
    const result = checkRowTrust(makeRow({ price: 50_001 }));
    expect(result.ok).toBe(false);
  });

  it("allows price of exactly $50,000", () => {
    const result = checkRowTrust(makeRow({ price: 50_000 }));
    expect(result.ok).toBe(true);
  });

  it("rejects $0 price when title is present", () => {
    const result = checkRowTrust(makeRow({ price: 0 }));
    expect(result.ok).toBe(false);
    const v = result.violations.find((x) => x.rule === "zero_price_with_title");
    expect(v).toBeDefined();
  });

  it("rejects implausible age (> 3650 days)", () => {
    const result = checkRowTrust(makeRow({ days_listed: 3651 }));
    expect(result.ok).toBe(false);
    const v = result.violations.find((x) => x.rule === "age_implausible");
    expect(v).toBeDefined();
  });

  it("allows max age of exactly 3650", () => {
    const result = checkRowTrust(makeRow({ days_listed: 3650 }));
    expect(result.ok).toBe(true);
  });

  it("rejects title shorter than 3 chars", () => {
    const result = checkRowTrust(makeRow({ title: "AB" }));
    expect(result.ok).toBe(false);
    const v = result.violations.find((x) => x.rule === "title_too_short");
    expect(v).toBeDefined();
  });

  it("rejects empty title", () => {
    const result = checkRowTrust(makeRow({ title: "  " }));
    expect(result.ok).toBe(false);
  });
});

describe("checkRowTrust — warnings (don't block import)", () => {
  it("warns when shipping cost exceeds price", () => {
    const result = checkRowTrust(makeRow({ price: 10, shipping_cost: 25 }));
    expect(result.ok).toBe(true);
    const w = result.warnings.find((x) => x.rule === "shipping_exceeds_price");
    expect(w).toBeDefined();
    expect(w?.severity).toBe("warn");
  });

  it("warns when price is >10x original_price", () => {
    const result = checkRowTrust(makeRow({ price: 1500, original_price: 100 }));
    expect(result.ok).toBe(true);
    const w = result.warnings.find((x) => x.rule === "price_far_above_original");
    expect(w).toBeDefined();
  });

  it("does not warn when price is reasonable vs original", () => {
    const result = checkRowTrust(makeRow({ price: 150, original_price: 200 }));
    expect(result.ok).toBe(true);
    expect(result.warnings.filter((w) => w.rule === "price_far_above_original")).toHaveLength(0);
  });

  it("warns when image count is excessive (>50)", () => {
    const result = checkRowTrust(makeRow({ image_count: 51 }));
    expect(result.ok).toBe(true);
    expect(result.warnings.find((w) => w.rule === "image_count_excessive")).toBeDefined();
  });

  it("does not warn on image count of 50", () => {
    const result = checkRowTrust(makeRow({ image_count: 50 }));
    const w = result.warnings.filter((w) => w.rule === "image_count_excessive");
    expect(w).toHaveLength(0);
  });
});

// ─── checkBatchTrust ──────────────────────────────────────────────────────────

describe("checkBatchTrust — batch validation", () => {
  it("returns all rows as valid when all pass", () => {
    const rows = [makeRow(), makeRow({ title: "Nike Air Max 90" }), makeRow({ title: "Levi 501 Jeans" })];
    const result = checkBatchTrust(rows);
    expect(result.validCount).toBe(3);
    expect(result.quarantinedCount).toBe(0);
    expect(result.quarantined).toHaveLength(0);
  });

  it("quarantines rows that fail hard rules", () => {
    const rows = [
      makeRow(),
      makeRow({ price: 999_999 }),   // reject: price unreasonable
      makeRow({ title: "OK" }),       // reject: title too short
    ];
    const result = checkBatchTrust(rows);
    expect(result.validCount).toBe(1);
    expect(result.quarantinedCount).toBe(2);
  });

  it("quarantined rows include the row and its violations", () => {
    const badRow = makeRow({ price: 999_999 });
    const result = checkBatchTrust([badRow]);
    expect(result.quarantined[0].row).toEqual(badRow);
    expect(result.quarantined[0].violations.length).toBeGreaterThan(0);
  });

  it("warns about intra-batch duplicates (same platform+title+price)", () => {
    const row1 = makeRow({ title: "Jordan 1", price: 150, platform: "eBay" });
    const row2 = makeRow({ title: "Jordan 1", price: 150, platform: "eBay" });
    const row3 = makeRow({ title: "Jordan 1", price: 175, platform: "eBay" }); // different price
    const result = checkBatchTrust([row1, row2, row3]);

    expect(result.validCount).toBe(3); // none quarantined — duplicates are warn-only
    // row2 (idx 1) should have a warning
    const row2Warnings = result.warnings.get(1);
    expect(row2Warnings).toBeDefined();
    expect(row2Warnings?.some((w: TrustViolation) => w.rule === "intra_batch_duplicate")).toBe(true);
  });

  it("does not flag as duplicate when prices differ", () => {
    const row1 = makeRow({ title: "Jordan 1", price: 150 });
    const row2 = makeRow({ title: "Jordan 1", price: 175 });
    const result = checkBatchTrust([row1, row2]);
    const row2Warnings = result.warnings.get(1);
    const hasDupe = row2Warnings?.some((w: TrustViolation) => w.rule === "intra_batch_duplicate");
    expect(hasDupe).toBeFalsy();
  });

  it("includes per-row warnings in the warnings map", () => {
    const row = makeRow({ price: 10, shipping_cost: 25 });
    const result = checkBatchTrust([row]);
    expect(result.validCount).toBe(1); // not quarantined
    const w = result.warnings.get(0);
    expect(w).toBeDefined();
    expect(w?.some((x: TrustViolation) => x.rule === "shipping_exceeds_price")).toBe(true);
  });

  it("handles empty batch", () => {
    const result = checkBatchTrust([]);
    expect(result.validCount).toBe(0);
    expect(result.quarantinedCount).toBe(0);
    expect(result.warnings.size).toBe(0);
  });
});

// ─── summarizeViolations ──────────────────────────────────────────────────────

describe("summarizeViolations", () => {
  it("returns empty string for no quarantined rows", () => {
    expect(summarizeViolations([])).toBe("");
  });

  it("summarizes violation rules with counts", () => {
    const quarantined = [
      { row: makeRow(), rowIndex: 0, violations: [{ field: "price", rule: "price_unreasonable" as const, severity: "reject" as const, message: "too high" }] },
      { row: makeRow(), rowIndex: 1, violations: [{ field: "price", rule: "price_unreasonable" as const, severity: "reject" as const, message: "too high" }] },
      { row: makeRow(), rowIndex: 2, violations: [{ field: "title", rule: "title_too_short" as const, severity: "reject" as const, message: "too short" }] },
    ];
    const summary = summarizeViolations(quarantined);
    expect(summary).toContain("2 price unreasonable");
    expect(summary).toContain("1 title too short");
  });
});
